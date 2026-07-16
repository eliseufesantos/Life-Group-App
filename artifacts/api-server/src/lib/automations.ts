import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db, avisosTable, usuariosTable, type Aviso } from "@workspace/db";
import { notifyUsers } from "./push";
import { logger } from "./logger";

/** Executor aceito pelos helpers: a conexão do pool ou uma transação. */
type Executor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Chave do advisory lock que serializa a criação de avisos de aniversário. */
const BIRTHDAY_LOCK = 428_518;

const SAO_PAULO_TZ = "America/Sao_Paulo";

/** Format a Date as YYYY-MM-DD in the America/Sao_Paulo timezone. */
function saoPauloDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Format a YYYY-MM-DD date string as DD/MM/YYYY for user-visible text. */
function formatDateBr(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

/** Insert an automatic aviso on the mural (createdBy null). */
export async function postMuralAviso(
  options: {
    title: string;
    body: string;
    origin: "manual" | "birthday" | "campaign" | "registro_pending";
    refId?: number | null;
  },
  executor: Executor = db,
): Promise<Aviso> {
  const [aviso] = await executor
    .insert(avisosTable)
    .values({
      title: options.title,
      body: options.body,
      origin: options.origin,
      refId: options.refId ?? null,
      createdBy: null,
    })
    .returning();
  return aviso;
}

/**
 * For each active member whose birthday (month/day, America/Sao_Paulo) is
 * today, post a mural aviso and broadcast a notification — at most once per
 * day per member (dedupe via origin='birthday' + refId=userId + createdAt).
 * Called hourly by the scheduler and lazily by GET /board/announcements.
 */
export async function ensureBirthdayAvisos(): Promise<void> {
  try {
    const today = saoPauloDateString(new Date());
    const monthDay = today.slice(5); // MM-DD
    const users = await db
      .select()
      .from(usuariosTable)
      .where(
        and(
          eq(usuariosTable.active, true),
          eq(usuariosTable.status, "member"),
          isNotNull(usuariosTable.birthDate),
        ),
      );
    const birthdayUsers = users.filter(
      (u) => u.birthDate !== null && u.birthDate.slice(5) === monthDay,
    );
    if (birthdayUsers.length === 0) return;

    // O scheduler horário e vários GET /board/announcements podem rodar isto
    // ao mesmo tempo. Um advisory lock serializa o "checa-se-existe → insere":
    // sem ele, todos passariam no check antes de qualquer commit e postariam o
    // mesmo aviso. O broadcast (push, lento) fica fora do lock.
    const notified: string[] = [];
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${BIRTHDAY_LOCK})`);
      for (const user of birthdayUsers) {
        const [latest] = await tx
          .select()
          .from(avisosTable)
          .where(
            and(
              eq(avisosTable.origin, "birthday"),
              eq(avisosTable.refId, user.id),
            ),
          )
          .orderBy(desc(avisosTable.createdAt))
          .limit(1);
        if (latest && saoPauloDateString(latest.createdAt) === today) continue;
        await postMuralAviso(
          {
            title: `🎂 Hoje é aniversário de ${user.name}!`,
            body: `Deseje um feliz aniversário para ${user.name} no Life Group!`,
            origin: "birthday",
            refId: user.id,
          },
          tx,
        );
        notified.push(user.name);
      }
    });

    for (const name of notified) {
      await notifyUsers({
        userIds: null,
        type: "announcement",
        title: `🎂 Hoje é aniversário de ${name}!`,
        body: "Passe no mural para deixar os parabéns.",
        link: "/mural",
      });
    }
  } catch (err) {
    logger.error({ err }, "Failed to ensure birthday avisos");
  }
}

/**
 * A meeting record created/edited by an auxiliary is waiting for leader
 * approval: post/update the mural aviso (dedupe via origin+refId) and send a
 * personal notification to every leader.
 */
/**
 * Publica/atualiza o aviso de pendência do registro no mural e, por padrão,
 * notifica os líderes.
 *
 * `notifyLeaders: false` serve para edições de um registro que já estava
 * pendente: o aviso do mural precisa refletir os novos dados (a data aparece
 * no texto), mas os líderes não devem receber uma notificação pessoal a cada
 * ajuste — a responsabilidade já lhes foi comunicada quando ficou pendente.
 */
export async function notifyRegistroPendente(
  registro: {
    id: number;
    seq: number;
    eventDate: string;
  },
  options: { notifyLeaders?: boolean } = {},
): Promise<void> {
  const { notifyLeaders = true } = options;
  try {
    const title = `Registro do encontro de ${formatDateBr(registro.eventDate)} aguarda aprovação do líder`;
    const body = `O registro nº ${registro.seq} foi enviado por um auxiliar e aguarda aprovação.`;
    const [existing] = await db
      .select({ id: avisosTable.id })
      .from(avisosTable)
      .where(
        and(
          eq(avisosTable.origin, "registro_pending"),
          eq(avisosTable.refId, registro.id),
        ),
      )
      .limit(1);
    if (existing) {
      await db
        .update(avisosTable)
        .set({ title, body })
        .where(eq(avisosTable.id, existing.id));
    } else {
      await postMuralAviso({
        title,
        body,
        origin: "registro_pending",
        refId: registro.id,
      });
    }
    if (!notifyLeaders) return;
    const leaders = await db
      .select({ id: usuariosTable.id })
      .from(usuariosTable)
      .where(
        and(eq(usuariosTable.role, "leader"), eq(usuariosTable.active, true)),
      );
    if (leaders.length > 0) {
      await notifyUsers({
        userIds: leaders.map((l) => l.id),
        type: "task",
        title: "Registro de encontro aguardando sua aprovação",
        body: `Encontro de ${formatDateBr(registro.eventDate)} (registro nº ${registro.seq})`,
        link: "/registros",
      });
    }
  } catch (err) {
    logger.error({ err }, "Failed to notify pending registro");
  }
}

/** Remove the pending-approval aviso once the registro is approved/deleted. */
export async function removeRegistroPendingAviso(
  registroId: number,
): Promise<void> {
  try {
    await db
      .delete(avisosTable)
      .where(
        and(
          eq(avisosTable.origin, "registro_pending"),
          eq(avisosTable.refId, registroId),
        ),
      );
  } catch (err) {
    logger.error({ err }, "Failed to remove pending registro aviso");
  }
}

/**
 * A campaign became active (created active or reopened): post a mural aviso
 * (dedupe via origin='campaign' + refId) and broadcast a notification. When
 * the aviso already exists nothing is sent again.
 */
export async function announceCampaignActivated(
  campaign: { id: number; title: string; description: string | null },
  actorId?: number,
): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: avisosTable.id })
      .from(avisosTable)
      .where(
        and(
          eq(avisosTable.origin, "campaign"),
          eq(avisosTable.refId, campaign.id),
        ),
      )
      .limit(1);
    if (existing) return;
    const title = `Nova campanha aberta: ${campaign.title}`;
    await postMuralAviso({
      title,
      body:
        campaign.description ??
        "Confira os detalhes da campanha no Life Group.",
      origin: "campaign",
      refId: campaign.id,
    });
    await notifyUsers({
      userIds: null,
      excludeUserId: actorId,
      type: "announcement",
      title,
      body: campaign.description ?? undefined,
      link: "/mural",
    });
  } catch (err) {
    logger.error({ err }, "Failed to announce campaign activation");
  }
}

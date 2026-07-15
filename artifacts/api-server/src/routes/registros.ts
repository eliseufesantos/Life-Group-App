import { Router, type IRouter } from "express";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  usuariosTable,
  albunsTable,
  campanhasTable,
  itensArrecadadosTable,
  registrosEncontroTable,
  presencasRegistroTable,
  atividadesCatalogoTable,
  atividadesRegistroTable,
  type RegistroEncontro,
} from "@workspace/db";
import {
  CreateRegistroBody,
  GetRegistroParams,
  UpdateRegistroBody,
  UpdateRegistroParams,
  DeleteRegistroParams,
  ApproveRegistroParams,
  CreateRegistroActivityBody,
  DeleteRegistroActivityParams,
} from "@workspace/api-zod";
import {
  requireAuth,
  requirePrivileged,
  type AuthedRequest,
} from "../lib/auth";
import {
  notifyRegistroPendente,
  removeRegistroPendingAviso,
} from "../lib/automations";

const router: IRouter = Router();

async function nameMap(ids: Array<number | null>): Promise<Map<number, string>> {
  const names = new Map<number, string>();
  const unique = Array.from(
    new Set(ids.filter((id): id is number => id !== null)),
  );
  if (unique.length === 0) return names;
  const people = await db
    .select({ id: usuariosTable.id, name: usuariosTable.name })
    .from(usuariosTable)
    .where(inArray(usuariosTable.id, unique));
  for (const p of people) names.set(p.id, p.name);
  return names;
}

// --- Catálogo de atividades ---

const BUILTIN_ACTIVITIES: Array<{ name: string; hasDuration: boolean }> = [
  { name: "Relax", hasDuration: true },
  { name: "Papo Reto", hasDuration: true },
  { name: "Dar com Alegria", hasDuration: true },
  { name: "Visão", hasDuration: true },
  { name: "Oração", hasDuration: true },
  { name: "Lanche", hasDuration: true },
  // Estimated time does not apply to Comunhão
  { name: "Comunhão", hasDuration: false },
];

/** Idempotently seed the 7 builtin activities on first use. */
async function ensureBuiltinActivities(): Promise<void> {
  const existing = await db
    .select({ name: atividadesCatalogoTable.name })
    .from(atividadesCatalogoTable)
    .where(eq(atividadesCatalogoTable.builtin, true));
  const existingNames = new Set(existing.map((e) => e.name));
  const missing = BUILTIN_ACTIVITIES.filter((a) => !existingNames.has(a.name));
  if (missing.length === 0) return;
  await db.insert(atividadesCatalogoTable).values(
    missing.map((a) => ({
      name: a.name,
      hasDuration: a.hasDuration,
      builtin: true,
      active: true,
    })),
  );
}

router.get(
  "/registros/atividades",
  requireAuth,
  requirePrivileged,
  async (_req, res): Promise<void> => {
    await ensureBuiltinActivities();
    const activities = await db
      .select()
      .from(atividadesCatalogoTable)
      .where(eq(atividadesCatalogoTable.active, true))
      .orderBy(asc(atividadesCatalogoTable.id));
    res.json(
      activities.map((a) => ({
        id: a.id,
        name: a.name,
        hasDuration: a.hasDuration,
        builtin: a.builtin,
      })),
    );
  },
);

router.post(
  "/registros/atividades",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const parsed = CreateRegistroActivityBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [activity] = await db
      .insert(atividadesCatalogoTable)
      .values({
        name: parsed.data.name,
        hasDuration: parsed.data.hasDuration,
        builtin: false,
        active: true,
      })
      .returning();
    res.status(201).json({
      id: activity.id,
      name: activity.name,
      hasDuration: activity.hasDuration,
      builtin: activity.builtin,
    });
  },
);

router.delete(
  "/registros/atividades/:id",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const params = DeleteRegistroActivityParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [activity] = await db
      .select()
      .from(atividadesCatalogoTable)
      .where(eq(atividadesCatalogoTable.id, params.data.id));
    if (!activity) {
      res.status(404).json({ error: "Atividade não encontrada" });
      return;
    }
    if (activity.builtin) {
      res
        .status(400)
        .json({ error: "Atividades padrão não podem ser removidas" });
      return;
    }
    // Snapshots in atividades_registro keep the name (FK set null)
    await db
      .delete(atividadesCatalogoTable)
      .where(eq(atividadesCatalogoTable.id, activity.id));
    res.json({ ok: true });
  },
);

// --- Registros de encontro ---

async function registroDetail(
  registro: RegistroEncontro,
): Promise<Record<string, unknown>> {
  const presencas = await db
    .select({
      userId: presencasRegistroTable.userId,
      name: usuariosTable.name,
      status: usuariosTable.status,
    })
    .from(presencasRegistroTable)
    .innerJoin(usuariosTable, eq(presencasRegistroTable.userId, usuariosTable.id))
    .where(eq(presencasRegistroTable.registroId, registro.id))
    .orderBy(asc(usuariosTable.name));

  const atividades = await db
    .select()
    .from(atividadesRegistroTable)
    .where(eq(atividadesRegistroTable.registroId, registro.id))
    .orderBy(asc(atividadesRegistroTable.id));

  const arrecadacao = await db
    .select()
    .from(itensArrecadadosTable)
    .where(eq(itensArrecadadosTable.registroId, registro.id))
    .orderBy(asc(itensArrecadadosTable.id));

  let album: { id: number; title: string; driveUrl: string | null } | null =
    null;
  if (registro.albumId !== null) {
    const [row] = await db
      .select({
        id: albunsTable.id,
        title: albunsTable.title,
        driveUrl: albunsTable.driveUrl,
      })
      .from(albunsTable)
      .where(eq(albunsTable.id, registro.albumId));
    album = row ?? null;
  }

  const names = await nameMap([
    registro.createdBy,
    registro.approvedBy,
    ...atividades.map((a) => a.responsavelId),
  ]);

  return {
    id: registro.id,
    seq: registro.seq,
    eventDate: registro.eventDate,
    status: registro.status,
    notes: registro.notes,
    createdByName:
      registro.createdBy !== null
        ? (names.get(registro.createdBy) ?? null)
        : null,
    approvedByName:
      registro.approvedBy !== null
        ? (names.get(registro.approvedBy) ?? null)
        : null,
    presentes: presencas.map((p) => ({
      userId: p.userId,
      name: p.name,
      status: p.status === "guest" ? "guest" : "member",
    })),
    atividades: atividades.map((a) => ({
      id: a.id,
      atividadeId: a.atividadeId,
      name: a.name,
      responsavelId: a.responsavelId,
      responsavelName:
        a.responsavelId !== null ? (names.get(a.responsavelId) ?? null) : null,
      durationMin: a.durationMin,
    })),
    arrecadacao: arrecadacao.map((i) => ({
      id: i.id,
      itemName: i.itemName,
      quantity: i.quantity,
    })),
    album,
    createdAt: registro.createdAt.toISOString(),
    updatedAt: registro.updatedAt.toISOString(),
  };
}

/** Validate that all given user ids exist; returns an error message or null. */
async function validateUserIds(ids: number[]): Promise<string | null> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return null;
  const found = await db
    .select({ id: usuariosTable.id })
    .from(usuariosTable)
    .where(inArray(usuariosTable.id, unique));
  if (found.length !== unique.length) return "Participante não encontrado";
  return null;
}

/**
 * Guests may attend a meeting (presence) but never be the responsible person
 * for an activity — being responsible is a function, which guests never hold.
 */
async function hasGuestResponsible(ids: number[]): Promise<boolean> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return false;
  const rows = await db
    .select({ id: usuariosTable.id })
    .from(usuariosTable)
    .where(
      and(
        inArray(usuariosTable.id, unique),
        eq(usuariosTable.status, "guest"),
      ),
    );
  return rows.length > 0;
}

async function validateAlbumId(albumId: number): Promise<string | null> {
  const [album] = await db
    .select({ id: albunsTable.id })
    .from(albunsTable)
    .where(eq(albunsTable.id, albumId));
  return album ? null : "Álbum não encontrado";
}

/** Find the currently active campaign to link donated items to. */
/** Tipos de campanha que recebem itens — uma campanha só de dinheiro não. */
const ITEM_CAMPAIGN_TYPES = ["items", "both"] as const;

/** Chave do advisory lock que serializa a numeração sequencial do registro. */
const REGISTRO_SEQ_LOCK = 428_517;

/**
 * Campanha ativa que aceita itens. O filtro por tipo importa: a tela de
 * Campanhas só lista itens de campanhas `items`/`both`, então itens lançados
 * numa campanha de dinheiro ficariam invisíveis, mas contando nos relatórios.
 */
async function activeCampaignId(): Promise<number | null> {
  const [campaign] = await db
    .select({ id: campanhasTable.id })
    .from(campanhasTable)
    .where(
      and(
        eq(campanhasTable.status, "active"),
        inArray(campanhasTable.type, [...ITEM_CAMPAIGN_TYPES]),
      ),
    )
    .orderBy(desc(campanhasTable.createdAt))
    .limit(1);
  return campaign?.id ?? null;
}

/** Executor aceito pelos helpers: a conexão do pool ou uma transação. */
type Executor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

async function createGuests(
  guests: Array<{ name: string; phone?: string }>,
  executor: Executor = db,
): Promise<number[]> {
  const ids: number[] = [];
  for (const g of guests) {
    const [guest] = await executor
      .insert(usuariosTable)
      .values({
        name: g.name,
        phone: g.phone ?? null,
        status: "guest",
        role: null,
      })
      .returning();
    ids.push(guest.id);
  }
  return ids;
}

router.get(
  "/registros",
  requireAuth,
  requirePrivileged,
  async (_req, res): Promise<void> => {
    const registros = await db
      .select()
      .from(registrosEncontroTable)
      .orderBy(desc(registrosEncontroTable.seq));

    const ids = registros.map((r) => r.id);
    const counts = new Map<number, number>();
    if (ids.length > 0) {
      const rows = await db
        .select({
          registroId: presencasRegistroTable.registroId,
          count: sql<number>`count(*)::int`,
        })
        .from(presencasRegistroTable)
        .where(inArray(presencasRegistroTable.registroId, ids))
        .groupBy(presencasRegistroTable.registroId);
      for (const r of rows) counts.set(r.registroId, r.count);
    }
    const names = await nameMap(registros.map((r) => r.createdBy));
    res.json(
      registros.map((r) => ({
        id: r.id,
        seq: r.seq,
        eventDate: r.eventDate,
        status: r.status,
        presentCount: counts.get(r.id) ?? 0,
        createdByName:
          r.createdBy !== null ? (names.get(r.createdBy) ?? null) : null,
      })),
    );
  },
);

router.post(
  "/registros",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const parsed = CreateRegistroBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const data = parsed.data;

    const atividades = data.atividades ?? [];
    const responsavelIds = atividades
      .map((a) => a.responsavelId)
      .filter((id): id is number => id !== undefined && id !== null);
    const userIdsError = await validateUserIds([
      ...data.presentes,
      ...responsavelIds,
    ]);
    if (userIdsError) {
      res.status(400).json({ error: userIdsError });
      return;
    }
    if (await hasGuestResponsible(responsavelIds)) {
      res
        .status(400)
        .json({ error: "Convidado não pode ser responsável por atividade" });
      return;
    }
    if (data.albumId !== undefined) {
      const albumError = await validateAlbumId(data.albumId);
      if (albumError) {
        res.status(400).json({ error: albumError });
        return;
      }
    }

    const arrecadacao = data.arrecadacao ?? [];
    let campaignId: number | null = null;
    if (arrecadacao.length > 0) {
      campaignId = await activeCampaignId();
      if (campaignId === null) {
        res.status(400).json({
          error: "Não há campanha ativa para registrar a arrecadação",
        });
        return;
      }
    }

    const isLeader = req.user!.role === "leader";
    const status = isLeader ? "published" : "pending";

    // Registro + listas relacionadas são gravados numa única transação: se
    // qualquer insert falhar (ex.: colisão de seq ou FK obsoleta), tudo é
    // desfeito e nenhum registro/atividade parcial permanece.
    let registro: RegistroEncontro;
    try {
      registro = await db.transaction(async (tx) => {
        // Serializa a numeração: sem isso, dois envios simultâneos leem o
        // mesmo max(seq) e um deles morre no unique constraint, perdendo o
        // formulário que a pessoa acabou de preencher. O lock cai no commit.
        await tx.execute(sql`select pg_advisory_xact_lock(${REGISTRO_SEQ_LOCK})`);
        const [maxRow] = await tx
          .select({
            max: sql<number | null>`max(${registrosEncontroTable.seq})`,
          })
          .from(registrosEncontroTable);
        const seq = (maxRow?.max ?? 0) + 1;

        const [reg] = await tx
          .insert(registrosEncontroTable)
          .values({
            eventDate: data.eventDate,
            seq,
            status,
            createdBy: req.user!.id,
            approvedBy: isLeader ? req.user!.id : null,
            albumId: data.albumId ?? null,
            notes: data.notes ?? null,
          })
          .returning();

        const guestIds = await createGuests(data.novosConvidados ?? [], tx);
        const presentIds = Array.from(
          new Set([...data.presentes, ...guestIds]),
        );
        if (presentIds.length > 0) {
          await tx.insert(presencasRegistroTable).values(
            presentIds.map((userId) => ({
              registroId: reg.id,
              userId,
            })),
          );
        }

        if (atividades.length > 0) {
          await tx.insert(atividadesRegistroTable).values(
            atividades.map((a) => ({
              registroId: reg.id,
              atividadeId: a.atividadeId ?? null,
              name: a.name,
              responsavelId: a.responsavelId ?? null,
              durationMin: a.durationMin ?? null,
            })),
          );
        }

        if (arrecadacao.length > 0 && campaignId !== null) {
          await tx.insert(itensArrecadadosTable).values(
            arrecadacao.map((i) => ({
              campaignId: campaignId!,
              registroId: reg.id,
              itemName: i.item,
              quantity: i.quantity,
              registeredBy: req.user!.id,
            })),
          );
        }

        return reg;
      });
    } catch (err) {
      req.log.error({ err }, "Falha ao criar registro de encontro");
      res.status(500).json({ error: "Não foi possível criar o registro" });
      return;
    }

    if (registro.status === "pending") {
      void notifyRegistroPendente({
        id: registro.id,
        seq: registro.seq,
        eventDate: registro.eventDate,
      });
    }

    res.status(201).json(await registroDetail(registro));
  },
);

router.get(
  "/registros/:id",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const params = GetRegistroParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [registro] = await db
      .select()
      .from(registrosEncontroTable)
      .where(eq(registrosEncontroTable.id, params.data.id));
    if (!registro) {
      res.status(404).json({ error: "Registro não encontrado" });
      return;
    }
    res.json(await registroDetail(registro));
  },
);

router.patch(
  "/registros/:id",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const params = UpdateRegistroParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateRegistroBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const data = parsed.data;

    const [existing] = await db
      .select()
      .from(registrosEncontroTable)
      .where(eq(registrosEncontroTable.id, params.data.id));
    if (!existing) {
      res.status(404).json({ error: "Registro não encontrado" });
      return;
    }

    const atividades = data.atividades ?? [];
    const responsavelIds = atividades
      .map((a) => a.responsavelId)
      .filter((id): id is number => id !== undefined && id !== null);
    const userIdsError = await validateUserIds([
      ...(data.presentes ?? []),
      ...responsavelIds,
    ]);
    if (userIdsError) {
      res.status(400).json({ error: userIdsError });
      return;
    }
    if (await hasGuestResponsible(responsavelIds)) {
      res
        .status(400)
        .json({ error: "Convidado não pode ser responsável por atividade" });
      return;
    }
    if (data.albumId !== undefined && data.albumId !== null) {
      const albumError = await validateAlbumId(data.albumId);
      if (albumError) {
        res.status(400).json({ error: albumError });
        return;
      }
    }

    // A tela envia a lista de arrecadação inteira a cada salvamento, então só
    // reescrevemos quando ela realmente mudou — assim editar outro campo não
    // remexe nos itens. Quando muda, a campanha afetada precisa estar ativa
    // (mesma regra de POST /campaigns/:id/items): a campanha dos itens já
    // lançados, ou a ativa quando ainda não há itens.
    let campaignId: number | null = null;
    let rewriteArrecadacao = false;
    if (data.arrecadacao !== undefined) {
      const existingItems = await db
        .select({
          itemName: itensArrecadadosTable.itemName,
          quantity: itensArrecadadosTable.quantity,
          campaignId: itensArrecadadosTable.campaignId,
        })
        .from(itensArrecadadosTable)
        .where(eq(itensArrecadadosTable.registroId, existing.id))
        .orderBy(asc(itensArrecadadosTable.id));

      const fingerprint = (list: Array<{ item: string; quantity: number }>) =>
        list
          .map((i) => `${i.item.trim()}::${i.quantity}`)
          .sort()
          .join("|");
      rewriteArrecadacao =
        fingerprint(data.arrecadacao) !==
        fingerprint(
          existingItems.map((i) => ({ item: i.itemName, quantity: i.quantity })),
        );

      if (rewriteArrecadacao) {
        campaignId = existingItems[0]?.campaignId ?? (await activeCampaignId());
        if (campaignId === null) {
          res.status(400).json({
            error: "Não há campanha ativa para registrar a arrecadação",
          });
          return;
        }
        const [campaign] = await db
          .select({
            status: campanhasTable.status,
            type: campanhasTable.type,
          })
          .from(campanhasTable)
          .where(eq(campanhasTable.id, campaignId));
        if (!campaign || campaign.status !== "active") {
          res.status(400).json({
            error: "Campanha encerrada; não é possível alterar a arrecadação",
          });
          return;
        }
        if (!ITEM_CAMPAIGN_TYPES.includes(campaign.type as "items" | "both")) {
          res.status(400).json({
            error: "A campanha desta arrecadação não recebe itens",
          });
          return;
        }
      }
    }

    // Auxiliary edits send a published registro back to pending
    const isLeader = req.user!.role === "leader";
    const backToPending = !isLeader && existing.status === "published";

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (data.eventDate !== undefined) update.eventDate = data.eventDate;
    if (data.albumId !== undefined) update.albumId = data.albumId;
    if (data.notes !== undefined) update.notes = data.notes;
    if (backToPending) {
      update.status = "pending";
      update.approvedBy = null;
    }

    // A substituição das listas relacionadas (presenças, atividades,
    // arrecadação) roda numa transação: sem isso, um insert que falha após o
    // delete deixaria o registro sem as atividades antigas (perda de dados).
    let registro: RegistroEncontro;
    try {
      registro = await db.transaction(async (tx) => {
        const [reg] = await tx
          .update(registrosEncontroTable)
          .set(update)
          .where(eq(registrosEncontroTable.id, existing.id))
          .returning();

        const guestIds = await createGuests(data.novosConvidados ?? [], tx);
        if (data.presentes !== undefined) {
          await tx
            .delete(presencasRegistroTable)
            .where(eq(presencasRegistroTable.registroId, reg.id));
          const presentIds = Array.from(
            new Set([...data.presentes, ...guestIds]),
          );
          if (presentIds.length > 0) {
            await tx.insert(presencasRegistroTable).values(
              presentIds.map((userId) => ({
                registroId: reg.id,
                userId,
              })),
            );
          }
        } else if (guestIds.length > 0) {
          await tx
            .insert(presencasRegistroTable)
            .values(guestIds.map((userId) => ({ registroId: reg.id, userId })))
            .onConflictDoNothing();
        }

        if (data.atividades !== undefined) {
          await tx
            .delete(atividadesRegistroTable)
            .where(eq(atividadesRegistroTable.registroId, reg.id));
          if (atividades.length > 0) {
            await tx.insert(atividadesRegistroTable).values(
              atividades.map((a) => ({
                registroId: reg.id,
                atividadeId: a.atividadeId ?? null,
                name: a.name,
                responsavelId: a.responsavelId ?? null,
                durationMin: a.durationMin ?? null,
              })),
            );
          }
        }

        if (rewriteArrecadacao && data.arrecadacao !== undefined) {
          await tx
            .delete(itensArrecadadosTable)
            .where(eq(itensArrecadadosTable.registroId, reg.id));
          if (data.arrecadacao.length > 0 && campaignId !== null) {
            await tx.insert(itensArrecadadosTable).values(
              data.arrecadacao.map((i) => ({
                campaignId: campaignId!,
                registroId: reg.id,
                itemName: i.item,
                quantity: i.quantity,
                registeredBy: req.user!.id,
              })),
            );
          }
        }

        return reg;
      });
    } catch (err) {
      req.log.error({ err }, "Falha ao atualizar registro de encontro");
      res.status(500).json({ error: "Não foi possível atualizar o registro" });
      return;
    }

    if (registro.status === "pending") {
      // Ao voltar a pendente, os líderes são notificados. Numa edição de
      // registro que já estava pendente, só atualizamos o aviso do mural (a
      // data faz parte do texto) — sem notificar de novo a cada ajuste.
      void notifyRegistroPendente(
        {
          id: registro.id,
          seq: registro.seq,
          eventDate: registro.eventDate,
        },
        { notifyLeaders: backToPending },
      );
    }

    res.json(await registroDetail(registro));
  },
);

router.post(
  "/registros/:id/approve",
  requireAuth,
  async (req: AuthedRequest, res): Promise<void> => {
    if (req.user!.role !== "leader") {
      res.status(403).json({ error: "Apenas o líder pode aprovar registros" });
      return;
    }
    const params = ApproveRegistroParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [registro] = await db
      .update(registrosEncontroTable)
      .set({ status: "published", approvedBy: req.user!.id })
      .where(
        and(
          eq(registrosEncontroTable.id, params.data.id),
          eq(registrosEncontroTable.status, "pending"),
        ),
      )
      .returning();
    if (!registro) {
      res
        .status(404)
        .json({ error: "Registro não encontrado ou já publicado" });
      return;
    }
    void removeRegistroPendingAviso(registro.id);
    res.json(await registroDetail(registro));
  },
);

router.delete(
  "/registros/:id",
  requireAuth,
  async (req: AuthedRequest, res): Promise<void> => {
    if (req.user!.role !== "leader") {
      res.status(403).json({ error: "Apenas o líder pode excluir registros" });
      return;
    }
    const params = DeleteRegistroParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    // Os itens lançados por este registro saem junto. A FK é `set null`, e
    // `registroId` nulo significa "lançado direto na campanha" — deixá-los
    // para trás os disfarçaria de lançamento direto, sem rastro do encontro,
    // ainda somando nos totais e relatórios da campanha.
    await db.transaction(async (tx) => {
      await tx
        .delete(itensArrecadadosTable)
        .where(eq(itensArrecadadosTable.registroId, params.data.id));
      await tx
        .delete(registrosEncontroTable)
        .where(eq(registrosEncontroTable.id, params.data.id));
    });
    void removeRegistroPendingAviso(params.data.id);
    res.json({ ok: true });
  },
);

export default router;

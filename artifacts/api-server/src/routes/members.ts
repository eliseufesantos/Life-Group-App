import { Router, type IRouter } from "express";
import { eq, inArray, desc } from "drizzle-orm";
import {
  db,
  usuariosTable,
  relacoesDiscipuladoTable,
} from "@workspace/db";
import {
  CreateGuestBody,
  UpdateMemberBody,
  UpdateMemberParams,
  GetMemberParams,
  DeleteMemberParams,
  PromoteGuestParams,
  PromoteGuestBody,
  ImportMembersBody,
  ListMembersQueryParams,
} from "@workspace/api-zod";
import { requireAuth, requirePrivileged, isPrivileged, type AuthedRequest } from "../lib/auth";
import { toMember, toDiscipleship, type DiscipleshipRow } from "../lib/mappers";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

async function loadDiscipleships(memberId: number) {
  const rels = await db
    .select()
    .from(relacoesDiscipuladoTable)
    .where(eq(relacoesDiscipuladoTable.disciplerId, memberId));
  const relsAsDisciple = await db
    .select()
    .from(relacoesDiscipuladoTable)
    .where(eq(relacoesDiscipuladoTable.discipleId, memberId));

  const all = [...rels, ...relsAsDisciple];
  const ids = Array.from(
    new Set(
      all
        .flatMap((r) => [r.disciplerId, r.discipleId])
        .filter((id): id is number => id !== null),
    ),
  );
  const names = new Map<number, string>();
  if (ids.length > 0) {
    const people = await db
      .select({ id: usuariosTable.id, name: usuariosTable.name })
      .from(usuariosTable)
      .where(inArray(usuariosTable.id, ids));
    for (const p of people) names.set(p.id, p.name);
  }
  const map = (r: (typeof all)[number]): DiscipleshipRow => ({
    rel: r,
    names,
  });
  return {
    disciples: rels.map(map).map(toDiscipleship),
    disciplers: relsAsDisciple.map(map).map(toDiscipleship),
  };
}

router.get("/members", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = ListMembersQueryParams.safeParse(req.query);
  const status = params.success ? params.data.status : undefined;
  const privileged = isPrivileged(req.user);

  const rows = await db
    .select()
    .from(usuariosTable)
    .orderBy(desc(usuariosTable.createdAt));

  const filtered = rows.filter((u) => {
    if (status === "member") return u.status !== "guest";
    if (status === "guest") return u.status === "guest";
    return true;
  });

  // O próprio membro sempre vê os próprios dados restritos (incl. nascimento).
  res.json(
    filtered.map((u) => toMember(u, privileged || u.id === req.user!.id)),
  );
});

router.get("/members/stats", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(usuariosTable);
  const totalMembers = rows.filter((u) => u.status !== "guest").length;
  const totalGuests = rows.filter((u) => u.status === "guest").length;
  const totalDisciplers = rows.filter((u) =>
    (u.categories ?? []).includes("discipler"),
  ).length;
  const totalHosts = rows.filter((u) =>
    (u.categories ?? []).includes("host"),
  ).length;
  const denom = totalMembers + totalGuests;
  const conversionRate = denom > 0 ? Math.round((totalMembers / denom) * 100) : 0;
  res.json({
    totalMembers,
    totalGuests,
    totalDisciplers,
    totalHosts,
    conversionRate,
  });
});

router.post(
  "/members",
  requireAuth,
  requirePrivileged,
  async (req, res): Promise<void> => {
    const parsed = CreateGuestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [guest] = await db
      .insert(usuariosTable)
      .values({
        name: parsed.data.name,
        phone: parsed.data.phone ?? null,
        invitedBy: parsed.data.invitedBy ?? null,
        status: "guest",
        role: null,
      })
      .returning();
    res.status(201).json(toMember(guest, true));
  },
);

router.post(
  "/members/import",
  requireAuth,
  requirePrivileged,
  async (req, res): Promise<void> => {
    const parsed = ImportMembersBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    let imported = 0;
    let skipped = 0;
    for (const row of parsed.data.rows) {
      const email = row.email?.trim().toLowerCase() || null;
      if (email) {
        const [existing] = await db
          .select()
          .from(usuariosTable)
          .where(eq(usuariosTable.email, email));
        if (existing) {
          skipped++;
          continue;
        }
      }
      await db.insert(usuariosTable).values({
        name: row.name,
        email,
        phone: row.phone ?? null,
        formationTrack: row.formationTrack ?? null,
        status: "member",
        role: "member",
        joinedAt: new Date(),
      });
      imported++;
    }
    res.json({ imported, skipped });
  },
);

router.get("/members/:id", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = GetMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [member] = await db
    .select()
    .from(usuariosTable)
    .where(eq(usuariosTable.id, params.data.id));
  if (!member) {
    res.status(404).json({ error: "Membro nao encontrado" });
    return;
  }
  const privileged = isPrivileged(req.user);
  const { disciples, disciplers } = await loadDiscipleships(member.id);
  const canSeePrivate = privileged || member.id === req.user!.id;
  res.json({ ...toMember(member, canSeePrivate), disciples, disciplers });
});

router.patch(
  "/members/:id",
  requireAuth,
  async (req: AuthedRequest, res): Promise<void> => {
    const params = UpdateMemberParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    // Self-service exception: a non-privileged user may update ONLY their own
    // profile photo and/or birth date. The body must contain only fields from
    // the self-editable allowlist; anything else (or someone else's id) keeps
    // the 403 as before.
    const SELF_EDITABLE_FIELDS = new Set(["avatarPath", "birthDate"]);
    if (!isPrivileged(req.user)) {
      const isSelf = req.user!.id === params.data.id;
      const bodyKeys = Object.keys((req.body ?? {}) as Record<string, unknown>);
      const onlySelfEditable =
        bodyKeys.length > 0 &&
        bodyKeys.every((k) => SELF_EDITABLE_FIELDS.has(k));
      if (!isSelf || !onlySelfEditable) {
        res.status(403).json({ error: "Acesso restrito a lideres e auxiliares" });
        return;
      }
    }
    const parsed = UpdateMemberBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const data = parsed.data;

    const [target] = await db
      .select()
      .from(usuariosTable)
      .where(eq(usuariosTable.id, params.data.id));
    if (!target) {
      res.status(404).json({ error: "Membro nao encontrado" });
      return;
    }
    // Guests never receive a role, categories or formation track
    if (
      target.status === "guest" &&
      (data.role !== undefined ||
        (data.categories !== undefined && data.categories.length > 0) ||
        (data.formationTrack !== undefined && data.formationTrack !== ""))
    ) {
      res.status(400).json({
        error:
          "Convidado não pode receber função, categoria ou trilha de formação",
      });
      return;
    }

    // As telas enviam o formulário inteiro, então um campo apenas presente não
    // significa alteração: as restrições abaixo valem para mudanças reais, ou
    // um auxiliar não conseguiria editar nada e o líder não editaria o próprio
    // perfil.
    const nextEmail =
      data.email !== undefined ? data.email.trim().toLowerCase() || null : undefined;
    const roleChanged = data.role !== undefined && data.role !== target.role;
    const emailChanged = nextEmail !== undefined && nextEmail !== target.email;

    // Only the leader assigns roles, and nobody changes their own role
    // (an auxiliary could otherwise self-promote to leader).
    if (roleChanged) {
      if (req.user!.role !== "leader") {
        res.status(403).json({ error: "Apenas o líder pode alterar papéis" });
        return;
      }
      if (params.data.id === req.user!.id) {
        res
          .status(403)
          .json({ error: "Não é possível alterar o próprio papel" });
        return;
      }
    }
    // Only the leader changes an e-mail — it is the magic-link login channel,
    // so an auxiliary editing it would be an account-takeover vector.
    if (emailChanged && req.user!.role !== "leader") {
      res.status(403).json({ error: "Apenas o líder pode alterar e-mail" });
      return;
    }

    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (nextEmail !== undefined) update.email = nextEmail;
    if (data.phone !== undefined) update.phone = data.phone || null;
    if (data.role !== undefined) update.role = data.role;
    if (data.categories !== undefined) update.categories = data.categories;
    if (data.formationTrack !== undefined)
      update.formationTrack = data.formationTrack || null;
    if (data.birthDate !== undefined) update.birthDate = data.birthDate || null;
    if (data.avatarPath !== undefined) {
      const raw = data.avatarPath?.trim() ?? "";
      if (raw === "") {
        update.avatarPath = null;
      } else if (!raw.startsWith("/objects/")) {
        res.status(400).json({ error: "avatarPath inválido" });
        return;
      } else {
        // Grant read access to the uploaded object, or GET /api/storage 403s
        // and the avatar never loads. Owner is the profile being edited.
        try {
          await objectStorageService.trySetObjectEntityAclPolicy(raw, {
            owner: String(params.data.id),
            visibility: "public",
          });
        } catch (error) {
          req.log.error({ err: error }, "Falha ao definir ACL do avatar");
          res
            .status(400)
            .json({ error: "Objeto não encontrado no armazenamento" });
          return;
        }
        update.avatarPath = raw;
      }
    }
    if (data.active !== undefined) update.active = data.active;

    const [member] = await db
      .update(usuariosTable)
      .set(update)
      .where(eq(usuariosTable.id, params.data.id))
      .returning();
    if (!member) {
      res.status(404).json({ error: "Membro nao encontrado" });
      return;
    }
    const { disciples, disciplers } = await loadDiscipleships(member.id);
    res.json({ ...toMember(member, true), disciples, disciplers });
  },
);

router.post(
  "/members/:id/promote",
  requireAuth,
  requirePrivileged,
  async (req, res): Promise<void> => {
    const params = PromoteGuestParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = PromoteGuestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const email = parsed.data.email.trim().toLowerCase();
    const [target] = await db
      .select({ status: usuariosTable.status })
      .from(usuariosTable)
      .where(eq(usuariosTable.id, params.data.id));
    if (!target) {
      res.status(404).json({ error: "Convidado nao encontrado" });
      return;
    }
    // Only guests can be promoted — otherwise this endpoint could rewrite an
    // existing member/leader's email and role (account-takeover vector).
    if (target.status !== "guest") {
      res
        .status(400)
        .json({ error: "Apenas convidados podem ser promovidos" });
      return;
    }
    const [member] = await db
      .update(usuariosTable)
      .set({
        status: "member",
        role: "member",
        email,
        joinedAt: new Date(),
      })
      .where(eq(usuariosTable.id, params.data.id))
      .returning();
    if (!member) {
      res.status(404).json({ error: "Convidado nao encontrado" });
      return;
    }
    const { disciples, disciplers } = await loadDiscipleships(member.id);
    res.json({ ...toMember(member, true), disciples, disciplers });
  },
);

router.delete(
  "/members/:id",
  requireAuth,
  requirePrivileged,
  async (req, res): Promise<void> => {
    const params = DeleteMemberParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    await db.delete(usuariosTable).where(eq(usuariosTable.id, params.data.id));
    res.json({ ok: true });
  },
);

export default router;

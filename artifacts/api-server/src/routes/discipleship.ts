import { Router, type IRouter } from "express";
import { eq, inArray, desc } from "drizzle-orm";
import { db, usuariosTable, relacoesDiscipuladoTable } from "@workspace/db";
import {
  CreateDiscipleshipBody,
  UpdateDiscipleshipBody,
  UpdateDiscipleshipParams,
  DeleteDiscipleshipParams,
} from "@workspace/api-zod";
import { requireAuth, requirePrivileged } from "../lib/auth";
import { toDiscipleship, type DiscipleshipRow } from "../lib/mappers";

const router: IRouter = Router();

async function nameMap(ids: number[]): Promise<Map<number, string>> {
  const names = new Map<number, string>();
  if (ids.length === 0) return names;
  const people = await db
    .select({ id: usuariosTable.id, name: usuariosTable.name })
    .from(usuariosTable)
    .where(inArray(usuariosTable.id, ids));
  for (const p of people) names.set(p.id, p.name);
  return names;
}

router.get("/discipleship", requireAuth, async (_req, res): Promise<void> => {
  const rels = await db
    .select()
    .from(relacoesDiscipuladoTable)
    .orderBy(desc(relacoesDiscipuladoTable.createdAt));
  const ids = Array.from(
    new Set(rels.flatMap((r) => [r.disciplerId, r.discipleId])),
  );
  const names = await nameMap(ids);
  res.json(
    rels.map((rel) =>
      toDiscipleship({
        rel,
        disciplerName: names.get(rel.disciplerId) ?? "",
        discipleName: names.get(rel.discipleId) ?? "",
      } satisfies DiscipleshipRow),
    ),
  );
});

router.post(
  "/discipleship",
  requireAuth,
  requirePrivileged,
  async (req, res): Promise<void> => {
    const parsed = CreateDiscipleshipBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { disciplerId, discipleId, notes } = parsed.data;
    if (disciplerId === discipleId) {
      res.status(400).json({ error: "Discipulador e discipulo devem ser diferentes" });
      return;
    }
    const [rel] = await db
      .insert(relacoesDiscipuladoTable)
      .values({
        disciplerId,
        discipleId,
        notes: notes ?? null,
        startDate: new Date().toISOString().slice(0, 10),
        status: "active",
      })
      .returning();
    const names = await nameMap([disciplerId, discipleId]);
    res.status(201).json(
      toDiscipleship({
        rel,
        disciplerName: names.get(disciplerId) ?? "",
        discipleName: names.get(discipleId) ?? "",
      }),
    );
  },
);

router.patch(
  "/discipleship/:id",
  requireAuth,
  requirePrivileged,
  async (req, res): Promise<void> => {
    const params = UpdateDiscipleshipParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateDiscipleshipBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const update: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) update.status = parsed.data.status;
    if (parsed.data.notes !== undefined) update.notes = parsed.data.notes || null;

    const [rel] = await db
      .update(relacoesDiscipuladoTable)
      .set(update)
      .where(eq(relacoesDiscipuladoTable.id, params.data.id))
      .returning();
    if (!rel) {
      res.status(404).json({ error: "Relacao nao encontrada" });
      return;
    }
    const names = await nameMap([rel.disciplerId, rel.discipleId]);
    res.json(
      toDiscipleship({
        rel,
        disciplerName: names.get(rel.disciplerId) ?? "",
        discipleName: names.get(rel.discipleId) ?? "",
      }),
    );
  },
);

router.delete(
  "/discipleship/:id",
  requireAuth,
  requirePrivileged,
  async (req, res): Promise<void> => {
    const params = DeleteDiscipleshipParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    await db
      .delete(relacoesDiscipuladoTable)
      .where(eq(relacoesDiscipuladoTable.id, params.data.id));
    res.json({ ok: true });
  },
);

export default router;

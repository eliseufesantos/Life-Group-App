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
import { toDiscipleship } from "../lib/mappers";

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

interface Side {
  id: number | null;
  externalName: string | null;
}

/**
 * Each side of the relationship must be exactly one of: an internal member id
 * or a free-text external name. At least one side must be internal, and
 * internal participants cannot be guests. Returns an error message or null.
 */
async function validateSides(
  discipler: Side,
  disciple: Side,
): Promise<string | null> {
  const sideError = (label: string, side: Side): string | null => {
    if (side.id !== null && side.externalName !== null) {
      return `Informe apenas o membro interno OU o nome externo do ${label}`;
    }
    if (side.id === null && side.externalName === null) {
      return `Informe o membro interno ou o nome externo do ${label}`;
    }
    return null;
  };
  const error =
    sideError("discipulador", discipler) ?? sideError("discípulo", disciple);
  if (error) return error;
  if (discipler.id === null && disciple.id === null) {
    return "Pelo menos um lado deve ser um membro do Life Group";
  }
  if (discipler.id !== null && discipler.id === disciple.id) {
    return "Discipulador e discipulo devem ser diferentes";
  }
  const internalIds = [discipler.id, disciple.id].filter(
    (id): id is number => id !== null,
  );
  const people = await db
    .select({ id: usuariosTable.id, status: usuariosTable.status })
    .from(usuariosTable)
    .where(inArray(usuariosTable.id, internalIds));
  for (const id of internalIds) {
    const person = people.find((p) => p.id === id);
    if (!person) return "Membro nao encontrado";
    if (person.status === "guest") {
      return "Convidado não pode participar de discipulado";
    }
  }
  return null;
}

router.get("/discipleship", requireAuth, async (_req, res): Promise<void> => {
  const rels = await db
    .select()
    .from(relacoesDiscipuladoTable)
    .orderBy(desc(relacoesDiscipuladoTable.createdAt));
  const names = await nameMap(
    rels.flatMap((r) => [r.disciplerId, r.discipleId]),
  );
  res.json(rels.map((rel) => toDiscipleship({ rel, names })));
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
    const data = parsed.data;
    const discipler: Side = {
      id: data.disciplerId ?? null,
      externalName: data.externalDisciplerName ?? null,
    };
    const disciple: Side = {
      id: data.discipleId ?? null,
      externalName: data.externalDiscipleName ?? null,
    };
    const error = await validateSides(discipler, disciple);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const [rel] = await db
      .insert(relacoesDiscipuladoTable)
      .values({
        disciplerId: discipler.id,
        discipleId: disciple.id,
        externalDisciplerName: discipler.externalName,
        externalDiscipleName: disciple.externalName,
        notes: data.notes ?? null,
        startDate: new Date().toISOString().slice(0, 10),
        status: "active",
      })
      .returning();
    const names = await nameMap([rel.disciplerId, rel.discipleId]);
    res.status(201).json(toDiscipleship({ rel, names }));
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
    const data = parsed.data;

    const [existing] = await db
      .select()
      .from(relacoesDiscipuladoTable)
      .where(eq(relacoesDiscipuladoTable.id, params.data.id));
    if (!existing) {
      res.status(404).json({ error: "Relacao nao encontrada" });
      return;
    }

    const disciplerChanged =
      data.disciplerId !== undefined ||
      data.externalDisciplerName !== undefined;
    const discipleChanged =
      data.discipleId !== undefined || data.externalDiscipleName !== undefined;

    // Resulting sides after applying the update
    const discipler: Side = disciplerChanged
      ? {
          id: data.disciplerId ?? null,
          externalName: data.externalDisciplerName ?? null,
        }
      : {
          id: existing.disciplerId,
          externalName: existing.externalDisciplerName,
        };
    const disciple: Side = discipleChanged
      ? {
          id: data.discipleId ?? null,
          externalName: data.externalDiscipleName ?? null,
        }
      : {
          id: existing.discipleId,
          externalName: existing.externalDiscipleName,
        };
    if (disciplerChanged || discipleChanged) {
      const error = await validateSides(discipler, disciple);
      if (error) {
        res.status(400).json({ error });
        return;
      }
    }

    const update: Record<string, unknown> = {};
    if (disciplerChanged) {
      update.disciplerId = discipler.id;
      update.externalDisciplerName = discipler.externalName;
    }
    if (discipleChanged) {
      update.discipleId = disciple.id;
      update.externalDiscipleName = disciple.externalName;
    }
    if (data.status !== undefined) update.status = data.status;
    if (data.notes !== undefined) update.notes = data.notes || null;

    if (Object.keys(update).length === 0) {
      const names = await nameMap([existing.disciplerId, existing.discipleId]);
      res.json(toDiscipleship({ rel: existing, names }));
      return;
    }

    const [rel] = await db
      .update(relacoesDiscipuladoTable)
      .set(update)
      .where(eq(relacoesDiscipuladoTable.id, params.data.id))
      .returning();
    const names = await nameMap([rel.disciplerId, rel.discipleId]);
    res.json(toDiscipleship({ rel, names }));
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

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, configuracaoCelulaTable } from "@workspace/db";
import { UpdateCellConfigBody } from "@workspace/api-zod";
import {
  requireAuth,
  requirePrivileged,
  type AuthedRequest,
} from "../lib/auth";

const router: IRouter = Router();

router.get("/cell", requireAuth, async (_req, res): Promise<void> => {
  const [config] = await db.select().from(configuracaoCelulaTable).limit(1);
  if (!config) {
    res.json({ name: "Life Group", photoUrl: null, updatedAt: null });
    return;
  }
  res.json({
    name: config.name,
    photoUrl: config.photoUrl,
    updatedAt: config.updatedAt.toISOString(),
  });
});

router.put(
  "/cell",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const parsed = UpdateCellConfigBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [existing] = await db.select().from(configuracaoCelulaTable).limit(1);
    let config;
    if (existing) {
      [config] = await db
        .update(configuracaoCelulaTable)
        .set({
          name: parsed.data.name,
          photoUrl: parsed.data.photoUrl ?? null,
        })
        .where(eq(configuracaoCelulaTable.id, existing.id))
        .returning();
    } else {
      [config] = await db
        .insert(configuracaoCelulaTable)
        .values({
          name: parsed.data.name,
          photoUrl: parsed.data.photoUrl ?? null,
        })
        .returning();
    }
    res.json({
      name: config.name,
      photoUrl: config.photoUrl,
      updatedAt: config.updatedAt.toISOString(),
    });
  },
);

export default router;

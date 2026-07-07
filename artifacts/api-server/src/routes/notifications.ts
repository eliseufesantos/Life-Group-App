import { Router, type IRouter } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, notificacoesTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../lib/auth";

const router: IRouter = Router();

router.get(
  "/notifications",
  requireAuth,
  async (req: AuthedRequest, res): Promise<void> => {
    const rows = await db
      .select()
      .from(notificacoesTable)
      .where(eq(notificacoesTable.userId, req.user!.id))
      .orderBy(desc(notificacoesTable.createdAt))
      .limit(50);
    res.json(
      rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
        read: n.readAt !== null,
        createdAt: n.createdAt.toISOString(),
      })),
    );
  },
);

router.post(
  "/notifications/read-all",
  requireAuth,
  async (req: AuthedRequest, res): Promise<void> => {
    await db
      .update(notificacoesTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificacoesTable.userId, req.user!.id),
          isNull(notificacoesTable.readAt),
        ),
      );
    res.json({ ok: true });
  },
);

export default router;

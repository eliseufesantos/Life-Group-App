import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, subscricoesPushTable } from "@workspace/db";
import { SubscribePushBody, UnsubscribePushBody } from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { getVapidKeys } from "../lib/push";

const router: IRouter = Router();

router.get(
  "/push/public-key",
  requireAuth,
  async (_req, res): Promise<void> => {
    const keys = await getVapidKeys();
    res.json({ publicKey: keys.publicKey });
  },
);

router.post(
  "/push/subscribe",
  requireAuth,
  async (req: AuthedRequest, res): Promise<void> => {
    const parsed = SubscribePushBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    await db
      .insert(subscricoesPushTable)
      .values({
        userId: req.user!.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.p256dh,
        auth: parsed.data.auth,
      })
      .onConflictDoUpdate({
        target: subscricoesPushTable.endpoint,
        set: {
          userId: req.user!.id,
          p256dh: parsed.data.p256dh,
          auth: parsed.data.auth,
        },
      });
    res.json({ ok: true });
  },
);

router.post(
  "/push/unsubscribe",
  requireAuth,
  async (req: AuthedRequest, res): Promise<void> => {
    const parsed = UnsubscribePushBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    await db
      .delete(subscricoesPushTable)
      .where(
        and(
          eq(subscricoesPushTable.userId, req.user!.id),
          eq(subscricoesPushTable.endpoint, parsed.data.endpoint),
        ),
      );
    res.json({ ok: true });
  },
);

export default router;

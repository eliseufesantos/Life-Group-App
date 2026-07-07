import webpush from "web-push";
import { eq, inArray, and, ne } from "drizzle-orm";
import {
  db,
  chavesVapidTable,
  subscricoesPushTable,
  notificacoesTable,
  usuariosTable,
} from "@workspace/db";
import { logger } from "./logger";

let cachedKeys: { publicKey: string; privateKey: string } | null = null;

export async function getVapidKeys(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  if (cachedKeys) return cachedKeys;
  const [existing] = await db.select().from(chavesVapidTable).limit(1);
  if (existing) {
    cachedKeys = {
      publicKey: existing.publicKey,
      privateKey: existing.privateKey,
    };
    return cachedKeys;
  }
  const generated = webpush.generateVAPIDKeys();
  const [row] = await db
    .insert(chavesVapidTable)
    .values({ publicKey: generated.publicKey, privateKey: generated.privateKey })
    .onConflictDoNothing()
    .returning();
  if (row) {
    cachedKeys = { publicKey: row.publicKey, privateKey: row.privateKey };
    return cachedKeys;
  }
  // Another instance created the keypair concurrently; use the stored one
  const [winner] = await db.select().from(chavesVapidTable).limit(1);
  cachedKeys = { publicKey: winner.publicKey, privateKey: winner.privateKey };
  return cachedKeys;
}

export interface PushPayload {
  title: string;
  body?: string;
  link?: string;
}

async function sendToSubscriptions(
  subs: Array<{
    id: number;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>,
  payload: PushPayload,
): Promise<void> {
  if (subs.length === 0) return;
  const keys = await getVapidKeys();
  const subject = "mailto:no-reply@lifegroup.app";
  const body = JSON.stringify(payload);
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          {
            vapidDetails: {
              subject,
              publicKey: keys.publicKey,
              privateKey: keys.privateKey,
            },
            TTL: 60 * 60 * 24,
          },
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription expired or unsubscribed: clean up
          await db
            .delete(subscricoesPushTable)
            .where(eq(subscricoesPushTable.id, sub.id));
        } else {
          logger.warn({ err, endpoint: sub.endpoint }, "Push send failed");
        }
      }
    }),
  );
}

/**
 * Create in-app notifications and send web push to the given users.
 * If userIds is null, notify all active members (excluding excludeUserId).
 */
export async function notifyUsers(options: {
  userIds: number[] | null;
  excludeUserId?: number;
  type: "event" | "task" | "announcement";
  title: string;
  body?: string;
  link?: string;
}): Promise<void> {
  try {
    let targets: number[];
    if (options.userIds !== null) {
      targets = options.userIds.filter((id) => id !== options.excludeUserId);
    } else {
      const conditions = [
        eq(usuariosTable.active, true),
        eq(usuariosTable.status, "member"),
      ];
      if (options.excludeUserId !== undefined) {
        conditions.push(ne(usuariosTable.id, options.excludeUserId));
      }
      const rows = await db
        .select({ id: usuariosTable.id })
        .from(usuariosTable)
        .where(and(...conditions));
      targets = rows.map((r) => r.id);
    }
    if (targets.length === 0) return;

    await db.insert(notificacoesTable).values(
      targets.map((userId) => ({
        userId,
        type: options.type,
        title: options.title,
        body: options.body ?? null,
        link: options.link ?? null,
      })),
    );

    const subs = await db
      .select()
      .from(subscricoesPushTable)
      .where(inArray(subscricoesPushTable.userId, targets));
    await sendToSubscriptions(subs, {
      title: options.title,
      body: options.body,
      link: options.link,
    });
  } catch (err) {
    logger.error({ err }, "Failed to fan out notifications");
  }
}

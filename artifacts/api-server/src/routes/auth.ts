import { Router, type IRouter } from "express";
import { eq, and, gt, isNull, desc } from "drizzle-orm";
import {
  db,
  usuariosTable,
  convitesTable,
  magicLinksTable,
} from "@workspace/db";
import {
  RegisterWithInviteBody,
  RequestMagicLinkBody,
  VerifyMagicLinkBody,
  ValidateInviteParams,
} from "@workspace/api-zod";
import {
  requireAuth,
  requirePrivileged,
  generateToken,
  createSession,
  deleteSession,
  setSessionCookie,
  clearSessionCookie,
  getUserFromRequest,
  SESSION_COOKIE,
  type AuthedRequest,
} from "../lib/auth";
import { toCurrentUser } from "../lib/mappers";
import {
  sendMagicLinkEmail,
  magicLinkUrl,
  includeDevLink,
} from "../lib/email";

const router: IRouter = Router();

const MAGIC_LINK_TTL_MIN = 30;
const INVITE_TTL_HOURS = 24;

function inviteCode(): string {
  return generateToken(6).toUpperCase();
}

async function issueMagicLink(
  userId: number,
  email: string,
  name: string,
): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MIN * 60 * 1000);
  await db.insert(magicLinksTable).values({ token, userId, expiresAt });
  await sendMagicLinkEmail(email, name, token);
  return token;
}

router.get("/auth/me", async (req: AuthedRequest, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Nao autenticado" });
    return;
  }
  res.json(toCurrentUser(user));
});

router.get(
  "/auth/invites",
  requireAuth,
  requirePrivileged,
  async (_req, res): Promise<void> => {
    const rows = await db
      .select()
      .from(convitesTable)
      .orderBy(desc(convitesTable.createdAt));
    res.json(
      rows.map((c) => ({
        id: c.id,
        code: c.code,
        createdAt: c.createdAt.toISOString(),
        expiresAt: c.expiresAt.toISOString(),
        used: c.usedAt !== null,
      })),
    );
  },
);

router.post(
  "/auth/invites",
  requireAuth,
  requirePrivileged,
  async (req: AuthedRequest, res): Promise<void> => {
    const code = inviteCode();
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);
    const [invite] = await db
      .insert(convitesTable)
      .values({ code, expiresAt, createdBy: req.user?.id ?? null })
      .returning();
    res.status(201).json({
      id: invite.id,
      code: invite.code,
      createdAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt.toISOString(),
      used: false,
    });
  },
);

router.get("/auth/invites/:code", async (req, res): Promise<void> => {
  const params = ValidateInviteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [invite] = await db
    .select()
    .from(convitesTable)
    .where(
      and(
        eq(convitesTable.code, params.data.code),
        isNull(convitesTable.usedAt),
        gt(convitesTable.expiresAt, new Date()),
      ),
    );
  if (!invite) {
    res.status(404).json({ error: "Convite invalido ou expirado" });
    return;
  }
  res.json({ valid: true });
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterWithInviteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { code, name, email, phone } = parsed.data;

  const [invite] = await db
    .update(convitesTable)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(convitesTable.code, code),
        isNull(convitesTable.usedAt),
        gt(convitesTable.expiresAt, new Date()),
      ),
    )
    .returning();
  if (!invite) {
    res.status(400).json({ error: "Convite invalido ou expirado" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const [existing] = await db
    .select()
    .from(usuariosTable)
    .where(eq(usuariosTable.email, normalizedEmail));

  let userId: number;
  let displayName: string;
  if (existing) {
    userId = existing.id;
    displayName = existing.name;
    await db
      .update(usuariosTable)
      .set({ status: "member", role: existing.role ?? "member", active: true })
      .where(eq(usuariosTable.id, existing.id));
  } else {
    const [created] = await db
      .insert(usuariosTable)
      .values({
        name,
        email: normalizedEmail,
        phone: phone ?? null,
        status: "member",
        role: "member",
        joinedAt: new Date(),
      })
      .returning();
    userId = created.id;
    displayName = created.name;
  }

  const token = await issueMagicLink(userId, normalizedEmail, displayName);
  res.json({
    sent: true,
    devLink: includeDevLink ? magicLinkUrl(token) : null,
  });
});

router.post("/auth/magic-link", async (req, res): Promise<void> => {
  const parsed = RequestMagicLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(usuariosTable)
    .where(eq(usuariosTable.email, normalizedEmail));

  if (user && user.active) {
    const token = await issueMagicLink(user.id, normalizedEmail, user.name);
    res.json({
      sent: true,
      devLink: includeDevLink ? magicLinkUrl(token) : null,
    });
    return;
  }
  res.json({ sent: true, devLink: null });
});

router.post("/auth/verify", async (req, res): Promise<void> => {
  const parsed = VerifyMagicLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [link] = await db
    .update(magicLinksTable)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(magicLinksTable.token, parsed.data.token),
        isNull(magicLinksTable.usedAt),
        gt(magicLinksTable.expiresAt, new Date()),
      ),
    )
    .returning();
  if (!link) {
    res.status(400).json({ error: "Link invalido ou expirado" });
    return;
  }

  const [user] = await db
    .select()
    .from(usuariosTable)
    .where(eq(usuariosTable.id, link.userId));
  if (!user || !user.active) {
    res.status(400).json({ error: "Usuario nao encontrado" });
    return;
  }

  const sessionId = await createSession(user.id);
  setSessionCookie(res, sessionId);
  res.json(toCurrentUser(user));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const cookies = (req as AuthedRequest & { cookies?: Record<string, string> })
    .cookies;
  const sessionId = cookies?.[SESSION_COOKIE];
  if (sessionId) {
    await deleteSession(sessionId);
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});

export default router;

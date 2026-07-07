import { randomBytes } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db, sessoesTable, usuariosTable, type Usuario } from "@workspace/db";

export const SESSION_COOKIE = "lg_session";
const SESSION_TTL_DAYS = 30;

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export async function createSession(userId: number): Promise<string> {
  const id = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessoesTable).values({ id, userId, expiresAt });
  return id;
}

export async function deleteSession(id: string): Promise<void> {
  await db.delete(sessoesTable).where(eq(sessoesTable.id, id));
}

export function setSessionCookie(res: Response, id: string): void {
  res.cookie(SESSION_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export async function getUserFromRequest(req: Request): Promise<Usuario | null> {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  const sessionId = cookies?.[SESSION_COOKIE];
  if (!sessionId) return null;

  const [session] = await db
    .select()
    .from(sessoesTable)
    .where(
      and(eq(sessoesTable.id, sessionId), gt(sessoesTable.expiresAt, new Date())),
    );
  if (!session) return null;

  const [user] = await db
    .select()
    .from(usuariosTable)
    .where(eq(usuariosTable.id, session.userId));
  if (!user || !user.active) return null;

  return user;
}

export interface AuthedRequest extends Request {
  user?: Usuario;
}

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Nao autenticado" });
    return;
  }
  req.user = user;
  next();
}

export function requirePrivileged(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user || (req.user.role !== "leader" && req.user.role !== "auxiliary")) {
    res.status(403).json({ error: "Acesso restrito a lideres e auxiliares" });
    return;
  }
  next();
}

export function isPrivileged(user: Usuario | null | undefined): boolean {
  return !!user && (user.role === "leader" || user.role === "auxiliary");
}

import bcrypt from 'bcryptjs';
import { and, eq, gt, lt } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Me, Role } from '@vv/shared';
import type { Db } from './db/client.ts';
import { sessions, users } from './db/schema.ts';
import { randomToken, sha256 } from './lib/crypto.ts';
import { forbidden, unauthorized } from './lib/errors.ts';

export const SESSION_COOKIE = 'vv_session';
const SESSION_DAYS = 14;

declare module 'fastify' {
  interface FastifyRequest {
    user: Me | null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(db: Db, userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await db.insert(sessions).values({ tokenHash: sha256(token), userId, expiresAt });
  // clean up old sessions here instead of running a cron job
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  return { token, expiresAt };
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
}

export async function loadUserFromSession(db: Db, token: string | undefined): Promise<Me | null> {
  if (!token) return null;
  const [row] = await db
    .select({ id: users.id, email: users.email, role: users.role, name: users.name, city: users.city })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date, secure: boolean): void {
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    expires: expiresAt,
  });
}

// usage: { preHandler: requireRole('admin') }
export function requireRole(...roles: Role[]) {
  return async (req: FastifyRequest) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
  };
}

export function currentUser(req: FastifyRequest): Me {
  if (!req.user) throw unauthorized();
  return req.user;
}

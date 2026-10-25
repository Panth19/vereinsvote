import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { loginSchema, registerClubSchema, type Me } from '@vv/shared';
import {
  SESSION_COOKIE,
  createSession,
  deleteSession,
  hashPassword,
  setSessionCookie,
  verifyPassword,
} from '../auth.ts';
import { users } from '../db/schema.ts';
import type { Deps } from '../deps.ts';
import { HttpError, conflict } from '../lib/errors.ts';

// bcrypt hash of a random string. Checked when the email is unknown, so a
// login takes equally long whether or not the account exists.
const DUMMY_HASH = '$2b$10$jhIr09stTMTZrWmEDDJzBOObhHA1eMntPW2KPyesTgW3Vrikcf4IC';

const publicUser = { id: users.id, email: users.email, role: users.role, name: users.name, city: users.city };

export async function authRoutes(app: FastifyInstance, { db, config }: Deps) {
  const secure = config.env === 'production';

  app.post(
    '/api/auth/register',
    { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const input = registerClubSchema.parse(req.body);
      const [user] = await db
        .insert(users)
        .values({
          email: input.email.toLowerCase(),
          passwordHash: await hashPassword(input.password),
          role: 'club',
          name: input.name,
          city: input.city,
        })
        .onConflictDoNothing({ target: users.email })
        .returning(publicUser);
      if (!user) throw conflict('email_taken', 'Mit dieser E-Mail-Adresse gibt es schon ein Konto');
      const session = await createSession(db, user.id);
      setSessionCookie(reply, session.token, session.expiresAt, secure);
      return reply.code(201).send(user satisfies Me);
    },
  );

  app.post(
    '/api/auth/login',
    { config: { rateLimit: { max: config.loginRateLimitPerMinute, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const input = loginSchema.parse(req.body);
      const [user] = await db.select().from(users).where(eq(users.email, input.email.toLowerCase()));
      const ok = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
      if (!user || !ok) throw new HttpError(401, 'invalid_credentials', 'E-Mail oder Passwort stimmt nicht');
      const session = await createSession(db, user.id);
      setSessionCookie(reply, session.token, session.expiresAt, secure);
      const me: Me = { id: user.id, email: user.email, role: user.role, name: user.name, city: user.city };
      return me;
    },
  );

  app.post('/api/auth/logout', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await deleteSession(db, token);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.code(204).send();
  });

  app.get('/api/auth/me', async (req) => ({ user: req.user }));
}

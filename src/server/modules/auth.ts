import { eq, sql } from 'drizzle-orm';
import { getCookie } from 'hono/cookie';
import { users } from '../db/schema.js';
import type { FileHubModule } from '../core/registry.js';
import {
  AUTH_COOKIE,
  clearAuthCookie,
  hashPassword,
  setAuthCookie,
  signToken,
  verifyPassword,
  verifyToken,
} from '../core/auth.js';
import { badRequest, forbidden, unauthorized } from '../core/errors.js';

function validateCredentials(username: unknown, password: unknown): { username: string; password: string } {
  if (typeof username !== 'string' || username.trim().length < 2 || username.trim().length > 32) {
    throw badRequest('用户名需为 2-32 个字符');
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
    throw badRequest('密码长度需为 6-128 位');
  }
  return { username: username.trim(), password };
}

export const authModule: FileHubModule = {
  name: 'auth',
  register(ctx) {
    const { db, config } = ctx;

    const countUsers = async (): Promise<number> => {
      const rows = await db.select({ n: sql<number>`count(*)::int` }).from(users);
      return rows[0]?.n ?? 0;
    };

    // 当前登录用户（用于页面刷新后恢复会话），无 token 时静默返回 null
    const currentUser = async (c: { req: { header(n: string): string | undefined } }) => {
      const bearer = c.req.header('authorization');
      const token = bearer?.startsWith('Bearer ')
        ? bearer.slice(7)
        : getCookie(c as never, AUTH_COOKIE);
      if (!token) return null;
      return verifyToken(token, config.jwtSecret);
    };

    ctx.app.get('/api/auth/status', async (c) => {
      const initialized = (await countUsers()) > 0;
      const payload = await currentUser(c);
      return c.json({
        initialized,
        user: payload ? { id: payload.sub, name: payload.name, role: payload.role } : null,
      });
    });

    // 首次使用：创建管理员账号（仅当系统无任何用户时可用）
    ctx.app.post('/api/auth/setup', async (c) => {
      if ((await countUsers()) > 0) throw forbidden('系统已初始化，请直接登录');
      const body = await c.req.json().catch(() => null);
      if (!body) throw badRequest('请求体不是合法 JSON');
      const { username, password } = validateCredentials(body.username, body.password);
      const [user] = await db
        .insert(users)
        .values({ username, passwordHash: hashPassword(password), role: 'admin' })
        .returning();
      const token = await signToken(user, config.jwtSecret, config.sessionDays);
      setAuthCookie(c, token, config.sessionDays);
      return c.json({ user: { id: user.id, name: user.username, role: user.role }, token }, 201);
    });

    ctx.app.post('/api/auth/login', async (c) => {
      const body = await c.req.json().catch(() => null);
      if (!body) throw badRequest('请求体不是合法 JSON');
      const { username, password } = validateCredentials(body.username, body.password);
      const [user] = await db.select().from(users).where(eq(users.username, username));
      if (!user || !verifyPassword(password, user.passwordHash)) {
        throw unauthorized('用户名或密码错误');
      }
      const token = await signToken(user, config.jwtSecret, config.sessionDays);
      setAuthCookie(c, token, config.sessionDays);
      return c.json({ user: { id: user.id, name: user.username, role: user.role }, token });
    });

    ctx.app.post('/api/auth/logout', (c) => {
      clearAuthCookie(c);
      return c.json({ ok: true });
    });

    ctx.app.get('/api/auth/me', (c) => {
      const user = c.get('user');
      return c.json({ user: { id: user.sub, name: user.name, role: user.role } });
    });
  },
};

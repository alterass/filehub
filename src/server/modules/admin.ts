import { eq, sql } from 'drizzle-orm';
import { users } from '../db/schema.js';
import type { FileHubModule } from '../core/registry.js';
import { hashPassword } from '../core/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../core/errors.js';

const USERNAME_RE = /^[\w\u4e00-\u9fa5.-]{2,32}$/u;

function validateUsername(raw: unknown): string {
  if (typeof raw !== 'string' || !USERNAME_RE.test(raw.trim())) {
    throw badRequest('用户名需为 2-32 个字符，可含中英文、数字、下划线、点、连字符');
  }
  return raw.trim();
}

function validatePassword(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length < 6 || raw.length > 128) {
    throw badRequest('密码长度需为 6-128 位');
  }
  return raw;
}

function publicUser(row: { id: string; username: string; role: string; createdAt: Date }) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

/** 用户管理（仅管理员）：WebUI 管理页通过这些接口增删用户，避免 CLI 与服务器并发写 PGlite */
export const adminModule: FileHubModule = {
  name: 'admin',
  register(ctx) {
    const { db } = ctx;
    const app = ctx.app;

    app.get('/api/admin/users', async (c) => {
      const rows = await db.select().from(users).orderBy(users.createdAt);
      return c.json({ items: rows.map(publicUser) });
    });

    app.post('/api/admin/users', async (c) => {
      const body = await c.req.json().catch(() => null);
      if (!body) throw badRequest('请求体不是合法 JSON');
      const username = validateUsername(body.username);
      const password = validatePassword(body.password);
      const role = body.role === 'user' ? 'user' : 'admin';
      const [existing] = await db.select().from(users).where(eq(users.username, username));
      if (existing) throw conflict('用户名已存在');
      const [user] = await db.insert(users).values({ username, passwordHash: hashPassword(password), role }).returning();
      return c.json(publicUser(user), 201);
    });

    app.patch('/api/admin/users/:id', async (c) => {
      const id = c.req.param('id');
      const body = await c.req.json().catch(() => null);
      if (!body?.password) throw badRequest('需要提供 password');
      const password = validatePassword(body.password);
      const [updated] = await db
        .update(users)
        .set({ passwordHash: hashPassword(password) })
        .where(eq(users.id, id))
        .returning();
      if (!updated) throw notFound('用户不存在');
      return c.json(publicUser(updated));
    });

    app.delete('/api/admin/users/:id', async (c) => {
      const me = c.get('user');
      const id = c.req.param('id');
      if (id === me.sub) throw forbidden('不能删除当前登录的账号');
      const [target] = await db.select().from(users).where(eq(users.id, id));
      if (!target) throw notFound('用户不存在');
      if (target.role === 'admin') {
        const rows = await db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.role, 'admin'));
        if ((rows[0]?.n ?? 0) <= 1) throw forbidden('至少需要保留一个管理员账号');
      }
      await db.delete(users).where(eq(users.id, id)); // 级联删除其文件节点
      return c.json({ ok: true });
    });
  },
};

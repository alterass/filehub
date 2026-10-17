import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { sign, verify } from 'hono/jwt';
import type { MiddlewareHandler, Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Env } from '../env.js';

export const AUTH_COOKIE = 'filehub_token';

export interface TokenPayload {
  sub: string;
  name: string;
  role: string;
  iat: number;
  exp: number;
}

// ---------- 密码（scrypt，无原生依赖） ----------

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 32);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

// ---------- JWT ----------

export async function signToken(
  user: { id: string; username: string; role: string },
  secret: string,
  sessionDays: number,
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  return sign(
    { sub: user.id, name: user.username, role: user.role, iat, exp: iat + sessionDays * 86400 },
    secret,
  );
}

export async function verifyToken(token: string, secret: string): Promise<TokenPayload | null> {
  try {
    const payload = (await verify(token, secret, 'HS256')) as unknown as TokenPayload;
    if (!payload?.sub) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------- 中间件 ----------

function extractToken(c: Context): string | null {
  const bearer = c.req.header('authorization');
  if (bearer?.startsWith('Bearer ')) return bearer.slice(7);
  return getCookie(c, AUTH_COOKIE) ?? null;
}

/** 要求已登录；通过后 c.get('user') 可取到 TokenPayload */
export function requireAuth(secret: string): MiddlewareHandler<Env> {
  return async (c, next) => {
    const token = extractToken(c);
    const payload = token ? await verifyToken(token, secret) : null;
    if (!payload) {
      return c.json({ error: '未登录或登录已过期' }, 401);
    }
    c.set('user', payload);
    await next();
  };
}

/** 在 requireAuth 之后使用：要求管理员角色 */
export function requireAdmin(): MiddlewareHandler<Env> {
  return async (c, next) => {
    const user = c.get('user');
    if (user?.role !== 'admin') {
      return c.json({ error: '需要管理员权限' }, 403);
    }
    await next();
  };
}

export function setAuthCookie(c: Context, token: string, sessionDays: number): void {
  setCookie(c, AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: sessionDays * 86400,
  });
}

export function clearAuthCookie(c: Context): void {
  deleteCookie(c, AUTH_COOKIE, { path: '/' });
}

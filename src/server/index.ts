import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { mkdirSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import type { PGlite } from '@electric-sql/pglite';
import { loadOrCreateConfig, type FileHubConfig } from './core/config.js';
import { openDatabase, syncAndMigrate, type Db } from './core/database.js';
import { requireAdmin, requireAuth } from './core/auth.js';
import { LocalStorage } from './core/storage.js';
import { EventBus } from './core/events.js';
import { resolvePaths, projectRoot, type AppPaths } from './core/paths.js';
import { initModules, loadExternalModules, type CoreContext } from './core/registry.js';
import { registerBuiltinModules } from './modules/index.js';
import type { Env } from './env.js';

/** 无需登录即可访问的 API 路径 */
const PUBLIC_API = new Set(['/api/health', '/api/auth/status', '/api/auth/login', '/api/auth/setup']);

export interface AppHandle {
  app: Hono<Env>;
  config: FileHubConfig;
  paths: AppPaths;
  pg: PGlite;
  db: Db;
}

export async function startServer(opts: { home?: string; port?: number; host?: string } = {}) {
  const paths = resolvePaths(opts.home);
  mkdirSync(paths.metaDir, { recursive: true });
  mkdirSync(paths.modulesDir, { recursive: true });

  const { config, created } = loadOrCreateConfig(paths, { port: opts.port, host: opts.host });
  if (created) console.log(`[init] 已创建配置 ${paths.configFile}`);

  const { pg, db } = await openDatabase(paths.dataDir);
  const pending = await syncAndMigrate(pg, paths.bundledSqlDir, config.sqlDir);
  if (pending.length) console.log(`[migrate] 应用迁移 ${pending.length} 个`);

  const app = new Hono<Env>();

  app.onError((err, c) => {
    const status = (err as { status?: number }).status ?? 500;
    if (status >= 500) console.error('[server]', err);
    return c.json({ error: err.message || '服务器内部错误' }, status as 500);
  });

  // /api/* 统一鉴权闸门（白名单除外）；管理接口额外要求 admin 角色
  app.use('/api/*', async (c, next) => {
    if (PUBLIC_API.has(c.req.path)) return next();
    return requireAuth(config.jwtSecret)(c, next);
  });
  app.use('/api/admin/*', requireAdmin());

  const services = new Map<string, unknown>();
  const ctx: CoreContext = {
    app,
    pg,
    db,
    config,
    paths,
    storage: new LocalStorage(paths.workDir, paths.metaDir, config.thumbDir),
    bus: new EventBus(),
    provide: (name, svc) => services.set(name, svc),
    service: <T,>(name: string) => services.get(name) as T,
  };

  registerBuiltinModules();
  await loadExternalModules(paths.modulesDir);
  await initModules(ctx);

  // 未知 API 路径返回 JSON 404；其余路径回到单页应用入口
  app.notFound((c) => {
    if (c.req.path.startsWith('/api/')) return c.json({ error: '接口不存在' }, 404);
    return c.redirect('/');
  });

  const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
    console.log(`\n  FileHub 已启动`);
    console.log(`  本机访问:   http://localhost:${info.port}`);
    for (const urls of lanUrls(info.port)) console.log(`  局域网访问: ${urls}`);
    console.log(`  工作目录:   ${paths.workDir}（网盘根目录，系统数据在 .filehub/）`);
    console.log(`  数据库:     ${paths.dataDir}\n`);
  });

  return {
    server,
    config,
    paths,
    close: async () =>
      new Promise<void>((resolve) =>
        server.close(() => pg.close().then(() => resolve())),
      ),
  };
}

function lanUrls(port: number): string[] {
  const urls: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const ni of list ?? []) {
      if (ni.family === 'IPv4' && !ni.internal) urls.push(`http://${ni.address}:${port}`);
    }
  }
  return urls;
}

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import * as schema from '../db/schema.js';

export type Db = PgliteDatabase<typeof schema>;

const MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS "_migrations" (
    "name" text PRIMARY KEY,
    "applied_at" timestamptz NOT NULL DEFAULT now()
  )
`;

export interface DatabaseHandle {
  pg: PGlite;
  db: Db;
}

export async function openDatabase(dataDir: string): Promise<DatabaseHandle> {
  const pg = new PGlite(dataDir);
  const db = drizzle(pg, { schema });
  return { pg, db };
}

/**
 * 按文件名顺序应用未执行的迁移。
 * 随包分发的 SQL 直接从只读源目录读取，不再复制到工作目录（避免 Windows 上
 * 跨卷复制或目标文件只读导致的 EPERM）；工作目录 <meta>/sql 下仍可放置用户/扩展迁移。
 * 迁移文件以 `--> statement-breakpoint` 分隔语句。
 */
export async function syncAndMigrate(
  pg: PGlite,
  bundledSqlDir: string,
  sqlDir: string,
  log: (msg: string) => void = console.log,
): Promise<string[]> {
  mkdirSync(sqlDir, { recursive: true });

  const bundled = existsSync(bundledSqlDir)
    ? readdirSync(bundledSqlDir).filter((f) => f.endsWith('.sql')).sort()
    : [];
  const user = existsSync(sqlDir)
    ? readdirSync(sqlDir).filter((f) => f.endsWith('.sql')).sort()
    : [];

  await pg.exec(MIGRATIONS_TABLE);
  const appliedRows = await pg.sql<{ name: string }>`SELECT name FROM "_migrations"`;
  const applied = new Set(appliedRows.rows.map((r) => r.name));

  const pending: string[] = [];
  const applyFile = async (name: string, content: string) => {
    if (applied.has(name)) return;
    pending.push(name);
    const statements = content
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      await pg.exec(stmt);
    }
    await pg.sql`INSERT INTO "_migrations" ("name") VALUES (${name})`;
    log(`[migrate] applied ${name} (${statements.length} statements)`);
  };

  // 1) 随包分发的迁移优先
  for (const name of bundled) {
    const content = readFileSync(join(bundledSqlDir, name), 'utf8');
    await applyFile(name, content);
  }

  // 2) 工作目录下的用户/扩展迁移（跳过与随包同名的）
  const bundledSet = new Set(bundled);
  for (const name of user) {
    if (bundledSet.has(name)) continue;
    const content = readFileSync(join(sqlDir, name), 'utf8');
    await applyFile(name, content);
  }

  return pending;
}

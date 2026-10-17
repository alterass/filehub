import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
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
 * 把随包分发的 SQL 同步到 ~/.filehub/sql，然后按文件名顺序应用未执行的迁移。
 * 迁移文件以 `--> statement-breakpoint` 分隔语句；已应用但内容发生变化的文件会被跳过并告警。
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
  for (const name of bundled) {
    const src = join(bundledSqlDir, name);
    const dest = join(sqlDir, name);
    if (!existsSync(dest) || readFileSync(dest, 'utf8') !== readFileSync(src, 'utf8')) {
      copyFileSync(src, dest);
    }
  }

  await pg.exec(MIGRATIONS_TABLE);
  const appliedRows = await pg.sql<{ name: string }>`SELECT name FROM "_migrations"`;
  const applied = new Set(appliedRows.rows.map((r) => r.name));

  const pending: string[] = [];
  for (const name of readdirSync(sqlDir).filter((f) => f.endsWith('.sql')).sort()) {
    if (applied.has(name)) continue;
    pending.push(name);
    const content = readFileSync(join(sqlDir, name), 'utf8');
    const statements = content
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      await pg.exec(stmt);
    }
    await pg.sql`INSERT INTO "_migrations" ("name") VALUES (${name})`;
    log(`[migrate] applied ${name} (${statements.length} statements)`);
  }

  for (const name of applied) {
    if (bundled.includes(name)) continue; // 正常文件
    // 已应用但源文件被删除/改名：不处理，仅保留记录
  }
  return pending;
}

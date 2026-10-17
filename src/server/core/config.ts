import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AppPaths } from './paths.js';

export interface FileHubConfig {
  /** 监听地址，默认 0.0.0.0 以便局域网访问 */
  host: string;
  /** 监听端口 */
  port: number;
  /** 迁移 SQL 目录 */
  sqlDir: string;
  /** 缩略图缓存目录（.filehub/.cache，列表中会被忽略） */
  thumbDir: string;
  /** JWT 签名密钥（init 时自动生成） */
  jwtSecret: string;
  /** 登录会话有效期（天） */
  sessionDays: number;
}

export function loadOrCreateConfig(paths: AppPaths, overrides: Partial<FileHubConfig> = {}) {
  const defaults = (): FileHubConfig => ({
    host: '0.0.0.0',
    port: 3880,
    sqlDir: paths.sqlDir,
    thumbDir: paths.thumbDir,
    jwtSecret: randomBytes(48).toString('hex'),
    sessionDays: 30,
  });

  let created = false;
  let config: FileHubConfig;
  if (existsSync(paths.configFile)) {
    const raw = JSON.parse(readFileSync(paths.configFile, 'utf8')) as Partial<FileHubConfig>;
    // sqlDir / thumbDir 必须跟随当前工作目录，不能用历史配置里存的绝对路径
    // （否则换工作目录后会把 SQL / 缩略图写到旧目录，凭空生成一个旧目录）
    delete raw.sqlDir;
    delete raw.thumbDir;
    config = { ...defaults(), ...raw };
  } else {
    config = defaults();
    created = true;
    saveConfig(paths, config);
  }
  // 仅应用显式传入的覆盖项（undefined 不覆盖，如 CLI 未指定端口时）
  const effective = Object.fromEntries(
    Object.entries(overrides).filter(([, v]) => v !== undefined),
  ) as Partial<FileHubConfig>;
  config = { ...config, ...effective };
  return { config, created };
}

export function saveConfig(paths: AppPaths, config: FileHubConfig): void {
  // 不持久化由工作目录推导出的路径，避免换工作目录后读到旧绝对路径
  const persisted = { ...config } as Partial<FileHubConfig>;
  delete persisted.sqlDir;
  delete persisted.thumbDir;
  writeFileSync(paths.configFile, JSON.stringify(persisted, null, 2) + '\n', 'utf8');
}

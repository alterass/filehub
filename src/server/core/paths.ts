import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 默认工作目录：~/.filehub（即“主目录”模式；也可用 --workdir 指向任意目录） */
export const FILEHUB_HOME = join(homedir(), '.filehub');

const moduleDir = dirname(fileURLToPath(import.meta.url));

/** 项目根目录：src/server/core（开发）或 dist/server/core（编译产物）向上三级 */
export const projectRoot = (): string => resolve(moduleDir, '..', '..', '..');

export interface AppPaths {
  /** 工作目录（用户可见的网盘根目录） */
  workDir: string;
  /** 工作目录下的元数据目录 .filehub/：配置、SQL、数据库、缓存、外部模块 */
  metaDir: string;
  /** 配置文件 <meta>/config.json */
  configFile: string;
  /** 迁移 SQL 目录 <meta>/sql */
  sqlDir: string;
  /** 随包分发的 SQL 目录（项目内 sql/） */
  bundledSqlDir: string;
  /** PGlite 数据目录 <meta>/data */
  dataDir: string;
  /** 缩略图缓存目录 <meta>/.cache */
  thumbDir: string;
  /** 外部模块目录 <meta>/modules */
  modulesDir: string;
}

/**
 * 解析工作目录布局：workdir 本身是网盘根目录，所有系统数据都收纳在
 * workdir/.filehub/ 元数据目录中，与用户文件互不干扰。
 */
export function resolvePaths(workDir: string = FILEHUB_HOME): AppPaths {
  const metaDir = join(workDir, '.filehub');
  return {
    workDir,
    metaDir,
    configFile: join(metaDir, 'config.json'),
    sqlDir: join(metaDir, 'sql'),
    bundledSqlDir: join(projectRoot(), 'sql'),
    dataDir: join(metaDir, 'data'),
    thumbDir: join(metaDir, '.cache'),
    modulesDir: join(metaDir, 'modules'),
  };
}

import type { Hono } from 'hono';
import type { PGlite } from '@electric-sql/pglite';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Db } from './database.js';
import type { FileHubConfig } from './config.js';
import type { AppPaths } from './paths.js';
import type { LocalStorage } from './storage.js';
import type { EventBus } from './events.js';
import type { Env } from '../env.js';

/**
 * 模块契约：所有功能（内置或外部）都实现该接口，通过注册表挂载。
 * 核心服务器只依赖本接口 —— 对扩展开放（新增模块），对修改关闭（不改核心）。
 */
export interface FileHubModule {
  name: string;
  register(ctx: CoreContext): void | Promise<void>;
}

export interface CoreContext {
  app: Hono<Env>;
  pg: PGlite;
  db: Db;
  config: FileHubConfig;
  paths: AppPaths;
  storage: LocalStorage;
  bus: EventBus;
  /** 模块间共享服务：provide 注册，service 取用（如 'files'） */
  provide(name: string, svc: unknown): void;
  service<T = unknown>(name: string): T;
}

const registry: FileHubModule[] = [];

export function registerModule(module: FileHubModule): void {
  if (registry.some((m) => m.name === module.name)) {
    throw new Error(`module "${module.name}" already registered`);
  }
  registry.push(module);
}

export function listModules(): readonly FileHubModule[] {
  return registry;
}

/** 依次挂载所有已注册模块（路由/服务/事件挂钩） */
export async function initModules(ctx: CoreContext): Promise<void> {
  for (const module of registry) {
    await module.register(ctx);
    console.log(`[module] ${module.name}`);
  }
}

/**
 * 加载外部模块：~/.filehub/modules/*.js，default 导出需满足 FileHubModule。
 * 用户无需改动本项目源码即可扩展功能（开放封闭）。
 */
export async function loadExternalModules(dir: string): Promise<void> {
  if (!existsSync(dir)) return;
  const files = readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
  for (const file of files) {
    const full = join(dir, file);
    try {
      const imported = (await import(pathToFileURL(full).href)) as {
        default?: FileHubModule;
      } & Partial<FileHubModule>;
      const module = imported.default ?? (imported as FileHubModule);
      if (typeof module?.register !== 'function') {
        console.warn(`[module] skipped ${file}: no register() export`);
        continue;
      }
      registerModule(module);
      console.log(`[module] external module "${module.name}" loaded from ${file}`);
    } catch (err) {
      console.error(`[module] failed to load ${file}:`, err);
    }
  }
}

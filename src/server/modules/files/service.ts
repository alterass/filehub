import { createReadStream, readdirSync, statSync, type Dirent } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { readFile, rename, rm } from 'node:fs/promises';
import type { Db } from '../../core/database.js';
import type { LocalStorage } from '../../core/storage.js';
import type { EventBus } from '../../core/events.js';
import { badRequest, notFound } from '../../core/errors.js';
import { mimeByName } from '../../core/mime.js';

const NAME_MAX = 255;

/** 系统保留目录名（工作目录内不作为用户内容展示） */
const RESERVED_NAMES = ['.filehub', '__uploads__'];

export function validateName(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim().length === 0) throw badRequest('名称不能为空');
  const name = raw.trim();
  if (name.length > NAME_MAX) throw badRequest(`名称不能超过 ${NAME_MAX} 字符`);
  if (name === '.' || name === '..') throw badRequest('名称不合法');
  if (/[/\\]/.test(name)) throw badRequest('名称不能包含路径分隔符');
  if (/[\u0000-\u001f\u007f]/.test(name)) throw badRequest('名称包含非法字符');
  if (RESERVED_NAMES.includes(name)) throw badRequest('该名称为系统保留');
  return name;
}

export interface NodeInfo {
  id: string;
  parentId: string | null;
  name: string;
  type: 'folder' | 'file';
  size: number;
  mime: string | null;
  /** 相对工作目录的路径（即 storage_key） */
  key: string;
  updatedAt: string;
}

export interface ListResult {
  items: NodeInfo[];
  path: Array<{ id: string; name: string }>;
  stats: { files: number; folders: number; bytes: number };
}

/**
 * 文件服务：直接以工作目录为网盘根目录。
 * 节点 id = 相对路径经 base64url 编码（稳定、无需数据库即可还原），
 * 文件夹与文件均为磁盘真实条目 —— 外部放入工作目录的文件立即可见。
 */
export class FilesService {
  constructor(
    private readonly db: Db,
    private readonly storage: LocalStorage,
    private readonly bus: EventBus,
  ) {}

  // ---------- id <-> 路径 ----------

  private idOf(relPath: string): string {
    return Buffer.from(relPath, 'utf8').toString('base64url');
  }

  private pathOf(id: string): string {
    try {
      const rel = Buffer.from(id, 'base64url').toString('utf8');
      if (!rel || rel.includes('\0')) throw new Error('bad');
      // 防路径逃逸
      const abs = this.storage.absPath(rel);
      void abs;
      return rel;
    } catch {
      throw notFound('资源不存在');
    }
  }

  private toPosix(p: string): string {
    return p.split(sep).join('/');
  }

  // ---------- 元信息 ----------

  private nodeAt(relPath: string): NodeInfo {
    const abs = this.storage.absPath(relPath);
    let s;
    try {
      s = statSync(abs);
    } catch {
      throw notFound('资源不存在');
    }
    const name = relPath === '' ? '' : relPath.split('/').pop()!;
    const parent = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/')) : '';
    return {
      id: this.idOf(relPath),
      parentId: relPath === '' ? null : this.idOf(parent) || null,
      name: name || '根目录',
      type: s.isDirectory() ? 'folder' : 'file',
      size: s.isFile() ? s.size : 0,
      mime: s.isFile() ? mimeByName(name) : null,
      key: relPath,
      updatedAt: s.mtime.toISOString(),
    };
  }

  /** 校验父目录 id（null = 根目录），返回相对路径 */
  private parentPath(parentId: string | null): string {
    if (parentId === null || parentId === '') return '';
    const rel = this.pathOf(parentId);
    const node = this.nodeAt(rel);
    if (node.type !== 'folder') throw badRequest('目标不是文件夹');
    return rel;
  }

  async list(parentId: string | null): Promise<ListResult> {
    const parentRel = this.parentPath(parentId);
    const abs = this.storage.absPath(parentRel);
    let entries: Dirent[];
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      throw notFound('目录不存在');
    }
    const items: NodeInfo[] = [];
    for (const e of entries) {
      if (RESERVED_NAMES.includes(e.name)) continue;
      if (e.name.startsWith('.filehub')) continue;
      const rel = this.toPosix(join(parentRel, e.name));
      try {
        items.push(this.nodeAt(rel));
      } catch {
        // 权限或特殊文件：跳过
      }
    }
    // 文件夹优先，各自按名称排序
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name, 'zh-Hans-CN');
    });

    // 面包屑与统计（统计走库以避免全树遍历？——直接浅层聚合当前目录）
    const path: Array<{ id: string; name: string }> = [];
    if (parentRel) {
      const parts = parentRel.split('/');
      let acc = '';
      for (const part of parts) {
        acc = acc ? `${acc}/${part}` : part;
        path.push({ id: this.idOf(acc), name: part });
      }
    }
    const stats = this.shallowStats(items);
    return { items, path, stats };
  }

  private shallowStats(items: NodeInfo[]): { files: number; folders: number; bytes: number } {
    let files = 0, folders = 0, bytes = 0;
    for (const i of items) {
      if (i.type === 'folder') folders++;
      else { files++; bytes += i.size; }
    }
    return { files, folders, bytes };
  }

  async getNode(id: string): Promise<NodeInfo> {
    const rel = this.pathOf(id);
    if (rel === '') throw badRequest('根目录不是文件节点');
    return this.nodeAt(rel);
  }

  async search(q: string, limit = 500): Promise<Array<NodeInfo & { path: string }>> {
    // 真实目录模式下搜索为受限的浅层遍历（跳过系统目录），最多扫 limit 层级条目
    const needle = q.toLowerCase();
    const results: Array<NodeInfo & { path: string }> = [];
    const walk = (rel: string, depth: number): void => {
      if (results.length >= limit || depth > 6) return;
      const abs = this.storage.absPath(rel);
      let entries: Dirent[];
      try {
        entries = readdirSync(abs, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (RESERVED_NAMES.includes(e.name) || e.name.startsWith('.filehub')) continue;
        const childRel = rel ? `${rel}/${e.name}` : e.name;
        if (e.name.toLowerCase().includes(needle)) {
          try {
            const node = this.nodeAt(childRel);
            results.push({
              ...node,
              path: rel.split('/').filter(Boolean).join(' / '),
            });
          } catch { /* 跳过 */ }
        }
        if (e.isDirectory()) walk(childRel, depth + 1);
        if (results.length >= limit) return;
      }
    };
    walk('', 0);
    return results;
  }

  async createFolder(parentId: string | null, rawName: string): Promise<NodeInfo> {
    const parentRel = this.parentPath(parentId);
    const name = validateName(rawName);
    const rel = this.toPosix(join(parentRel, name));
    const abs = this.storage.absPath(rel);
    const { mkdir } = await import('node:fs/promises');
    try {
      await mkdir(abs, { recursive: false });
    } catch {
      throw badRequest('同名文件夹已存在（或名称不可用）');
    }
    this.bus.emit('files:created', { node: rel });
    return this.nodeAt(rel);
  }

  /** 上传完成后的落库登记（真实目录模式下仅发事件供缩略图模块使用） */
  registerUpload(relPath: string): void {
    this.bus.emit('files:uploaded', { key: relPath, row: this.nodeAt(relPath) });
  }

  async rename(id: string, rawName: string): Promise<NodeInfo> {
    const rel = this.pathOf(id);
    const node = this.nodeAt(rel);
    const name = validateName(rawName);
    const parentRel = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
    const newRel = this.toPosix(join(parentRel, name));
    if (newRel === rel) return node;
    const absOld = this.storage.absPath(rel);
    const absNew = this.storage.absPath(newRel);
    try {
      await rename(absOld, absNew);
    } catch {
      throw badRequest('重命名失败（目标可能已存在）');
    }
    this.bus.emit('files:updated', { from: rel, to: newRel });
    return this.nodeAt(newRel);
  }

  async move(id: string, newParentId: string | null): Promise<NodeInfo> {
    const rel = this.pathOf(id);
    if (rel === '') throw badRequest('不能移动根目录');
    const node = this.nodeAt(rel);
    const targetParent = this.parentPath(newParentId);
    // 禁止移入自身或子孙
    if (node.type === 'folder' && (targetParent === rel || targetParent.startsWith(`${rel}/`))) {
      throw badRequest('不能把文件夹移动到它自己的子目录中');
    }
    const name = rel.split('/').pop()!;
    const newRel = this.toPosix(join(targetParent, name));
    if (newRel === rel) return node;
    try {
      await rename(this.storage.absPath(rel), this.storage.absPath(newRel));
    } catch {
      throw badRequest('移动失败（目标可能已存在同名项）');
    }
    this.bus.emit('files:updated', { from: rel, to: newRel });
    return this.nodeAt(newRel);
  }

  async remove(id: string): Promise<{ removed: number }> {
    const rel = this.pathOf(id);
    if (rel === '') throw badRequest('不能删除根目录');
    this.nodeAt(rel); // 存在性校验
    const abs = this.storage.absPath(rel);
    await rm(abs, { recursive: true, force: true });
    this.bus.emit('files:deleted', { key: rel });
    return { removed: 1 };
  }

  /** 全部文件夹（移动对话框的树），限制深度避免超深目录 */
  async folders(): Promise<NodeInfo[]> {
    const out: NodeInfo[] = [];
    const walk = (rel: string, depth: number): void => {
      if (depth > 4) return;
      const abs = this.storage.absPath(rel);
      let entries: Dirent[];
      try {
        entries = readdirSync(abs, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (!e.isDirectory() || RESERVED_NAMES.includes(e.name) || e.name.startsWith('.filehub')) continue;
        const childRel = rel ? `${rel}/${e.name}` : e.name;
        try {
          out.push(this.nodeAt(childRel));
        } catch { /* 跳过 */ }
        walk(childRel, depth + 1);
      }
    };
    walk('', 0);
    return out.sort((a, b) => a.key.localeCompare(b.key));
  }
}

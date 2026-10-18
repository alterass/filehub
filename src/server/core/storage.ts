import { createReadStream, createWriteStream, statSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { notFound } from './errors.js';

/**
 * 本地磁盘存储服务。工作目录即网盘根目录，节点直接映射真实文件系统：
 * - storageKey 即相对工作目录的路径（相对路径，POSIX 分隔符）
 * - 新上传写入 uuid 分桶临时区 <meta>/uploads/，数据库记录相对路径
 * - 缩略图缓存写入 thumbDir（.filehub/.cache）
 * 实现可替换（如 S3/OSS），接口保持稳定。
 */
export class LocalStorage {
  constructor(
    private readonly root: string,
    private readonly metaDir: string,
    private readonly thumbDir = join(metaDir, '.cache'),
  ) {}

  /** 相对 key → 绝对路径（防止路径逃逸；resolve 归一化后统一比较，兼容 / 与 \ 混写） */
  absPath(key: string): string {
    const root = resolve(this.root);
    const full = resolve(root, key);
    if (full !== root && !full.startsWith(root + sep)) throw notFound('非法路径');
    return full;
  }

  /** 上传落地目录（<meta>/uploads，系统区，列表中被忽略） */
  private uploadsDir(): string {
    return join(this.metaDir, 'uploads');
  }

  private tmpPath(): string {
    return join(this.uploadsDir(), 'tmp', `${randomUUID()}.part`);
  }

  /** 上传临时落地：写入 <meta>/uploads/tmp，由调用方 rename 到目标位置 */
  async putStream(stream: ReadableStream, fileName: string): Promise<{ key: string; size: number; tmpAbs: string }> {
    const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';
    const tmp = this.tmpPath();
    await mkdir(dirname(tmp), { recursive: true });
    try {
      await pipeline(Readable.fromWeb(stream as never), createWriteStream(tmp));
      const { size } = await stat(tmp);
      return { key: `__uploads__/${randomUUID()}${ext}`, size, tmpAbs: tmp };
    } catch (err) {
      await rm(tmp, { force: true }).catch(() => {});
      throw err;
    }
  }

  async readBuffer(key: string): Promise<Buffer> {
    return readFile(this.absPath(key));
  }

  async sizeOf(key: string): Promise<number> {
    const s = await stat(this.absPath(key));
    return s.size;
  }

  /** 读取文件（可指定字节区间，用于 HTTP Range / 流媒体） */
  openRange(key: string, start?: number, end?: number): { stream: ReadableStream; size: number } {
    const path = this.absPath(key);
    let fileSize: number;
    try {
      fileSize = statSync(path).size;
    } catch {
      throw notFound('文件数据已丢失');
    }
    const s = start ?? 0;
    const e = Math.min(end ?? fileSize - 1, fileSize - 1);
    if (s > e || s < 0) throw notFound('无效的文件区间');
    const nodeStream = createReadStream(path, { start: s, end: e });
    return { stream: Readable.toWeb(nodeStream) as ReadableStream, size: fileSize };
  }

  // ---------- 缩略图缓存：<thumbDir>/<cacheId>.<size>.jpg ----------
  // cacheId 由调用方给出：图片缩略图直接用 nodeId，视频封面加 'v_' 前缀区分
  // （两类都由服务端生成，见 modules/files/thumb.ts）

  private thumbPath(cacheId: string, size: number): string {
    return join(this.thumbDir, `${cacheId}.${size}.jpg`);
  }

  async readThumb(cacheId: string, size: number): Promise<Buffer | null> {
    try {
      return await readFile(this.thumbPath(cacheId, size));
    } catch {
      return null;
    }
  }

  async writeThumb(cacheId: string, size: number, data: Buffer): Promise<void> {
    const target = this.thumbPath(cacheId, size);
    await mkdir(dirname(target), { recursive: true });
    // 先写临时文件再原子替换：进程被中断时不会留下半截 JPEG
    // （半截图会被当成有效缓存一直返回，表现为缩略图变黑/损坏且重启也不会自愈）
    const tmp = `${target}.${randomUUID().slice(0, 8)}.part`;
    await writeFile(tmp, data);
    try {
      await rename(tmp, target);
    } catch (err) {
      await rm(tmp, { force: true }).catch(() => {});
      throw err;
    }
  }

  /** 缓存的元信息（大小 + mtime），用于给 /thumb 生成 ETag 和判断是否存在 */
  async thumbMeta(cacheId: string, size: number): Promise<{ size: number; mtimeMs: number } | null> {
    try {
      const s = await stat(this.thumbPath(cacheId, size));
      return s.isFile() ? { size: s.size, mtimeMs: s.mtimeMs } : null;
    } catch {
      return null;
    }
  }

  /** 缩略图是否已缓存（只看存在性，不读内容 —— 避免为了判断白读一个大文件） */
  async hasThumb(cacheId: string, size: number): Promise<boolean> {
    return (await this.thumbMeta(cacheId, size)) !== null;
  }

  /** 缓存目录路径（维护接口用于展示/日志） */
  thumbDirPath(): string {
    return this.thumbDir;
  }

  /** 列出缓存目录里的全部文件（含非预期的残留文件），供统计与清理 */
  async listThumbFiles(): Promise<Array<{ name: string; bytes: number; mtimeMs: number }>> {
    let names: string[];
    try {
      names = await readdir(this.thumbDir);
    } catch {
      return []; // 目录还不存在
    }
    const out: Array<{ name: string; bytes: number; mtimeMs: number }> = [];
    for (const name of names) {
      try {
        const s = await stat(join(this.thumbDir, name));
        if (s.isFile()) out.push({ name, bytes: s.size, mtimeMs: s.mtimeMs });
      } catch {
        // 并发删除等情况：跳过
      }
    }
    return out;
  }

  /** 按文件名批量删除缓存文件，返回实际删除数量 */
  async removeThumbFiles(names: string[]): Promise<number> {
    let removed = 0;
    for (const name of names) {
      try {
        await rm(join(this.thumbDir, name), { force: true });
        removed++;
      } catch {
        // 忽略：可能已被并发删除
      }
    }
    return removed;
  }

  /** 节点删除时同步清理其全部尺寸的缩略图 */
  async deleteThumbs(nodeId: string): Promise<void> {
    try {
      const files = await readdir(this.thumbDir);
      await Promise.all(
        files
          .filter((f) => f.startsWith(`${nodeId}.`) || f.startsWith(`v_${nodeId}.`))
          .map((f) => rm(join(this.thumbDir, f), { force: true })),
      );
    } catch {
      // thumbs 目录不存在等情况：忽略
    }
  }

  async deleteKeys(keys: string[]): Promise<void> {
    await Promise.all(keys.map((k) => rm(this.absPath(k), { force: true }).catch(() => {})));
  }

  /** 删除空父目录（上传分桶区清理用，向上直到 root） */
  async pruneEmptyDirs(key: string): Promise<void> {
    let dir = dirname(this.absPath(key));
    while (dir.startsWith(this.root) && dir !== this.root) {
      let entries: string[];
      try {
        entries = await readdir(dir);
      } catch {
        return;
      }
      if (entries.length) return;
      await rm(dir, { force: true }).catch(() => {});
      dir = dirname(dir);
    }
  }
}

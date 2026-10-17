import { createReadStream, createWriteStream, statSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
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

  // ---------- 缩略图缓存：<thumbDir>/<kind><nodeId>.<size>.jpg ----------
  // kind: '' 图片缩略图；'v_' 视频封面（避免 Windows 文件名禁止的冒号）

  private thumbPath(nodeId: string, size: number): string {
    return join(this.thumbDir, `${nodeId}.${size}.jpg`);
  }

  async readThumb(nodeId: string, size: number): Promise<Buffer | null> {
    try {
      return await readFile(this.thumbPath(nodeId, size));
    } catch {
      return null;
    }
  }

  async writeThumb(nodeId: string, size: number, data: Buffer): Promise<void> {
    const target = this.thumbPath(nodeId, size);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
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

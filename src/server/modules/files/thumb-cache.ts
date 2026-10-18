// 缩略图的任务化维护：所有「建立/重建」都排进这里统一执行，
// 不再由 HTTP 请求触发生成 —— 否则打开一个有几百个未缓存视频的目录会并发拉出
// 几十个 ffmpeg，把 CPU 打满。这里同时负责缓存清理。
import { statSync, type Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { basename } from 'node:path';
import type { LocalStorage } from '../../core/storage.js';
import type { NodeInfo } from './service.js';
import { isImageName, isVideoName } from '../../core/mime.js';
import { conflict } from '../../core/errors.js';
import { getThumb, isBlackCachedThumb, resetThumbFailures, THUMB_SIZES } from './thumb.js';

/** 扫描网盘时的最大下钻深度，避免超深目录拖垮任务 */
const MAX_SCAN_DEPTH = 6;
/** 建立的尺寸：WebUI 只会请求列表 160 与网格 384 两档 */
const GENERATE_SIZES = [384, 160];
/** 源文件比缓存新多少才算「已被修改」（容差用于抵消文件系统时间戳精度） */
const MODIFIED_TOLERANCE_MS = 2000;

/** 相对路径 → 节点 id（与 FilesService 的 idOf 保持一致） */
const idOf = (relPath: string) => Buffer.from(relPath, 'utf8').toString('base64url');
const cacheIdOf = (id: string, kind: MediaFile['kind']) => (kind === 'video' ? `v_${id}` : id);

export interface MediaFile {
  id: string;
  name: string;
  /** 相对工作目录的路径（storage key） */
  key: string;
  kind: 'image' | 'video';
}

/** 供 getThumb 使用的最小节点信息（真实目录模式下节点 id 即路径编码） */
export const toNode = (file: MediaFile): NodeInfo => ({
  id: file.id,
  parentId: null,
  name: file.name,
  type: 'file',
  size: 0,
  mime: null,
  key: file.key,
  updatedAt: '',
});

/**
 * 遍历工作目录收集可生成缩略图的媒体文件（图片 + 视频）。
 * 用异步 readdir：大目录遍历时让出事件循环，不会在启动时卡住服务。
 * 与文件列表一样跳过 .filehub 系统目录，因此缓存目录自身不会被当成内容。
 */
export async function walkMedia(storage: LocalStorage): Promise<MediaFile[]> {
  const out: MediaFile[] = [];
  const walk = async (rel: string, depth: number): Promise<void> => {
    if (depth > MAX_SCAN_DEPTH) return;
    let entries: Dirent[];
    try {
      entries = await readdir(storage.absPath(rel), { withFileTypes: true });
    } catch {
      return; // 目录不可读：跳过
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.filehub')) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(childRel, depth + 1);
        continue;
      }
      const kind: MediaFile['kind'] | null = isVideoName(entry.name)
        ? 'video'
        : isImageName(entry.name)
          ? 'image'
          : null;
      if (kind) out.push({ id: idOf(childRel), name: entry.name, key: childRel, kind });
    }
  };
  await walk('', 0);
  return out;
}

// ---------- 串行执行器 ----------

/**
 * 所有生成/清理都排在一条链上串行执行：避免并发抽帧打满 CPU，
 * 也让缓存清理不会和正在写入的缩略图打架。
 */
let chain: Promise<unknown> = Promise.resolve();

function runExclusive<T>(task: () => Promise<T>): Promise<T> {
  const result = chain.then(task, task);
  chain = result.catch(() => undefined);
  return result;
}

// ---------- 统计 ----------

export interface ThumbCacheStats {
  entries: number;
  bytes: number;
}

export async function thumbCacheStats(storage: LocalStorage): Promise<ThumbCacheStats> {
  const files = await storage.listThumbFiles();
  return {
    entries: files.length,
    bytes: files.reduce((sum, f) => sum + f.bytes, 0),
  };
}

// ---------- 清理过期缓存 ----------

export interface CleanResult {
  scanned: number;
  removed: number;
  freedBytes: number;
  reasons: {
    missingSource: number;
    sourceModified: number;
    wrongKind: number;
    invalid: number;
  };
}

type CleanReason = keyof CleanResult['reasons'];

/**
 * 清理「过时」的缩略图缓存文件。判定口径：
 * - missingSource：源文件已不存在（缓存成了无主数据）
 * - sourceModified：源文件在缩略图生成之后被修改过，缩略图已对不上内容
 * - wrongKind：缓存对应的源文件类型已不是图片/视频
 * - invalid：文件名不符合 <cacheId>.<size>.jpg（尺寸不在白名单、写入中断的残留等）
 */
export function cleanStaleThumbs(storage: LocalStorage): Promise<CleanResult> {
  return runExclusive(() => cleanStaleThumbsInner(storage));
}

async function cleanStaleThumbsInner(storage: LocalStorage): Promise<CleanResult> {
  if (job?.running) throw conflict('缩略图任务正在进行，请等待完成或先停止');

  const files = await storage.listThumbFiles();
  const reasons: CleanResult['reasons'] = { missingSource: 0, sourceModified: 0, wrongKind: 0, invalid: 0 };
  const doomed: string[] = [];
  let freedBytes = 0;

  for (const file of files) {
    const reason = classifyThumb(storage, file);
    if (!reason) continue;
    reasons[reason]++;
    doomed.push(file.name);
    freedBytes += file.bytes;
  }

  const removed = await storage.removeThumbFiles(doomed);
  return { scanned: files.length, removed, freedBytes, reasons };
}

/** 返回该缓存文件的「过时原因」，null 表示应当保留 */
function classifyThumb(
  storage: LocalStorage,
  entry: { name: string; mtimeMs: number },
): CleanReason | null {
  const m = /^(.+)\.(\d+)\.jpg$/.exec(entry.name);
  if (!m) return 'invalid';
  const [, cacheId, sizeText] = m;
  if (!THUMB_SIZES.includes(Number(sizeText))) return 'invalid';

  // 节点 id 自身可能以 "v_" 开头，因此前缀有歧义：两种解读都试，
  // 再用解码出的文件名扩展名挑出类型匹配的那个，最后以「源文件确实存在」为准。
  const candidates: Array<{ rel: string; kind: MediaFile['kind'] }> = [];
  const plain = decodeThumbId(cacheId);
  if (plain) candidates.push({ rel: plain, kind: 'image' });
  if (cacheId.startsWith('v_')) {
    const stripped = decodeThumbId(cacheId.slice(2));
    if (stripped) candidates.push({ rel: stripped, kind: 'video' });
  }
  if (!candidates.length) return 'invalid';

  const matching = candidates.filter((c) =>
    c.kind === 'video' ? isVideoName(basename(c.rel)) : isImageName(basename(c.rel)),
  );
  if (!matching.length) return 'wrongKind';

  let mtimeMs: number | null = null;
  for (const c of matching) {
    try {
      const s = statSync(storage.absPath(c.rel));
      if (s.isFile()) {
        mtimeMs = s.mtimeMs;
        break;
      }
    } catch {
      // 该解读下源文件不存在：换下一种解读
    }
  }
  if (mtimeMs === null) return 'missingSource';
  // 源文件在缩略图之后被改过 → 缓存内容已过时
  return mtimeMs > entry.mtimeMs + MODIFIED_TOLERANCE_MS ? 'sourceModified' : null;
}

/** base64url 节点 id → 相对路径；非规范编码视为非法（不是我们生成的缓存名） */
function decodeThumbId(id: string): string | null {
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
  try {
    const rel = Buffer.from(id, 'base64url').toString('utf8');
    if (!rel || rel.includes('\0')) return null;
    return Buffer.from(rel, 'utf8').toString('base64url') === id ? rel : null;
  } catch {
    return null;
  }
}

// ---------- 后台任务（启动补齐 / 手动刷新） ----------

export type ThumbTrigger = 'startup' | 'manual';

export interface ThumbJobSnapshot {
  running: boolean;
  mode: 'missing' | 'force';
  trigger: ThumbTrigger;
  total: number;
  done: number;
  made: number;
  skipped: number;
  failed: number;
  /** 当前处理项（文件名 · 尺寸） */
  current: string;
  startedAt: number;
  finishedAt: number | null;
  cancelRequested: boolean;
  error: string | null;
}

let job: ThumbJobSnapshot | null = null;
let cancelRequested = false;
/** 本进程内已确认「只能抽到黑帧」的项：避免每次任务都为其重跑一遍 ffmpeg */
const blackKeep = new Set<string>();

export function getThumbJob(): ThumbJobSnapshot | null {
  return job ? { ...job } : null;
}

export function isThumbTaskRunning(): boolean {
  return job?.running === true;
}

/** 启动后台任务；已有任务在跑时抛错（由路由转成 409） */
export function startThumbTask(storage: LocalStorage, mode: 'missing' | 'force', trigger: ThumbTrigger): ThumbJobSnapshot {
  if (job?.running) throw conflict('已有缩略图任务在进行，请等待完成或先停止');
  cancelRequested = false;
  job = {
    running: true,
    mode,
    trigger,
    total: 0,
    done: 0,
    made: 0,
    skipped: 0,
    failed: 0,
    current: '',
    startedAt: Date.now(),
    finishedAt: null,
    cancelRequested: false,
    error: null,
  };
  void runThumbTask(storage, job);
  return { ...job };
}

export function cancelThumbTask(): ThumbJobSnapshot | null {
  if (job?.running) {
    cancelRequested = true;
    job.cancelRequested = true;
  }
  return job ? { ...job } : null;
}

/** 上传落地后排队生成（不单独开任务，直接插进串行链，可与全库任务交错执行） */
export function enqueueUploaded(storage: LocalStorage, node: NodeInfo): void {
  void runExclusive(async () => {
    for (const size of GENERATE_SIZES) await getThumb(storage, node, size);
  }).catch(() => {});
}

async function runThumbTask(storage: LocalStorage, j: ThumbJobSnapshot): Promise<void> {
  try {
    // 清掉失败记忆：让它重试此前抽帧失败/黑屏的视频
    resetThumbFailures();
    const files = await walkMedia(storage);
    j.total = files.length * GENERATE_SIZES.length;

    for (const file of files) {
      if (cancelRequested) break;
      for (const size of GENERATE_SIZES) {
        if (cancelRequested) break;
        j.current = `${file.name} · ${size}px`;
        // 逐项排进串行链：既避免并发抽帧，也让上传产生的新任务能插队先跑
        await runExclusive(() => processItem(storage, j, file, size));
        j.done++;
      }
    }
  } catch (err) {
    j.error = err instanceof Error ? err.message : String(err);
  } finally {
    j.running = false;
    j.finishedAt = Date.now();
    j.current = '';
    cancelRequested = false;
  }
}

async function processItem(storage: LocalStorage, j: ThumbJobSnapshot, file: MediaFile, size: number): Promise<void> {
  const cacheId = cacheIdOf(file.id, file.kind);
  const key = `${cacheId}.${size}`;
  const cacheFile = `${key}.jpg`;

  if (j.mode === 'missing') {
    if (await storage.hasThumb(cacheId, size)) {
      // 视频封面额外体检：旧的纯黑封面（历史版本/早期抽帧留下的）当作缺失重新生成，
      // 这样重启后的「补齐」会顺手把它们修好，而不是一直显示黑块。
      const heal = file.kind === 'video' && !blackKeep.has(key) && (await readAndCheckBlack(storage, cacheId, size));
      if (!heal) {
        j.skipped++;
        return;
      }
    }
  }

  // 走生成前必须先删旧缓存：否则 getThumb 会直接命中旧的（纯黑封面 / 要重建的旧图）而不再生成
  await storage.removeThumbFiles([cacheFile]);

  j.current = `${file.name} · ${size}px`;
  const result = await getThumb(storage, toNode(file), size);
  if (!result) {
    j.failed++;
    return;
  }
  j.made++;
  if (file.kind === 'video' && (await isBlackCachedThumb(result.buffer))) blackKeep.add(key);
}

/** 读取已缓存封面并判断是否全黑（读不到/解不开时按「需要重生成」处理，以便自愈） */
async function readAndCheckBlack(storage: LocalStorage, cacheId: string, size: number): Promise<boolean> {
  const cached = await storage.readThumb(cacheId, size);
  if (!cached) return true;
  return isBlackCachedThumb(cached);
}

import { spawn } from 'node:child_process';
import { createCanvas, loadImage, type Image } from '@napi-rs/canvas';
import ffmpegStatic from 'ffmpeg-static';
import type { LocalStorage } from '../../core/storage.js';
import type { NodeInfo } from './service.js';
import { extOf, mimeByName, VIDEO_EXTS } from '../../core/mime.js';

/** 缩略图尺寸白名单（最长边，px） */
export const THUMB_SIZES = [160, 384, 768];
export const DEFAULT_THUMB_SIZE = 384;

/** JPEG 编码质量（@napi-rs/canvas 为 0-100 整数，不是 0-1） */
const JPEG_QUALITY = 80;

/** @napi-rs/canvas（Skia）可解码的图片格式；heic/tiff 等解不了，回退原图 */
const IMAGE_SOURCE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico', 'avif', 'svg'];
/** 视频判定与 core/mime 的 VIDEO_EXTS 保持同一口径（抽帧交给 ffmpeg） */
const isVideoExt = (ext: string) => VIDEO_EXTS.includes(ext);

/** 视频封面缓存前缀：与图片缩略图区分开（缓存文件名形如 v_<nodeId>.384.jpg） */
const VIDEO_CACHE_PREFIX = 'v_';

/** ffmpeg 可执行文件：环境变量优先，其次 ffmpeg-static 内置二进制，最后回退 PATH */
// ffmpeg-static 是 CJS 包（module.exports 即路径字符串）；NodeNext 下 default 导入的类型
// 会推断成 string 与命名空间的联合，这里显式收敛成字符串或 null。
const ffmpegStaticPath = typeof ffmpegStatic === 'string' ? ffmpegStatic : null;
const FFMPEG = process.env.FILEHUB_FFMPEG || ffmpegStaticPath || 'ffmpeg';
/** 单个视频抽帧的超时与输出上限，防止损坏文件挂死或刷爆内存 */
const FFMPEG_TIMEOUT_MS = 20_000;
const FFMPEG_MAX_OUTPUT = 32 * 1024 * 1024;
/** 探测视频时长（复用 ffmpeg，不依赖 ffprobe）的超时 */
const FFMPEG_PROBE_TIMEOUT_MS = 8_000;
/** 判定「全黑帧」的平均亮度阈值（0-255；越低越严格，只拦真正的黑帧） */
const BLACK_MEAN_LUMA = 12;
/** 生成失败的记忆时长：期间同一 (文件,尺寸) 直接回退，不再重跑 ffmpeg/解码 */
const FAILURE_TTL_MS = 10 * 60_000;

export interface ThumbResult {
  buffer: Buffer;
  mime: string;
}

/** 同一 (节点,尺寸) 的并发请求合并为一个任务 */
const inflight = new Map<string, Promise<ThumbResult | null>>();

/**
 * 生成失败的记忆（cacheKey → 失效时间戳）。
 * 没有它的话，每次刷新页面都会对同一个失败项重跑 ffmpeg/解码；
 * 手动「刷新缩略图」会清空该记忆，以便重试（见 resetThumbFailures）。
 */
const failures = new Map<string, number>();

/** 清空失败记忆：手动重建前调用，让此前失败的项重新尝试 */
export function resetThumbFailures(): void {
  failures.clear();
}

function isFailed(cacheKey: string): boolean {
  const until = failures.get(cacheKey);
  if (until === undefined) return false;
  if (until > Date.now()) return true;
  failures.delete(cacheKey);
  return false;
}

function markFailed(cacheKey: string): void {
  failures.set(cacheKey, Date.now() + FAILURE_TTL_MS);
}

/**
 * 取缩略图：缓存命中直接返回；未命中则生成 JPEG 并落盘缓存。
 * - 图片：@napi-rs/canvas 解码缩放（支持 png/jpeg/gif/webp/bmp/ico/avif/svg）
 * - 视频：ffmpeg 抽一帧交给 canvas 缩放编码（服务端自带 ffmpeg，无需浏览器参与）
 * 不支持或解码失败返回 null（调用方回退原图）。
 * 小于目标尺寸的图片直接返回原字节，避免放大与二次编码（SVG 除外，必须栅格化）。
 */
export async function getThumb(storage: LocalStorage, node: NodeInfo, size: number): Promise<ThumbResult | null> {
  if (!node.key) return null;
  const ext = extOf(node.name);
  const isVideo = isVideoExt(ext);
  if (!isVideo && !IMAGE_SOURCE_EXTS.includes(ext)) return null;

  const cacheId = isVideo ? VIDEO_CACHE_PREFIX + node.id : node.id;
  const cached = await storage.readThumb(cacheId, size);
  if (cached) return { buffer: cached, mime: 'image/jpeg' };

  const cacheKey = `${cacheId}.${size}`;
  if (isFailed(cacheKey)) return null; // 近期失败过：直接回退，不重复跑 ffmpeg/解码
  const existing = inflight.get(cacheKey);
  if (existing) return existing;

  const task = (async (): Promise<ThumbResult | null> => {
    try {
      const result = isVideo
        ? await videoThumb(storage, node, size)
        : await imageThumb(storage, node, ext, size);
      if (result) failures.delete(cacheKey);
      else markFailed(cacheKey);
      return result;
    } catch {
      markFailed(cacheKey);
      return null; // 损坏文件、不支持的内容、ffmpeg 异常
    } finally {
      inflight.delete(cacheKey);
    }
  })();
  inflight.set(cacheKey, task);
  return task;
}

/** 图片缩略图：解码 → （必要时）缩放重编码 → 落盘缓存 */
async function imageThumb(storage: LocalStorage, node: NodeInfo, ext: string, size: number): Promise<ThumbResult | null> {
  const raw = await storage.readBuffer(node.key);
  const img = await loadImage(raw);
  if (!img.width || !img.height) return null;

  // 原图不超过目标尺寸：直接返回原字节（不放大、不重编码）。
  // SVG 例外：必须栅格化成位图，原样返回等于在 /thumb 里内联可执行脚本的 SVG。
  if (ext !== 'svg' && img.width <= size && img.height <= size) {
    return { buffer: raw, mime: mimeByName(node.name) };
  }
  return persist(storage, node.id, size, img);
}

/**
 * 视频封面：ffmpeg 抽帧 → canvas 缩放编码 → 落盘缓存。
 * 片头黑屏/淡入很常见，抽到全黑帧就按「往后取」的顺序换点位重试；
 * 全片都是黑帧时退回能拿到的第一帧（宁可给个黑封面，也别什么都不给）。
 */
async function videoThumb(storage: LocalStorage, node: NodeInfo, size: number): Promise<ThumbResult | null> {
  const abs = storage.absPath(node.key);
  const cacheId = VIDEO_CACHE_PREFIX + node.id;

  // 1) 先试 1s（比首帧更接近内容）：绝大多数视频一枪命中，且省掉一次时长探测
  const first = await grabFrame(abs, 1, size);
  if (first && !isMostlyBlack(first)) return persist(storage, cacheId, size, first);

  // 2) 1s 取不到或是黑帧：探测时长，按比例往后找非黑帧
  let fallback = first;
  for (const t of seekCandidates(await probeDuration(abs))) {
    const img = await grabFrame(abs, t, size);
    if (!img) continue;
    if (!isMostlyBlack(img)) return persist(storage, cacheId, size, img);
    fallback ??= img;
  }

  // 3) 候选点位全是黑帧（或都没取到）：再试一次片头位置
  if (!fallback || isMostlyBlack(fallback)) {
    const head = await grabFrame(abs, 0, size);
    if (head && !isMostlyBlack(head)) return persist(storage, cacheId, size, head);
    fallback = head ?? fallback;
  }
  return fallback ? persist(storage, cacheId, size, fallback) : null;
}

/** 抽帧 → 解码为 Image（任一环节失败都返回 null，交给调用方换点位） */
async function grabFrame(absPath: string, seekSeconds: number, size: number): Promise<Image | null> {
  const frame = await extractFrame(absPath, seekSeconds, size);
  if (!frame) return null;
  try {
    const img = await loadImage(frame);
    return img.width && img.height ? img : null;
  } catch {
    return null;
  }
}

/** 缩放编码并写入缓存 */
async function persist(storage: LocalStorage, cacheId: string, size: number, img: Image): Promise<ThumbResult> {
  const buffer = encodeJpeg(img, size);
  await storage.writeThumb(cacheId, size, buffer);
  return { buffer, mime: 'image/jpeg' };
}

/**
 * 候选抽帧点位（递增 = 「往后取」）。
 * 有时长时按比例取样（避开片头），否则退化为绝对秒数阶梯。
 */
function seekCandidates(duration: number | null): number[] {
  const out: number[] = [];
  if (duration && Number.isFinite(duration) && duration > 0) {
    for (const f of [0.15, 0.3, 0.5, 0.7, 0.85]) {
      const t = Math.round(duration * f * 10) / 10;
      if (t > 1 && t < duration - 0.05) out.push(t);
    }
  } else {
    out.push(2, 4, 7, 10);
  }
  return [...new Set(out)].slice(0, 4);
}

/** 平均亮度低于阈值即视为「全黑帧」；先缩到 64px 再统计，省算力 */
function isMostlyBlack(img: Image): boolean {
  const scale = Math.min(1, 64 / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  }
  return sum / (data.length / 4) < BLACK_MEAN_LUMA;
}

/**
 * 探测视频时长：复用 ffmpeg（ffmpeg-static 不带 ffprobe），从 stderr 的
 * `Duration: HH:MM:SS.ss` 解析。ffmpeg 此时以非 0 码退出属正常，故不看退出码。
 */
function probeDuration(absPath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const child = spawn(FFMPEG, ['-hide_banner', '-i', absPath]);
    child.stdin.end();

    let stderr = '';
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const finish = (val: number | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      child.kill('SIGKILL');
      resolve(val);
    };

    timer = setTimeout(() => finish(null), FFMPEG_PROBE_TIMEOUT_MS);
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      // 异常文件可能刷出巨量 stderr，解析到时长即可提前收工
      if (stderr.length > 64 * 1024) finish(null);
    });
    child.on('error', () => finish(null));
    child.on('close', () => {
      const m = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(stderr);
      if (!m) return finish(null);
      const seconds = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
      finish(Number.isFinite(seconds) && seconds > 0 ? seconds : null);
    });
  });
}

/** 等比缩放到最长边 ≤ size 后编码 JPEG（透明区域铺白，JPEG 无 alpha 通道） */
function encodeJpeg(img: Image, size: number): Buffer {
  const scale = Math.min(1, size / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toBuffer('image/jpeg', JPEG_QUALITY);
}

/**
 * ffmpeg 抽一帧输出 PNG 到 stdout。
 * 注意：定位点超出视频时长时 ffmpeg 仍然以退出码 0 结束但没有任何输出，
 * 因此必须同时校验「退出码为 0」且「确实拿到了字节」。
 */
function extractFrame(absPath: string, seekSeconds: number, size: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const child = spawn(FFMPEG, [
      '-hide_banner', '-loglevel', 'error',
      '-ss', String(seekSeconds),
      '-i', absPath,
      '-frames:v', '1', '-an', '-sn',
      '-vf', `scale=${size}:${size}:force_original_aspect_ratio=decrease`,
      '-f', 'image2pipe', '-vcodec', 'png', 'pipe:1',
    ]);
    // ffmpeg 不需要交互输入，立刻关掉 stdin（同时让子进程类型收敛为全 pipe 形态）
    child.stdin.end();

    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const finish = (val: Buffer | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      child.kill('SIGKILL');
      resolve(val);
    };

    timer = setTimeout(() => finish(null), FFMPEG_TIMEOUT_MS);
    child.stdout.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > FFMPEG_MAX_OUTPUT) return finish(null);
      chunks.push(chunk);
    });
    child.on('error', () => finish(null));
    child.on('close', (code) => finish(code === 0 && total > 0 ? Buffer.concat(chunks) : null));
  });
}

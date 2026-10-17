import { Jimp } from 'jimp';
import type { LocalStorage } from '../../core/storage.js';
import type { NodeInfo } from './service.js';
import { extOf } from '../../core/mime.js';

/** 缩略图尺寸白名单（最长边，px） */
export const THUMB_SIZES = [160, 384, 768];
export const DEFAULT_THUMB_SIZE = 384;

/** jimp 能解码的格式；webp/avif/heic/svg 等直接回退原图（浏览器原生渲染） */
const THUMB_SOURCE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'];
/** 可抽帧生成封面的视频容器（浏览器 video 元素解码，再经 canvas 落地 JPEG） */
const VIDEO_SOURCE_EXTS = ['mp4', 'm4v', 'webm', 'mov', 'mkv'];

interface ThumbResult {
  buffer: Buffer;
  mime: string;
}

const inflight = new Map<string, Promise<ThumbResult | null>>();

/**
 * 取缩略图：缓存命中直接返回；未命中则生成 JPEG 并落盘缓存。
 * - 图片：jimp 解码缩放
 * - 视频：交给调用方走浏览器抽帧（服务端无 ffmpeg 依赖），此处返回 null 回退原视频
 * 不支持的格式或解码失败返回 null（调用方回退到原图）。
 * 小于目标尺寸的原图直接返回原字节，避免放大与二次编码。
 */
export async function getThumb(storage: LocalStorage, node: NodeInfo, size: number): Promise<ThumbResult | null> {
  if (!node.key) return null;
  const ext = extOf(node.name);
  if (VIDEO_SOURCE_EXTS.includes(ext)) return null; // 视频走 extractVideoPoster
  if (!THUMB_SOURCE_EXTS.includes(ext)) return null;

  const cached = await storage.readThumb(node.id, size);
  if (cached) return { buffer: cached, mime: 'image/jpeg' };

  const cacheKey = `${node.id}.${size}`;
  const existing = inflight.get(cacheKey);
  if (existing) return existing;

  const task = (async (): Promise<ThumbResult | null> => {
    try {
      const raw = await storage.readBuffer(node.key);
      const img = await Jimp.read(raw);
      if (img.bitmap.width <= size && img.bitmap.height <= size) {
        return { buffer: raw, mime: 'image/' + (ext === 'jpg' ? 'jpeg' : ext) };
      }
      img.scaleToFit({ w: size, h: size });
      const out = await img.getBuffer('image/jpeg', { quality: 80 });
      await storage.writeThumb(node.id, size, out);
      return { buffer: out, mime: 'image/jpeg' };
    } catch {
      return null; // 损坏文件或不支持的内容
    } finally {
      inflight.delete(cacheKey);
    }
  })();
  inflight.set(cacheKey, task);
  return task;
}

/**
 * 视频封面：在浏览器端通过 <video> + canvas 抽帧上传生成。
 * 服务端接收 dataURL 后落盘缓存（key 前缀 v_ 区分图片缩略图，避免 Windows 冒号文件名）。
 */
export async function saveVideoPoster(
  storage: LocalStorage,
  nodeId: string,
  size: number,
  jpegBase64: string,
): Promise<boolean> {
  try {
    const buffer = Buffer.from(jpegBase64, 'base64');
    // 合法 JPEG 至少含 SOI 标记；限制 2MB
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer.length > 2 * 1024 * 1024) {
      return false;
    }
    await storage.writeThumb(`v_${nodeId}`, size, buffer);
    return true;
  } catch {
    return false;
  }
}

export async function readVideoPoster(
  storage: LocalStorage,
  nodeId: string,
  size: number,
): Promise<Buffer | null> {
  return storage.readThumb(`v_${nodeId}`, size);
}

export const isVideoPosterSource = (name: string) => VIDEO_SOURCE_EXTS.includes(extOf(name));

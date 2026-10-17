/** 扩展名 → MIME 类型映射（覆盖网盘常见类型，未识别的回退 application/octet-stream） */
const MIME_MAP: Record<string, string> = {
  // 图片
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml', avif: 'image/avif',
  ico: 'image/x-icon', heic: 'image/heic',
  // 视频
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  // 音频
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac',
  m4a: 'audio/mp4', aac: 'audio/aac',
  // 文本/文档
  txt: 'text/plain', md: 'text/markdown', pdf: 'application/pdf',
  html: 'text/html', htm: 'text/html', css: 'text/css', csv: 'text/csv',
  json: 'application/json', xml: 'application/xml',
  js: 'text/javascript', ts: 'text/plain',
  // 压缩包/其他
  zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed',
  tar: 'application/x-tar', gz: 'application/gzip',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

export function mimeByName(name: string): string {
  return MIME_MAP[extOf(name)] ?? 'application/octet-stream';
}

/** 浏览器内联渲染有脚本风险的类型：/raw 一律强制下载，避免局域网存储型 XSS */
export function unsafeToInline(name: string): boolean {
  return ['html', 'htm', 'svg', 'xhtml'].includes(extOf(name));
}

export const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif', 'ico', 'heic'];
export const VIDEO_EXTS = ['mp4', 'm4v', 'webm', 'mov', 'mkv', 'avi'];
export const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'];

export function isImageName(name: string): boolean {
  return IMAGE_EXTS.includes(extOf(name));
}
export function isVideoName(name: string): boolean {
  return VIDEO_EXTS.includes(extOf(name));
}

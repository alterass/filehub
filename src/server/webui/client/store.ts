// @ts-nocheck
// 全局状态
import { bus } from './util.js';

export const DEFAULT_LONG_PRESS_RATE = 2;
export const MAX_LONG_PRESS_RATE = 5;

function readLongPressRate() {
  const raw = parseFloat(localStorage.getItem('fh:longPressRate') || '');
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_LONG_PRESS_RATE;
  return Math.min(MAX_LONG_PRESS_RATE, raw);
}

export const state = {
  user: null,          // { id, name, role }
  initialized: false,
  view: localStorage.getItem('fh:view') || 'list',       // list | grid
  thumbs: localStorage.getItem('fh:thumbs') !== 'off',   // 图片显示：true=缩略图(默认) false=图标
  longPressRate: readLongPressRate(),                    // 长按加速倍数（默认 2，最大 5）
  thumbBust: 0,        // 缩略图缓存版本号：重建/清理后自增，用于让 <img> 绕过浏览器缓存
  cwdId: null,         // 当前目录 id（null = 根目录）
  cwdPath: [],         // 面包屑 [{id,name}]
  items: [],           // 当前目录内容
  stats: null,         // { files, folders, bytes }
  searching: false,
  query: '',
};

export function setView(view) {
  state.view = view;
  localStorage.setItem('fh:view', view);
  bus.emit('view');
}

/** 图片显示方式：缩略图（默认）/ 图标 */
export function setThumbs(on) {
  state.thumbs = !!on;
  localStorage.setItem('fh:thumbs', state.thumbs ? 'on' : 'off');
  bus.emit('thumbs');
}

/** 长按加速倍数：限制在 1-5 倍，默认 2 倍 */
export function setLongPressRate(rate) {
  const num = Number(rate);
  const value = Number.isFinite(num)
    ? Math.min(MAX_LONG_PRESS_RATE, Math.max(1, num))
    : DEFAULT_LONG_PRESS_RATE;
  state.longPressRate = value;
  localStorage.setItem('fh:longPressRate', String(value));
  bus.emit('settings');
  return value;
}

export function toggleThumbs() {
  setThumbs(!state.thumbs);
}

/** 导航到某目录（通过 hash 驱动，浏览器前进后退可用） */
export function navigate(folderId) {
  location.hash = folderId ? `#/files/${folderId}` : '#/files';
}

export function reload() {
  bus.emit('reload');
}

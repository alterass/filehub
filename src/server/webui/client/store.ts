// 全局状态
import { bus } from './util.js';

export const state = {
  user: null,          // { id, name, role }
  initialized: false,
  view: localStorage.getItem('fh:view') || 'list',       // list | grid
  thumbs: localStorage.getItem('fh:thumbs') !== 'off',   // 图片显示：true=缩略图(默认) false=图标
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

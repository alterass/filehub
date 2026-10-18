// @ts-nocheck
// FileHub API 客户端：登录态走 HttpOnly Cookie（同源自动携带），也兼容 Bearer
import { bus } from './util.js';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(method, url, body) {
  const init = { method, credentials: 'same-origin', headers: {} };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  let data = {};
  try { data = await res.json(); } catch { /* 空响应体 */ }
  if (!res.ok) {
    // 会话失效：广播给路由层跳转登录页（登录接口本身的 401 不算）
    if (res.status === 401 && !url.startsWith('/api/auth/')) {
      bus.emit('auth:expired');
    }
    throw new ApiError(data.error || `请求失败 (${res.status})`, res.status);
  }
  return data;
}

/** 原始流上传：返回 { promise, xhr }，可中途 abort */
export function upload(file, parentId, { onProgress } = {}) {
  const name = encodeURIComponent(file.name);
  const qs = parentId ? `&parentId=${encodeURIComponent(parentId)}` : '';
  const xhr = new XMLHttpRequest();
  xhr.open('POST', `/api/files/upload?name=${name}${qs}`);
  const promise = new Promise((resolve, reject) => {
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total);
    });
    xhr.addEventListener('load', () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(data.error || `上传失败 (${xhr.status})`, xhr.status));
    });
    xhr.addEventListener('error', () => reject(new ApiError('网络错误，上传中断', 0)));
    xhr.addEventListener('abort', () => reject(new ApiError('已取消', 0)));
  });
  xhr.send(file);
  return { promise, xhr };
}

export const rawUrl = (id) => `/api/files/${id}/raw`;
export const downloadUrl = (id) => `/api/files/${id}/download`;
/**
 * 缩略图缓存版本：改动缩略图的响应头或内容格式时递增。
 * URL 一变，浏览器里旧的缓存副本就再也不会被取用 —— 这是唯一能摆脱
 * 「浏览器本地还存着一份『新鲜』的旧图」的办法：改响应头没用，因为那份旧副本
 * 还在 max-age 有效期内时，浏览器压根不会来问服务器。
 */
const THUMB_CACHE_VERSION = 2;
/** 缩略图：s 为最长边像素（服务端白名单 160/384/768，其余尺寸回落 384） */
export const thumbUrl = (id, s = 384) => `/api/files/${id}/thumb?s=${s}&v=${THUMB_CACHE_VERSION}`;

export const api = {
  // 认证
  status: () => request('GET', '/api/auth/status'),
  setup: (d) => request('POST', '/api/auth/setup', d),
  login: (d) => request('POST', '/api/auth/login', d),
  logout: () => request('POST', '/api/auth/logout'),
  me: () => request('GET', '/api/auth/me'),
  // 服务信息（工作目录等）
  serverInfo: () => request('GET', '/api/server/info'),
  // 文件
  list: (parentId) => request('GET', `/api/files/list${parentId ? `?parentId=${encodeURIComponent(parentId)}` : ''}`),
  search: (q) => request('GET', `/api/files/search?q=${encodeURIComponent(q)}`),
  mkdir: (parentId, name) => request('POST', '/api/files/folder', { parentId, name }),
  rename: (id, name) => request('PATCH', `/api/files/${id}`, { name }),
  move: (id, parentId) => request('PATCH', `/api/files/${id}`, { parentId }),
  remove: (id) => request('DELETE', `/api/files/${id}`),
  folders: () => request('GET', '/api/files/folders'),
  // 缩略图维护（仅管理员）
  thumbStatus: () => request('GET', '/api/files/thumbs/status'),
  thumbRebuild: (mode) => request('POST', '/api/files/thumbs/rebuild', { mode }),
  thumbCancel: () => request('POST', '/api/files/thumbs/rebuild/cancel'),
  thumbClean: () => request('POST', '/api/files/thumbs/clean'),
  // 管理
  adminListUsers: () => request('GET', '/api/admin/users'),
  adminAddUser: (d) => request('POST', '/api/admin/users', d),
  adminResetPassword: (id, password) => request('PATCH', `/api/admin/users/${id}`, { password }),
  adminDeleteUser: (id) => request('DELETE', `/api/admin/users/${id}`),
};

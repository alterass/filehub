// @ts-nocheck
// 文档预览：PDF（浏览器内嵌）、EPUB（前端解包渲染）、Markdown、纯文本
import { rawUrl, downloadUrl } from '../api.js';
import { icon, extOf } from '../util.js';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { unzipSync } from 'fflate';

const DOC_EXTS = new Set(['pdf', 'epub', 'md', 'txt']);

export function isDocumentPreviewable(name) {
  return DOC_EXTS.has(extOf(name));
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeText(bytes) {
  let text = new TextDecoder('utf-8').decode(bytes);
  if (text.includes('\uFFFD')) {
    try {
      text = new TextDecoder('gb18030').decode(bytes);
    } catch { /* 浏览器不支持 GB18030 时退回 UTF-8 结果 */ }
  }
  return text;
}

async function fetchBytes(id) {
  const res = await fetch(rawUrl(id), { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`读取失败 (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

async function fetchText(id) {
  return decodeText(await fetchBytes(id));
}

function bytesToDataUrl(bytes, mime = 'application/octet-stream') {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

// ---------- EPUB ----------

function parseXml(str) {
  const doc = new DOMParser().parseFromString(str, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('XML 解析失败');
  return doc;
}

function dirnameOf(path) {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
}

/** 相对 href 解析为 zip 内的绝对路径（去掉 query/fragment，处理 ../） */
function resolveHref(baseDir, href) {
  let clean = String(href || '').split('#')[0].split('?')[0];
  if (!clean) return '';
  try { clean = decodeURIComponent(clean); } catch { /* 保留原样 */ }
  if (clean.startsWith('/')) return clean.replace(/^\/+/, '');
  const stack = baseDir ? baseDir.split('/').filter(Boolean) : [];
  for (const seg of clean.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') stack.pop();
    else stack.push(seg);
  }
  return stack.join('/');
}

function readEntry(zip, path) {
  if (!path) return undefined;
  if (zip[path]) return zip[path];
  const lower = path.toLowerCase();
  for (const [key, value] of Object.entries(zip)) {
    if (key.toLowerCase() === lower) return value;
  }
  return undefined;
}

async function renderEpub(id) {
  const zip = unzipSync(await fetchBytes(id));
  const containerBytes = readEntry(zip, 'META-INF/container.xml');
  if (!containerBytes) throw new Error('无效的 EPUB：缺少 container.xml');
  const container = parseXml(decodeText(containerBytes));
  const opfPath = container.querySelector('rootfile')?.getAttribute('full-path');
  if (!opfPath) throw new Error('无效的 EPUB：缺少 rootfile');

  const opfBytes = readEntry(zip, opfPath);
  if (!opfBytes) throw new Error('无效的 EPUB：找不到 OPF 文件');
  const opf = parseXml(decodeText(opfBytes));
  const opfDir = dirnameOf(opfPath);

  const manifest = new Map();
  const manifestByPath = new Map();
  for (const item of opf.querySelectorAll('manifest item')) {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    const mediaType = item.getAttribute('media-type') || 'application/octet-stream';
    if (!id || !href) continue;
    const path = resolveHref(opfDir, href);
    manifest.set(id, { href, mediaType, path });
    if (path) manifestByPath.set(path, { mediaType });
  }

  const title = opf.querySelector('metadata title')?.textContent?.trim() || '';
  const chapters = [...opf.querySelectorAll('spine itemref')]
    .map((el) => el.getAttribute('idref'))
    .filter(Boolean)
    .map((idref) => manifest.get(idref))
    .filter((m) => m?.path);

  if (!chapters.length) throw new Error('无效的 EPUB：未找到正文');

  let html = title ? `<h1 class="doc-epub-title">${escapeHtml(title)}</h1>` : '';
  html += '<div class="doc-epub">';
  chapters.forEach((chapter, index) => {
    const bytes = readEntry(zip, chapter.path);
    if (!bytes) return;
    const chapterDoc = new DOMParser().parseFromString(decodeText(bytes), 'text/html');
    const body = chapterDoc.body;
    if (!body) return;
    const dir = dirnameOf(chapter.path);

    body.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src');
      if (!src) return;
      const path = resolveHref(dir, src);
      const res = path && manifestByPath.get(path);
      const data = path && readEntry(zip, path);
      if (res && data) img.setAttribute('src', bytesToDataUrl(data, res.mediaType));
      else img.removeAttribute('src');
    });

    const chapterHtml = DOMPurify.sanitize(body.innerHTML);
    html += `<section class="epub-chapter"><h2 class="epub-chapter-title">第 ${index + 1} 章</h2>${chapterHtml}</section>`;
  });
  html += '</div>';
  return html;
}

// ---------- 预览面板 ----------

export function openDocumentPreview(item, playlist = []) {
  const index = Math.max(0, playlist.findIndex((p) => p.id === item.id));
  let current = index;
  let closed = false;

  const layers = document.getElementById('layers');
  const ov = document.createElement('div');
  ov.className = 'overlay doc-overlay';
  const multiple = playlist.length > 1;
  ov.innerHTML = `
    <div class="dialog-backdrop"></div>
    <div class="doc-panel">
      <div class="doc-head">
        <button class="icon-btn doc-close" title="关闭">${icon('close')}</button>
        <span class="doc-title"></span>
        <a class="icon-btn" title="下载原文件" target="_blank">${icon('download')}</a>
        <a class="icon-btn doc-open" title="新窗口打开" target="_blank">${icon('open')}</a>
        ${multiple ? `<button class="icon-btn doc-prev" title="上一个">${icon('chevronLeft')}</button>
        <button class="icon-btn doc-next" title="下一个">${icon('chevronRight')}</button>` : ''}
      </div>
      <div class="doc-body">
        <div class="doc-mount"><div class="loading-spin"></div></div>
      </div>
    </div>`;
  layers.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));

  const mount = ov.querySelector('.doc-mount');
  const titleEl = ov.querySelector('.doc-title');
  const downloadEl = ov.querySelector('a[title="下载原文件"]');
  const openEl = ov.querySelector('.doc-open');

  const render = async () => {
    if (closed) return;
    const cur = playlist[current];
    titleEl.textContent = cur.name;
    downloadEl.href = downloadUrl(cur.id);
    openEl.href = rawUrl(cur.id);
    ov.querySelector('.doc-prev')?.toggleAttribute('disabled', current <= 0);
    ov.querySelector('.doc-next')?.toggleAttribute('disabled', current >= playlist.length - 1);

    const ext = extOf(cur.name);
    mount.innerHTML = '<div class="loading-spin"></div>';
    try {
      if (ext === 'pdf') {
        mount.innerHTML = `
          <iframe class="doc-iframe" src="${rawUrl(cur.id)}" title="${escapeHtml(cur.name)}"></iframe>
          <p class="doc-fallback">若浏览器未显示预览，请点击右上角「新窗口打开」或「下载」。</p>`;
      } else if (ext === 'txt') {
        const text = await fetchText(cur.id);
        if (closed) return;
        mount.innerHTML = '';
        const pre = document.createElement('pre');
        pre.className = 'doc-pre';
        pre.textContent = text;
        mount.appendChild(pre);
      } else if (ext === 'md') {
        const text = await fetchText(cur.id);
        if (closed) return;
        const html = DOMPurify.sanitize(marked.parse(text));
        mount.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'doc-md';
        div.innerHTML = html;
        mount.appendChild(div);
      } else if (ext === 'epub') {
        const html = await renderEpub(cur.id);
        if (closed) return;
        mount.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'doc-epub-wrap';
        div.innerHTML = html;
        mount.appendChild(div);
      } else {
        mount.innerHTML = `<p class="dim">暂不支持该类型预览</p>`;
      }
    } catch (err) {
      if (closed) return;
      mount.innerHTML = `<div class="doc-error">${icon('alert')}<p>${escapeHtml(err.message || '预览失败')}</p></div>`;
    }
  };

  const step = (d) => {
    const next = current + d;
    if (next < 0 || next >= playlist.length) return;
    current = next;
    void render();
  };
  ov.querySelector('.doc-prev')?.addEventListener('click', () => step(-1));
  ov.querySelector('.doc-next')?.addEventListener('click', () => step(1));

  const close = () => {
    closed = true;
    document.removeEventListener('keydown', onKey);
    ov.classList.remove('show');
    setTimeout(() => ov.remove(), 180);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  ov.querySelector('.doc-close').addEventListener('click', close);
  ov.querySelector('.dialog-backdrop').addEventListener('click', close);

  void render();
  return close;
}

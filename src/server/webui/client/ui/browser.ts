// @ts-nocheck
// 文件浏览主视图：面包屑、列表/网格、上传、搜索、右键/长按菜单、拖拽
import { api, downloadUrl, thumbUrl } from '../api.js';
import { state, navigate, setView, reload, toggleThumbs } from '../store.js';
import {
  bus, icon, kindOf, formatSize, formatDate, extOf, debounce, toast, escapeHtml, BRAND_MARK,
  onLongPress, $, $$,
} from '../util.js';
import { prompt, confirm, actionMenu, moveDialog } from './dialogs.js';
import { openLightbox } from './lightbox.js';
import { openPlayer } from './player.js';
import { openAudioPlayer } from './audio.js';
import { openDocumentPreview, isDocumentPreviewable } from './preview.js';
import { openAdminPanel } from './admin.js';
import { openSettingsPanel } from './settings.js';
import { enqueue } from '../uploads.js';

let root = null;
let built = false;
let dragItem = null;   // 正在拖拽的条目（内部拖拽移动）
let dropEl = null;     // 当前高亮的放置目标行

// ---------- 布局骨架 ----------

function build(app) {
  app.innerHTML = `
    <header class="app-header">
      <div class="header-inner">
        <a class="brand" href="#/files" aria-label="FileHub 首页">
          <span class="brand-mark">${BRAND_MARK}</span><span>FileHub</span>
        </a>
        <div class="search-box">
          ${icon('search')}
          <input id="searchInput" type="search" placeholder="搜索文件" aria-label="搜索文件" />
          <button id="searchClear" class="icon-btn" hidden title="清除搜索">${icon('close')}</button>
        </div>
        <div class="header-actions">
          <button id="btnUpload" class="btn btn-primary" title="上传文件">${icon('upload')}<span>上传</span></button>
          <button id="btnNewFolder" class="icon-btn" title="新建文件夹">${icon('folderPlus')}</button>
          <span class="header-divider" aria-hidden="true"></span>
          <button id="btnUser" class="user-chip" title="账号">
            <span class="avatar" id="userInitial">?</span>
            <span class="user-name" id="userName"></span>
          </button>
          <button id="btnMenu" class="icon-btn" title="菜单">${icon('menu')}</button>
        </div>
      </div>
    </header>
    <main class="file-area">
      <div class="page">
        <div class="crumb-row"><nav id="crumbs" class="crumbs" aria-label="路径"></nav></div>
        <div class="page-head">
          <div class="page-head-main">
            <h1 id="pageTitle" class="page-title">全部文件</h1>
            <p id="pageMeta" class="page-meta"></p>
          </div>
          <div class="head-tools">
            <button id="btnRefresh" class="icon-btn" title="刷新">${icon('refresh')}</button>
            <div class="seg" role="group" aria-label="视图切换">
              <button id="btnList" class="seg-btn" data-view="list" title="列表视图" aria-label="列表视图">${icon('list')}</button>
              <button id="btnGrid" class="seg-btn" data-view="grid" title="网格视图" aria-label="网格视图">${icon('grid')}</button>
            </div>
            <button id="btnThumbs" class="icon-btn" title=""></button>
          </div>
        </div>
        <div class="content-grid" id="contentGrid">
          <div class="content-main">
            <div class="shelf" id="shelf">
              <div class="list-head" aria-hidden="true">
                <span></span><span>名称</span><span>类型</span><span class="num">大小</span><span class="num head-date">修改时间</span><span></span>
              </div>
              <div id="fileList" class="file-list"></div>
              <div class="list-foot" id="listFoot" hidden>
                <span>把文件拖到这里即可上传</span>
                <span class="num" id="listFootCount"></span>
              </div>
            </div>
            <div id="emptyState" class="empty" hidden></div>
          </div>
          <aside class="rail" id="rail" aria-label="目录概览">
            <section class="rail-section">
              <h2 class="rail-title">媒体预览</h2>
              <div id="railMedia"></div>
            </section>
            <section class="rail-section">
              <h2 class="rail-title" id="railTypesTitle">目录构成</h2>
              <div id="railTypes" class="rail-types"></div>
            </section>
          </aside>
        </div>
        <div id="dropHint" class="drop-hint" hidden>松开以上传到当前目录</div>
      </div>
    </main>
    <input type="file" id="fileInput" multiple hidden />`;
  root = app;
  built = true;

  // 头部事件
  $('#btnUpload').addEventListener('click', () => $('#fileInput').click());
  $('#fileInput').addEventListener('change', (e) => {
    if (e.target.files.length) enqueue([...e.target.files], state.cwdId);
    e.target.value = '';
  });
  $('#btnNewFolder').addEventListener('click', doMkdir);
  $$('#btnList, #btnGrid').forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });
  $('#btnThumbs').addEventListener('click', () => {
    toggleThumbs();
    toast(state.thumbs ? '图片以缩略图显示' : '图片以图标显示', 'info', 1500);
  });
  $('#btnUser').addEventListener('click', userMenu);
  $('#btnMenu').addEventListener('click', mobileMenu);
  $('#btnRefresh').addEventListener('click', () => reload());
  $('#searchClear').addEventListener('click', () => {
    $('#searchInput').value = '';
    exitSearch();
  });
  $('#emptyState').addEventListener('click', (e) => {
    if (e.target.closest('.empty-upload')) $('#fileInput').click();
    if (e.target.closest('.empty-clear')) {
      $('#searchInput').value = '';
      exitSearch();
    }
  });
  $('#railMedia').addEventListener('click', (e) => {
    const btn = e.target.closest('.rail-open');
    if (!btn) return;
    const item = state.items.find((i) => i.id === btn.dataset.id);
    if (item) activate(item);
  });
  $('#searchInput').addEventListener('input', debounce((e) => {
    const q = e.target.value.trim();
    $('#searchClear').hidden = !q;
    if (q) {
      state.searching = true;
      state.query = q;
      load();
    } else {
      exitSearch();
    }
  }, 350));
  $('#searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.target.value = '';
      exitSearch();
    }
  });

  // 列表事件（委托）
  const listEl = $('#fileList');
  listEl.addEventListener('click', (e) => {
    const row = e.target.closest('[data-id]');
    if (!row) return;
    const item = state.items.find((i) => i.id === row.dataset.id);
    if (!item) return;
    if (e.target.closest('.fmore')) {
      const rect = e.target.closest('.fmore').getBoundingClientRect();
      openMenuFor(item, rect.left, rect.bottom + 4);
      return;
    }
    activate(item);
  });
  listEl.addEventListener('contextmenu', (e) => {
    const row = e.target.closest('[data-id]');
    if (!row) return;
    e.preventDefault();
    const item = state.items.find((i) => i.id === row.dataset.id);
    if (item) openMenuFor(item, e.clientX, e.clientY);
  });
  listEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('[data-id]');
    if (!row || e.target.closest('.fmore')) return;
    e.preventDefault();
    const item = state.items.find((i) => i.id === row.dataset.id);
    if (item) activate(item);
  });
  onLongPress(listEl, (e) => {
    const row = e.target.closest('[data-id]');
    if (!row) return;
    const item = state.items.find((i) => i.id === row.dataset.id);
    if (item) openMenuFor(item, e.clientX, e.clientY);
  });

  // 拖拽 —— 区分「外部文件拖入」与「内部条目拖拽移动」
  listEl.addEventListener('dragstart', (e) => {
    const row = e.target.closest('[data-id]');
    if (!row) return;
    const item = state.items.find((i) => i.id === row.dataset.id);
    if (!item) return;
    dragItem = item;
    e.dataTransfer.effectAllowed = 'move';
    // 自定义类型标记内部拖拽；text/plain 兼容部分浏览器需写入数据才启动
    e.dataTransfer.setData(DRAG_MIME, item.id);
    e.dataTransfer.setData('text/plain', item.name);
    row.classList.add('dragging');
  });
  listEl.addEventListener('dragend', () => {
    dragItem = null;
    clearDropTarget();
    $$('.dragging').forEach((el) => el.classList.remove('dragging'));
  });
  listEl.addEventListener('dragover', (e) => {
    const target = folderRowAt(e.target);
    const internal = isInternalDrag(e);
    const files = isFileDrag(e);
    if (!target || (!internal && !files) || (internal && target.item.id === dragItem?.id)) {
      clearDropTarget();
      return;
    }
    e.preventDefault();       // 允许放置
    e.dataTransfer.dropEffect = internal ? 'move' : 'copy';
    setDropTarget(target.el);
  });
  listEl.addEventListener('dragleave', (e) => {
    // 仍停留在同一目标内（移动到其子元素）时保留高亮
    if (!dropEl || dropEl.contains(e.relatedTarget)) return;
    clearDropTarget();
  });
  listEl.addEventListener('drop', async (e) => {
    const target = folderRowAt(e.target);
    const internal = isInternalDrag(e);
    const files = isFileDrag(e);
    if (!target || (!internal && !files)) return;
    if (internal && (!dragItem || target.item.id === dragItem.id)) return;
    e.preventDefault();
    e.stopPropagation();       // 已在本行处理，不走外层整区逻辑
    clearDropTarget();
    $('#dropHint').hidden = true;

    if (internal) {
      // 内部拖拽 → 移动到目标文件夹
      const dragged = dragItem;
      dragItem = null;
      try {
        await api.move(dragged.id, target.item.id);
        toast(`已移动到「${target.item.name}」`, 'ok');
        reload();
      } catch (err) {
        toast(err.message, 'error');
      }
    } else if (e.dataTransfer.files.length) {
      // 外部文件拖入 → 上传到目标文件夹
      enqueue([...e.dataTransfer.files], target.item.id);
    }
  });

  // 外部文件拖拽上传（拖到文件区域空白处 = 上传到当前目录）
  const area = $('.file-area');
  area.addEventListener('dragover', (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    // 悬停在文件夹行上时由该行高亮提示，隐藏整区“上传到当前目录”提示
    $('#dropHint').hidden = !!folderRowAt(e.target);
  });
  area.addEventListener('dragleave', (e) => {
    if (!isFileDrag(e) || area.contains(e.relatedTarget)) return;
    $('#dropHint').hidden = true;
  });
  area.addEventListener('drop', (e) => {
    $('#dropHint').hidden = true;
    if (!isFileDrag(e)) return; // 内部拖拽由列表处理，不当作上传
    e.preventDefault();
    if (e.dataTransfer.files.length) enqueue([...e.dataTransfer.files], state.cwdId);
  });

  // 面包屑
  $('#crumbs').addEventListener('click', (e) => {
    const crumb = e.target.closest('.crumb');
    if (!crumb) return;
    exitSearch();
    navigate(crumb.dataset.id || null);
  });

  // 响应全局事件
  bus.on('reload', load);
  bus.on('view', () => { renderViewBtn(); renderItems(); });
  bus.on('thumbs', () => { renderThumbsBtn(); renderItems(); });
}

function exitSearch() {
  if (state.searching) {
    state.searching = false;
    state.query = '';
    load();
  }
}

// ---------- 数据加载 ----------

/** 后台正在生成缩略图时的自动重载定时器（同一时刻只保留一个） */
let thumbsReloadTimer = null;
/** 后台自动重载不显示 loading 骨架，避免任务期间每几秒闪一次 */
let silentReload = false;

/**
 * 生成改由服务端后台任务负责后，缩略图不会随请求立刻出现。
 * 列表接口会带回 thumbsRunning；据此在任务期间定期重载，让缩略图逐步显示出来。
 * 有弹层打开（设置/菜单/预览等）时先跳过，避免打断用户操作。
 */
function scheduleThumbsReload() {
  if (thumbsReloadTimer) clearTimeout(thumbsReloadTimer);
  thumbsReloadTimer = setTimeout(() => {
    thumbsReloadTimer = null;
    if (document.querySelector('.overlay')) return scheduleThumbsReload();
    silentReload = true;
    reload();
  }, 4000);
}

function skeletonHtml() {
  if (state.view === 'grid') {
    return Array.from({ length: 8 }, () => `
      <div class="ftile sk-tile" aria-hidden="true">
        <div class="ticon sk"></div>
        <div class="tmeta">
          <div class="sk" style="width:72%"></div>
          <div class="sk" style="width:42%;margin-top:7px"></div>
        </div>
      </div>`).join('');
  }
  return Array.from({ length: 7 }, () => `
    <div class="sk-row" aria-hidden="true">
      <span class="sk sk-icon"></span>
      <span class="sk sk-name"></span>
      <span class="sk sk-type"></span>
      <span class="sk sk-size"></span>
      <span class="sk sk-date"></span>
      <span></span>
    </div>`).join('');
}

async function load() {
  if (!built || !root.isConnected) return;
  const listEl = $('#fileList');
  const shelf = $('#shelf');
  if (silentReload) silentReload = false;
  else {
    shelf.hidden = false;
    shelf.classList.toggle('grid', state.view === 'grid');
    listEl.className = `file-list ${state.view}`;
    listEl.innerHTML = skeletonHtml();
    $('#listFoot').hidden = true;
  }
  $('#emptyState').hidden = true;
  try {
    if (state.searching) {
      const data = await api.search(state.query);
      state.items = data.items;
      renderSearchCrumb();
    } else {
      const data = await api.list(state.cwdId);
      state.cwdPath = data.path;
      state.items = data.items;
      state.stats = data.stats;
      renderCrumbs();
      const input = $('#searchInput');
      if (input.value) { input.value = ''; $('#searchClear').hidden = true; }
      if (data.thumbsRunning) scheduleThumbsReload();
    }
    renderPageHead();
    renderItems();
  } catch (err) {
    toast(err.message, 'error');
    shelf.hidden = true;
    listEl.innerHTML = `<div class="load-error">${escapeHtml(err.message)}</div>`;
    $('#emptyState').hidden = true;
  }
}

// ---------- 渲染 ----------

function renderPageHead() {
  const titleEl = $('#pageTitle');
  const metaEl = $('#pageMeta');
  if (!titleEl || !metaEl) return;
  let title = '全部文件';
  if (state.searching) {
    title = '搜索结果';
    metaEl.innerHTML = `<span class="num">${state.items.length}</span><span>项结果</span><span class="dot">·</span><span>「${escapeHtml(state.query)}」</span>`;
  } else {
    if (state.cwdPath.length) title = state.cwdPath[state.cwdPath.length - 1].name;
    const s = state.stats;
    if (s && (s.files || s.folders)) {
      metaEl.innerHTML =
        `<span class="num">${s.folders}</span><span>个文件夹</span>` +
        `<span class="dot">·</span><span class="num">${s.files}</span><span>个文件</span>` +
        `<span class="dot">·</span><span class="num">${formatSize(s.bytes)}</span>`;
    } else if (s) {
      metaEl.textContent = '这个文件夹还是空的';
    } else {
      metaEl.textContent = '';
    }
  }
  titleEl.textContent = title;
  document.title = `${title} · FileHub`;
}

function renderCrumbs() {
  const parts = [`<button class="crumb${state.cwdPath.length ? '' : ' current'}" data-id="">${icon('archive')} 根目录</button>`];
  state.cwdPath.forEach((p, i) => {
    const current = i === state.cwdPath.length - 1 ? ' current' : '';
    parts.push(`<span class="crumb-sep">${icon('chevronRight')}</span><button class="crumb${current}" data-id="${p.id}">${escapeHtml(p.name)}</button>`);
  });
  $('#crumbs').innerHTML = parts.join('');
}

function renderSearchCrumb() {
  $('#crumbs').innerHTML =
    `<button class="crumb" data-id="">${icon('archive')} 根目录</button>
     <span class="crumb-sep">${icon('chevronRight')}</span>
     <span class="crumb search-crumb">${icon('search')} 搜索</span>`;
}

function renderViewBtn() {
  $$('#btnList, #btnGrid').forEach((btn) => {
    const active = btn.dataset.view === state.view;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function renderThumbsBtn() {
  $('#btnThumbs').innerHTML = icon(state.thumbs ? 'image' : 'file');
  $('#btnThumbs').title = state.thumbs
    ? '图片显示：缩略图（点击切换为图标）'
    : '图片显示：图标（点击切换为缩略图）';
}

function thumbImg(item, size) {
  const bust = state.thumbBust ? `&t=${state.thumbBust}` : '';
  return `${icon(kindOf(item).icon)}<img class="thumb-img" loading="lazy" src="${thumbUrl(item.id, size)}${bust}" onerror="this.remove()" draggable="false" alt="" />`;
}

/** 缩略图适用的文件：图片（原始/转码）与视频（抽帧封面） */
function thumbable(item) {
  const kind = kindOf(item).kind;
  return (kind === 'image' && item.type === 'file') || (kind === 'video' && item.type === 'file');
}

function rowHtml(item) {
  const k = kindOf(item);
  const isFolder = item.type === 'folder';
  const name = escapeHtml(item.name);
  const typeLabel = isFolder ? '文件夹' : (extOf(item.name).toUpperCase() || '文件');
  const size = isFolder ? '—' : formatSize(item.size);
  const date = formatDate(item.updatedAt);
  const pathMeta = state.searching && item.path ? `<span class="fpath">${escapeHtml(item.path)} /</span>` : '';
  const useThumb = state.thumbs && thumbable(item);
  if (state.view === 'grid') {
    const ticon = useThumb
      ? `<div class="ticon has-thumb">${thumbImg(item, 384)}</div>`
      : `<div class="ticon ${k.cls}">${icon(k.icon)}</div>`;
    return `
      <div class="ftile" data-id="${item.id}" title="${name}" draggable="true" tabindex="0">
        ${ticon}
        <div class="tmeta">
          <div class="tname">${name}</div>
          <div class="tsub num">${isFolder ? '文件夹' : `${size} · ${date}`}</div>
        </div>
        <button class="fmore" title="更多操作" aria-label="更多操作">${icon('more')}</button>
      </div>`;
  }
  const ficon = useThumb
    ? `<div class="ficon has-thumb">${thumbImg(item, 160)}</div>`
    : `<div class="ficon ${k.cls}">${icon(k.icon)}</div>`;
  return `
    <div class="frow" data-id="${item.id}" draggable="true" tabindex="0">
      ${ficon}
      <div class="fname">
        <span class="nt">${name}</span>${pathMeta}
        <span class="fsub num">${typeLabel}${isFolder ? '' : ` · ${size}`} · ${date}</span>
      </div>
      <div class="ftype">${typeLabel}</div>
      <div class="fsize num">${size}</div>
      <div class="fdate num">${date}</div>
      <button class="fmore" title="更多操作" aria-label="更多操作">${icon('more')}</button>
    </div>`;
}

const KIND_LABELS = {
  folder: '文件夹', image: '图片', video: '视频', audio: '音频',
  archive: '压缩包', code: '代码', text: '文档', other: '文件',
};

/** 右栏只显示当前目录里真实存在的媒体与类型分布 */
function renderRail() {
  const rail = $('#rail');
  const grid = $('#contentGrid');
  const hasItems = state.items.length > 0;
  rail.hidden = !hasItems;
  grid.classList.toggle('no-rail', !hasItems);
  if (!hasItems) return;

  const media = state.items
    .filter((i) => i.type === 'file' && ['image', 'video'].includes(kindOf(i).kind))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
  const mediaBox = $('#railMedia');
  if (media) {
    const k = kindOf(media);
    const bust = state.thumbBust ? `&t=${state.thumbBust}` : '';
    mediaBox.innerHTML = `
      <button class="rail-media rail-open" data-id="${media.id}" title="打开 ${escapeHtml(media.name)}">
        <span class="rail-thumb ${k.cls}">
          ${icon(k.icon)}
          <img src="${thumbUrl(media.id, 384)}${bust}" loading="lazy" onerror="this.remove()" alt="" draggable="false" />
        </span>
        <span class="rail-media-copy">
          <span class="rail-media-name">${escapeHtml(media.name)}</span>
          <span class="rail-media-meta num">${extOf(media.name).toUpperCase()} · ${formatSize(media.size)} · ${formatDate(media.updatedAt)}</span>
        </span>
      </button>`;
  } else {
    mediaBox.innerHTML = `<div class="rail-empty">${icon('image')}<p>此目录还没有图片或视频。</p></div>`;
  }

  const counts = new Map();
  for (const item of state.items) {
    const kind = kindOf(item).kind;
    counts.set(kind, (counts.get(kind) || 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const max = rows[0]?.[1] || 1;
  $('#railTypesTitle').textContent = state.searching ? '结果构成' : '目录构成';
  $('#railTypes').innerHTML = rows.map(([kind, count]) => `
    <div class="type-row">
      <div class="type-line"><span>${KIND_LABELS[kind] || '文件'}</span><span class="num">${count}</span></div>
      <div class="type-bar"><i style="width:${Math.round((count / max) * 100)}%"></i></div>
    </div>`).join('');
}

function renderItems() {
  const listEl = $('#fileList');
  const shelf = $('#shelf');
  const empty = $('#emptyState');
  const foot = $('#listFoot');
  listEl.className = `file-list ${state.view}`;
  shelf.classList.toggle('grid', state.view === 'grid');
  if (!state.items.length) {
    shelf.hidden = true;
    foot.hidden = true;
    listEl.innerHTML = '';
    empty.hidden = false;
    empty.innerHTML = state.searching
      ? `<div class="empty-icon">${icon('search')}</div>
         <h2>没有找到匹配的文件</h2>
         <p>「${escapeHtml(state.query)}」没有匹配项，换个关键词试试。</p>
         <button class="btn btn-ghost empty-clear">清除搜索</button>`
      : `<div class="empty-icon">${icon('folder')}</div>
         <h2>此文件夹为空</h2>
         <p>把文件拖到这里，或从设备上传。</p>
         <button class="btn btn-primary empty-upload">${icon('upload')}上传文件</button>`;
    renderRail();
    return;
  }
  shelf.hidden = false;
  empty.hidden = true;
  foot.hidden = state.view === 'grid' || state.searching;
  $('#listFootCount').textContent = `${state.items.length} 项`;
  listEl.innerHTML = state.items.map(rowHtml).join('');
  renderRail();
}

// ---------- 交互 ----------

/** 内部条目拖拽的 dataTransfer 类型标记（与外部文件拖入区分） */
const DRAG_MIME = 'application/x-filehub-item';
/** 拖拽来源是否为列表内部的条目 */
const isInternalDrag = (e) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes(DRAG_MIME);
/** 拖拽来源是否为外部文件（操作系统或其他页面拖入的文件） */
const isFileDrag = (e) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');

/** 命中的文件夹行（仅 folder 类型）；否则 null */
function folderRowAt(node) {
  const row = node?.closest?.('[data-id]');
  if (!row) return null;
  const item = state.items.find((i) => i.id === row.dataset.id);
  if (!item || item.type !== 'folder') return null;
  return { el: row, item };
}

function setDropTarget(el) {
  if (dropEl === el) return;
  clearDropTarget();
  dropEl = el;
  el.classList.add('drop-target');
}

function clearDropTarget() {
  if (dropEl) dropEl.classList.remove('drop-target');
  dropEl = null;
}

/** 由扁平文件夹列表计算某文件夹自身及其全部子孙 id（移动时禁止选中的集合） */
function descendantIds(folders, rootId) {
  const byParent = new Map();
  for (const f of folders) {
    if (!byParent.has(f.parentId)) byParent.set(f.parentId, []);
    byParent.get(f.parentId).push(f.id);
  }
  const out = new Set([rootId]);
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop();
    for (const child of byParent.get(cur) || []) {
      if (!out.has(child)) { out.add(child); stack.push(child); }
    }
  }
  return [...out];
}

function imagesInFolder() {
  return state.items.filter((i) => kindOf(i).kind === 'image');
}

function videosInFolder() {
  return state.items.filter((i) => kindOf(i).kind === 'video');
}

function audiosInFolder() {
  return state.items.filter((i) => kindOf(i).kind === 'audio');
}

function documentsInFolder() {
  return state.items.filter((i) => i.type === 'file' && isDocumentPreviewable(i.name));
}

function activate(item) {
  const kind = kindOf(item).kind;
  if (item.type === 'folder') {
    exitSearch();
    navigate(item.id);
  } else if (kind === 'image') {
    openLightbox(imagesInFolder(), imagesInFolder().findIndex((i) => i.id === item.id));
  } else if (kind === 'video') {
    openPlayer(item, videosInFolder());
  } else if (kind === 'audio') {
    openAudioPlayer(item, audiosInFolder());
  } else if (isDocumentPreviewable(item.name)) {
    openDocumentPreview(item, documentsInFolder());
  } else {
    window.open(downloadUrl(item.id), '_blank');
  }
}

async function openMenuFor(item, x, y) {
  const kind = kindOf(item).kind;
  const actions = [{ icon: 'open', label: item.type === 'folder' ? '打开' : '打开 / 预览', value: 'open' }];
  if (item.type === 'file') actions.push({ icon: 'download', label: '下载', value: 'download' });
  actions.push(
    { icon: 'edit', label: '重命名', value: 'rename' },
    { icon: 'move', label: '移动到…', value: 'move' },
    { icon: 'trash', label: '删除', value: 'delete', danger: true },
  );

  const action = await actionMenu({ x, y, items: actions });
  if (!action) return;
  try {
    switch (action) {
      case 'open': activate(item); break;
      case 'download': window.open(downloadUrl(item.id), '_blank'); break;
      case 'rename': {
        const name = await prompt({ title: '重命名', value: item.name });
        if (name && name !== item.name) {
          await api.rename(item.id, name);
          toast('已重命名', 'ok');
          reload();
        }
        break;
      }
      case 'move': {
        const { items } = await api.folders();
        const exclude = item.type === 'folder' ? descendantIds(items, item.id) : [];
        const target = await moveDialog({ folders: items, excludeIds: exclude });
        if (target === null) break; // 用户取消
        await api.move(item.id, target === '' ? null : target);
        toast('已移动', 'ok');
        reload();
        break;
      }
      case 'delete': {
        const msg = item.type === 'folder'
          ? `将删除文件夹「${item.name}」及其全部内容，确定？`
          : `将删除「${item.name}」，确定？`;
        if (await confirm({ title: '删除', message: msg })) {
          await api.remove(item.id);
          toast('已删除', 'ok');
          reload();
        }
        break;
      }
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function doMkdir() {
  const name = await prompt({ title: '新建文件夹', placeholder: '文件夹名称' });
  if (!name) return;
  try {
    await api.mkdir(state.cwdId, name);
    toast('文件夹已创建', 'ok');
    reload();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function userMenu() {
  const actions = [
    { icon: 'settings', label: '个人设置', value: 'settings' },
  ];
  if (state.user?.role === 'admin') {
    actions.push({ icon: 'users', label: '用户管理', value: 'admin' });
  }
  actions.push({ icon: 'logout', label: '退出登录', value: 'logout', danger: true });
  const rect = $('#btnUser').getBoundingClientRect();
  const action = await actionMenu({ x: rect.right - 160, y: rect.bottom + 6, items: actions });
  if (action === 'settings') openSettingsPanel();
  if (action === 'admin') openAdminPanel();
  if (action === 'logout') {
    await api.logout();
    location.hash = '#/login';
    bus.emit('auth:logout');
  }
}

/** 移动端顶栏汉堡菜单：新建文件夹、视图/缩略图切换、账号与退出 */
async function mobileMenu() {
  const actions = [
    { icon: 'folderPlus', label: '新建文件夹', value: 'newFolder' },
    {
      icon: state.view === 'list' ? 'grid' : 'list',
      label: state.view === 'list' ? '切换为网格视图' : '切换为列表视图',
      value: 'view',
    },
    {
      icon: state.thumbs ? 'image' : 'file',
      label: state.thumbs ? '图片显示：缩略图' : '图片显示：图标',
      value: 'thumbs',
    },
  ];
  if (state.user?.role === 'admin') {
    actions.push({ icon: 'users', label: '用户管理', value: 'admin' });
  }
  actions.push(
    { icon: 'settings', label: '个人设置', value: 'settings' },
    { icon: 'logout', label: '退出登录', value: 'logout', danger: true },
  );

  const action = await actionMenu({ x: innerWidth - 180, y: 56, items: actions });
  switch (action) {
    case 'newFolder': doMkdir(); break;
    case 'view': setView(state.view === 'list' ? 'grid' : 'list'); break;
    case 'thumbs':
      toggleThumbs();
      toast(state.thumbs ? '图片以缩略图显示' : '图片以图标显示', 'info', 1500);
      break;
    case 'settings': openSettingsPanel(); break;
    case 'admin': openAdminPanel(); break;
    case 'logout':
      await api.logout();
      location.hash = '#/login';
      bus.emit('auth:logout');
      break;
  }
}

// ---------- 入口 ----------

export function mountBrowser(app) {
  // #app 常驻 DOM；以外壳标志元素判断是否需要重建（登出后 innerHTML 会被登录页替换）
  if (!built || !root || !root.querySelector('.app-header')) build(app);
  renderViewBtn();
  renderThumbsBtn();
  const name = state.user?.name || '';
  const nameEl = $('#userName');
  if (nameEl) nameEl.textContent = name;
  const initialEl = $('#userInitial');
  if (initialEl) initialEl.textContent = (name.trim().slice(0, 1) || '?').toUpperCase();
  load();
}

// @ts-nocheck
// 文件浏览主视图：面包屑、列表/网格、上传、搜索、右键/长按菜单、拖拽
import { api, downloadUrl, thumbUrl } from '../api.js';
import { state, navigate, setView, reload, toggleThumbs } from '../store.js';
import {
  bus, icon, kindOf, formatSize, formatDate, debounce, toast,
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
import { ensurePosters } from '../poster.js';

let root = null;
let built = false;
let dragItem = null;   // 正在拖拽的条目（内部拖拽移动）
let dropEl = null;     // 当前高亮的放置目标行

// ---------- 布局骨架 ----------

function build(app) {
  app.innerHTML = `
    <header class="app-header">
      <div class="brand">${icon('archive')}<b>FileHub</b></div>
      <div class="search-box">
        ${icon('search')}
        <input id="searchInput" type="search" placeholder="搜索文件…" />
        <button id="searchClear" class="icon-btn" hidden title="清除">${icon('close')}</button>
      </div>
      <div class="header-actions">
        <button id="btnUpload" class="btn btn-primary">${icon('upload')}<span>上传</span></button>
        <button id="btnNewFolder" class="icon-btn" title="新建文件夹">${icon('folderPlus')}</button>
        <button id="btnView" class="icon-btn" title="切换列表/网格"></button>
        <button id="btnThumbs" class="icon-btn" title=""></button>
        <button id="btnAdmin" class="icon-btn" title="用户管理">${icon('users')}</button>
        <button id="btnUser" class="user-chip" title="账号">${icon('user')}<span></span></button>
        <button id="btnMenu" class="icon-btn" title="菜单">${icon('menu')}</button>
      </div>
    </header>
    <div class="crumb-bar">
      <div id="crumbs" class="crumbs"></div>
      <span id="dirStats" class="dir-stats"></span>
      <button id="btnRefresh" class="icon-btn" title="刷新">${icon('refresh')}</button>
    </div>
    <main class="file-area">
      <div id="fileList" class="file-list"></div>
      <div id="emptyState" class="empty" hidden></div>
      <div id="dropHint" class="drop-hint" hidden>松开以上传到当前目录</div>
    </main>
    <input type="file" id="fileInput" multiple hidden />
    <button id="fab" class="fab" title="上传">${icon('upload')}</button>`;
  root = app;
  built = true;

  // 头部事件
  $('#btnUpload').addEventListener('click', () => $('#fileInput').click());
  $('#fab').addEventListener('click', () => $('#fileInput').click());
  $('#fileInput').addEventListener('change', (e) => {
    if (e.target.files.length) enqueue([...e.target.files], state.cwdId);
    e.target.value = '';
  });
  $('#btnNewFolder').addEventListener('click', doMkdir);
  $('#btnView').addEventListener('click', () => setView(state.view === 'list' ? 'grid' : 'list'));
  $('#btnThumbs').addEventListener('click', () => {
    toggleThumbs();
    toast(state.thumbs ? '图片以缩略图显示' : '图片以图标显示', 'info', 1500);
  });
  $('#btnAdmin').addEventListener('click', openAdminPanel);
  $('#btnUser').addEventListener('click', userMenu);
  $('#btnMenu').addEventListener('click', mobileMenu);
  $('#btnRefresh').addEventListener('click', () => reload());
  $('#searchClear').addEventListener('click', () => {
    $('#searchInput').value = '';
    exitSearch();
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

async function load() {
  if (!built || !root.isConnected) return;
  const listEl = $('#fileList');
  listEl.innerHTML = '<div class="loading-spin"></div>';
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
      renderStats();
      const input = $('#searchInput');
      if (input.value) { input.value = ''; $('#searchClear').hidden = true; }
    }
    renderItems();
  } catch (err) {
    toast(err.message, 'error');
    listEl.innerHTML = `<div class="load-error">${err.message}</div>`;
  }
}

// ---------- 渲染 ----------

function renderCrumbs() {
  const parts = [`<button class="crumb" data-id="">${icon('archive')} 根目录</button>`];
  for (const p of state.cwdPath) {
    parts.push(`<span class="crumb-sep">${icon('chevronRight')}</span><button class="crumb" data-id="${p.id}">${p.name}</button>`);
  }
  $('#crumbs').innerHTML = parts.join('');
}

function renderSearchCrumb() {
  $('#crumbs').innerHTML =
    `<button class="crumb" data-id="">${icon('archive')} 根目录</button>
     <span class="crumb-sep">${icon('chevronRight')}</span>
     <span class="crumb search-crumb">${icon('search')} 搜索「${state.query}」 · ${state.items.length} 项</span>`;
}

function renderStats() {
  const s = state.stats;
  $('#dirStats').textContent = s
    ? `${formatSize(s.bytes)} · ${s.files} 文件 · ${s.folders} 文件夹`
    : '';
}

function renderViewBtn() {
  $('#btnView').innerHTML = icon(state.view === 'list' ? 'grid' : 'list');
  $('#btnView').title = state.view === 'list' ? '切换为网格视图' : '切换为列表视图';
}

function renderThumbsBtn() {
  // 缩略图开关：与视图切换（列表/网格）图标严格区分 —— 用「图片」图标表达显示内容
  $('#btnThumbs').innerHTML = icon(state.thumbs ? 'image' : 'file');
  $('#btnThumbs').title = state.thumbs
    ? '图片显示：缩略图（点击切换为图标）'
    : '图片显示：图标（点击切换为缩略图）';
}

function thumbImg(item, size) {
  // 图标垫底：缩略图加载中或失败时移除 img 即露出图标
  return `${icon(kindOf(item).icon)}<img class="thumb-img" loading="lazy" src="${thumbUrl(item.id, size)}" onerror="this.remove()" draggable="false" alt="" />`;
}

/** 缩略图适用的文件：图片（原始/转码）与视频（抽帧封面） */
function thumbable(item) {
  const kind = kindOf(item).kind;
  return (kind === 'image' && item.type === 'file') || (kind === 'video' && item.type === 'file');
}

function rowHtml(item) {
  const k = kindOf(item);
  const meta = state.searching && item.path ? `<span class="fpath">${item.path} /</span>` : '';
  const useThumb = state.thumbs && thumbable(item);
  if (state.view === 'grid') {
    const ticon = useThumb
      ? `<div class="ticon has-thumb">${thumbImg(item, 384)}</div>`
      : `<div class="ticon ${k.cls}">${icon(k.icon)}</div>`;
    return `
      <div class="ftile" data-id="${item.id}" title="${item.name}" draggable="true">
        ${ticon}
        <div class="tname">${item.name}</div>
      </div>`;
  }
  const ficon = useThumb
    ? `<div class="ficon has-thumb">${thumbImg(item, 160)}</div>`
    : `<div class="ficon ${k.cls}">${icon(k.icon)}</div>`;
  return `
    <div class="frow" data-id="${item.id}" draggable="true">
      ${ficon}
      <div class="fname"><span class="nt">${item.name}</span>${meta}</div>
      <div class="fsize">${item.type === 'file' ? formatSize(item.size) : '—'}</div>
      <div class="fdate">${formatDate(item.updatedAt)}</div>
      <button class="fmore" title="更多操作">${icon('more')}</button>
    </div>`;
}

function renderItems() {
  const listEl = $('#fileList');
  const empty = $('#emptyState');
  listEl.className = `file-list ${state.view}`;
  if (!state.items.length) {
    listEl.innerHTML = '';
    empty.hidden = false;
    empty.innerHTML = state.searching
      ? `${icon('search')}<p>未找到与「${state.query}」匹配的文件</p>`
      : `${icon('folder')}<p>此文件夹为空</p><p class="dim">点击右上角「上传」或把文件拖到这里</p>`;
    return;
  }
  empty.hidden = true;
  listEl.innerHTML = state.items.map(rowHtml).join('');
  // 视频封面：首次渲染时对无封面视频批量抽帧（缩略图模式下才做）
  if (state.thumbs) ensurePosters(state.items);
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
  const chip = $('#btnUser span');
  if (chip) chip.textContent = state.user?.name || '';
  $('#btnAdmin').style.display = state.user?.role === 'admin' ? '' : 'none';
  load();
}

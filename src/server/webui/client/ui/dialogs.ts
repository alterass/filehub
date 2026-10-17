// 通用对话框：prompt / confirm / 移动到文件夹 / 操作菜单（电脑端浮层，手机端底部面板）
import { $, icon } from '../util.js';

const layers = () => document.getElementById('layers');

function overlay(contentHtml, cls = '') {
  const ov = document.createElement('div');
  ov.className = `overlay ${cls}`;
  ov.innerHTML = `<div class="dialog-backdrop"></div>${contentHtml}`;
  layers().appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));
  return ov;
}

function closeOverlay(ov) {
  ov.classList.remove('show');
  setTimeout(() => ov.remove(), 180);
}

function escKey(ov, onClose) {
  const onKey = (e) => { if (e.key === 'Escape') { onClose(); } };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}

function wireButtons(ov, resolve, value) {
  ov.querySelector('.dialog-cancel')?.addEventListener('click', () => { off(); closeOverlay(ov); resolve(null); });
  const off = escKey(ov, () => { closeOverlay(ov); resolve(null); });
  ov.querySelector('.dialog-ok')?.addEventListener('click', () => { off(); closeOverlay(ov); resolve(value()); });
  ov.querySelector('.dialog-backdrop')?.addEventListener('click', () => { off(); closeOverlay(ov); resolve(null); });
}

export function prompt({ title, label = '', value = '', placeholder = '', okText = '确定' }) {
  return new Promise((resolve) => {
    const ov = overlay(`
      <div class="dialog" role="dialog">
        <h3>${title}</h3>
        ${label ? `<p class="dialog-label">${label}</p>` : ''}
        <input class="input" type="text" value="${value.replace(/"/g, '&quot;')}" placeholder="${placeholder}" />
        <div class="dialog-actions">
          <button class="btn btn-ghost dialog-cancel">取消</button>
          <button class="btn btn-primary dialog-ok">${okText}</button>
        </div>
      </div>`);
    const input = ov.querySelector('.input');
    input.focus();
    input.select();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') ov.querySelector('.dialog-ok').click();
    });
    wireButtons(ov, resolve, () => input.value.trim() || null);
  });
}

export function confirm({ title, message, okText = '删除', danger = true }) {
  return new Promise((resolve) => {
    const ov = overlay(`
      <div class="dialog" role="dialog">
        <h3>${title}</h3>
        <p class="dialog-label">${message}</p>
        <div class="dialog-actions">
          <button class="btn btn-ghost dialog-cancel">取消</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} dialog-ok">${okText}</button>
        </div>
      </div>`);
    wireButtons(ov, resolve, () => true);
  });
}

/** 移动到文件夹：可选"根目录"或任意文件夹；excludeIds 中的节点置灰不可选 */
export async function moveDialog({ folders, excludeIds = [] }) {
  const pick = await new Promise((resolve) => {
    const excluded = new Set(excludeIds);
    const renderTree = (parentId, depth) =>
      folders
        .filter((f) => f.parentId === parentId)
        .map((f) => {
          const disabled = excluded.has(f.id);
          return `
            <div class="mv-node ${disabled ? 'disabled' : ''}" data-id="${f.id}" style="--depth:${depth}">
              ${icon('folder')}<span>${f.name}</span>
            </div>
            ${renderTree(f.id, depth + 1)}`;
        })
        .join('');

    const ov = overlay(`
      <div class="dialog dialog-tree" role="dialog">
        <h3>移动到…</h3>
        <div class="mv-tree">
          <div class="mv-node ${excluded.has('__root__') ? 'disabled' : ''}" data-id="">
            ${icon('archive')}<span>根目录</span>
          </div>
          ${renderTree(null, 1)}
        </div>
        <div class="dialog-actions">
          <button class="btn btn-ghost dialog-cancel">取消</button>
          <button class="btn btn-primary dialog-ok" disabled>移动到此处</button>
        </div>
      </div>`);

    let selected = null;
    let picked = false;
    ov.querySelectorAll('.mv-node:not(.disabled)').forEach((node) => {
      node.addEventListener('click', () => {
        ov.querySelectorAll('.mv-node').forEach((n) => n.classList.remove('selected'));
        node.classList.add('selected');
        // 用 getAttribute 保留空串（空串 = 根目录），与"取消"(null) 区分
        selected = node.getAttribute('data-id');
        picked = true;
        ov.querySelector('.dialog-ok').disabled = false;
      });
    });
    wireButtons(ov, resolve, () => (picked ? selected : null));
  });
  if (pick === null) return null; // 用户取消
  return pick; // '' = 根目录，否则为文件夹 id
}

/** 操作菜单：电脑端在坐标处弹浮层，手机端弹底部面板。items: [{icon,label,value,danger}] */
export function actionMenu({ x, y, items }) {
  return new Promise((resolve) => {
    const sheetMode = window.matchMedia('(max-width: 640px)').matches;
    const listHtml = items
      .map((it) => `
        <button class="menu-item ${it.danger ? 'danger' : ''}" data-value="${it.value}">
          ${icon(it.icon)}<span>${it.label}</span>
        </button>`)
      .join('');
    const ov = overlay(
      sheetMode
        ? `<div class="sheet" role="menu">${listHtml}</div>`
        : `<div class="menu-pop" role="menu" style="left:${x}px;top:${y}px">${listHtml}</div>`,
      'overlay-menu',
    );

    const done = (value) => {
      document.removeEventListener('keydown', onKey);
      closeOverlay(ov);
      resolve(value);
    };
    const onKey = (e) => { if (e.key === 'Escape') done(null); };
    document.addEventListener('keydown', onKey);

    ov.querySelectorAll('.menu-item').forEach((btn) => {
      btn.addEventListener('click', () => done(btn.dataset.value));
    });
    setTimeout(() => {
      ov.querySelector('.dialog-backdrop').addEventListener('click', () => done(null));
    }, 0);
    // 电脑端防止菜单溢出屏幕
    if (!sheetMode) {
      const pop = ov.querySelector('.menu-pop');
      const rect = pop.getBoundingClientRect();
      if (rect.right > innerWidth - 8) pop.style.left = `${Math.max(8, innerWidth - rect.width - 8)}px`;
      if (rect.bottom > innerHeight - 8) pop.style.top = `${Math.max(8, innerHeight - rect.height - 8)}px`;
    }
  });
}

export { $ };

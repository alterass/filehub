// @ts-nocheck
// 上传队列：XHR 顺序上传 + 进度面板（可最小化/取消）
import { upload } from './api.js';
import { bus, icon, formatSize, toast } from './util.js';

const queue = [];
let active = null;      // { item, xhr }
let panelEl = null;
let minimized = false;

function ensurePanel() {
  if (panelEl) return panelEl;
  panelEl = document.createElement('div');
  panelEl.className = 'upload-panel';
  panelEl.innerHTML = `
    <div class="up-head">
      <span class="up-title">上传</span>
      <span class="up-count"></span>
      <button class="icon-btn up-min" title="最小化">${icon('chevronLeft')}</button>
    </div>
    <div class="up-list"></div>`;
  document.body.appendChild(panelEl);
  panelEl.querySelector('.up-min').addEventListener('click', () => {
    minimized = !minimized;
    panelEl.classList.toggle('min', minimized);
  });
  return panelEl;
}

function render() {
  const panel = ensurePanel();
  panel.style.display = queue.length || active ? '' : 'none';
  panel.classList.toggle('min', minimized);
  const list = panel.querySelector('.up-list');
  const all = active ? [active.item, ...queue] : [...queue];
  panel.querySelector('.up-count').textContent = `${all.length} 项`;

  list.innerHTML = all.map((it) => `
    <div class="up-row ${it.status}" data-key="${it.key}">
      <div class="up-name" title="${it.file.name}">${it.file.name}</div>
      <div class="up-bar"><i style="width:${it.percent}%"></i></div>
      <div class="up-meta">
        ${it.status === 'error' ? `<span class="up-err">${it.error}</span>` :
        it.status === 'done' ? `${icon('check')} ${formatSize(it.file.size)}` :
        `${formatSize(it.loaded)} / ${formatSize(it.total)}`}
      </div>
      ${it.status === 'uploading' ? `<button class="icon-btn up-cancel" title="取消">${icon('close')}</button>` : ''}
    </div>`).join('');

  list.querySelectorAll('.up-cancel').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.closest('.up-row').dataset.key;
      if (active && active.item.key === key) active.xhr.abort();
      else {
        const idx = queue.findIndex((q) => q.key === key);
        if (idx >= 0) queue.splice(idx, 1);
        render();
      }
    });
  });
}

function pump() {
  if (active || !queue.length) return;
  const item = queue.shift();
  item.status = 'uploading';
  active = { item };
  const { promise, xhr } = upload(item.file, item.parentId, {
    onProgress: (loaded, total) => {
      item.loaded = loaded;
      item.total = total;
      item.percent = Math.round((loaded / total) * 100);
      render();
    },
  });
  active.xhr = xhr;
  promise
    .then(() => {
      item.status = 'done';
      item.percent = 100;
      bus.emit('reload');
      toast(`「${item.file.name}」上传完成`, 'ok');
      setTimeout(() => {
        const i = queue.indexOf(item);
        if (i < 0) render();
      }, 1800);
    })
    .catch((err) => {
      item.status = 'error';
      item.error = err.message;
      if (err.message !== '已取消') toast(`「${item.file.name}」${err.message}`, 'error');
    })
    .finally(() => {
      if (active && active.item === item) active = null;
      // 完成或失败的条目保留 3 秒供查看，然后移出队列
      setTimeout(() => {
        const i = queue.indexOf(item);
        if (i >= 0 && item.status !== 'uploading') {
          queue.splice(i, 1);
          render();
        }
      }, 3000);
      render();
      pump();
    });
  render();
}

let seq = 0;
export function enqueue(files, parentId) {
  for (const file of files) {
    queue.push({
      key: `u${++seq}`,
      file,
      parentId,
      status: 'pending',
      loaded: 0,
      total: file.size,
      percent: 0,
    });
  }
  minimized = false;
  pump();
}

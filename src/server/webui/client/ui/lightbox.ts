// @ts-nocheck
// 图片灯箱：多图切换、滚轮/双击/双指缩放、拖拽平移、滑动翻页
import { $, icon } from '../util.js';
import { downloadUrl } from '../api.js';

export function openLightbox(items, startIndex) {
  let index = Math.max(0, Math.min(startIndex, items.length - 1));
  let scale = 1;
  let tx = 0, ty = 0;

  const layers = document.getElementById('layers');
  const ov = document.createElement('div');
  ov.className = 'overlay lightbox';
  ov.innerHTML = `
    <div class="lb-backdrop"></div>
    <div class="lb-top">
      <button class="icon-btn lb-close" title="关闭">${icon('close')}</button>
      <span class="lb-name"></span>
      <span class="lb-count"></span>
      <a class="icon-btn" href="${downloadUrl(items[index].id)}" target="_blank" title="下载原图">${icon('download')}</a>
    </div>
    <div class="lb-stage" touch-action="none">
      <img class="lb-img" draggable="false" alt="" />
    </div>
    <button class="lb-nav lb-prev">${icon('chevronLeft')}</button>
    <button class="lb-nav lb-next">${icon('chevronRight')}</button>`;
  layers.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));

  const img = ov.querySelector('.lb-img');
  const stage = ov.querySelector('.lb-stage');

  const applyTransform = () => {
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  };
  const resetView = () => { scale = 1; tx = 0; ty = 0; applyTransform(); };

  const preload = () => {
    for (const d of [-1, 1]) {
      const i = index + d;
      if (i >= 0 && i < items.length) { new Image().src = downloadUrl(items[i].id); }
    }
  };

  const show = () => {
    const item = items[index];
    resetView();
    img.src = downloadUrl(item.id);
    ov.querySelector('.lb-name').textContent = item.name;
    ov.querySelector('.lb-count').textContent = `${index + 1} / ${items.length}`;
    const a = ov.querySelector('.lb-top a');
    a.href = downloadUrl(item.id);
    ov.querySelector('.lb-prev').style.display = index > 0 ? '' : 'none';
    ov.querySelector('.lb-next').style.display = index < items.length - 1 ? '' : 'none';
    preload();
  };

  const step = (d) => {
    const next = index + d;
    if (next < 0 || next >= items.length) return;
    index = next;
    show();
  };

  // ---- 关闭 ----
  const close = () => {
    document.removeEventListener('keydown', onKey);
    ov.classList.remove('show');
    setTimeout(() => ov.remove(), 180);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  };
  document.addEventListener('keydown', onKey);
  ov.querySelector('.lb-close').addEventListener('click', close);
  ov.querySelector('.lb-backdrop').addEventListener('click', close);
  ov.querySelector('.lb-prev').addEventListener('click', () => step(-1));
  ov.querySelector('.lb-next').addEventListener('click', () => step(1));

  // ---- 滚轮缩放 ----
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
    const next = Math.min(8, Math.max(1, scale * factor));
    if (next === scale) { if (scale === 1) { tx = 0; ty = 0; } applyTransform(); return; }
    const rect = stage.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    tx = cx - ((cx - tx) * next) / scale;
    ty = cy - ((cy - ty) * next) / scale;
    scale = next;
    if (scale === 1) { tx = 0; ty = 0; }
    applyTransform();
  }, { passive: false });

  stage.addEventListener('dblclick', () => {
    if (scale > 1) resetView();
    else { scale = 2; applyTransform(); }
  });

  // ---- 指针手势：单指平移/滑动翻页，双指捏合缩放 ----
  const pointers = new Map();
  let pinchStart = null;
  let panStart = null;
  let swipeCandidate = false;

  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale, tx, ty };
      panStart = null;
    } else if (pointers.size === 1) {
      panStart = { x: e.clientX, y: e.clientY, tx, ty };
      swipeCandidate = scale === 1;
    }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinchStart) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      scale = Math.min(8, Math.max(1, (pinchStart.scale * dist) / pinchStart.dist));
      if (scale === 1) { tx = 0; ty = 0; swipeCandidate = true; }
      applyTransform();
    } else if (pointers.size === 1 && panStart) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      if (scale > 1) {
        tx = panStart.tx + dx;
        ty = panStart.ty + dy;
        applyTransform();
      } else if (swipeCandidate) {
        // 跟手滑动预览
        img.style.transition = 'none';
        img.style.transform = `translateX(${dx * 0.6}px)`;
        stage.dataset.swipeDx = String(dx);
      }
    }
  });
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (pointers.size === 0) {
      if (scale === 1 && swipeCandidate) {
        const dx = Number(stage.dataset.swipeDx || 0);
        img.style.transition = '';
        if (dx < -60) { resetView(); step(1); }
        else if (dx > 60) { resetView(); step(-1); }
        else { img.style.transform = ''; }
      }
      swipeCandidate = false;
      panStart = null;
    }
  };
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);

  show();
  return close;
}

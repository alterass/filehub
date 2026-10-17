// @ts-nocheck
// 音频播放器（原生 HTML5 <audio>）：支持播放列表切换、上一首/下一首、下载
import { icon } from '../util.js';
import { rawUrl, downloadUrl } from '../api.js';

export function openAudioPlayer(item, playlist = []) {
  const index = Math.max(0, playlist.findIndex((p) => p.id === item.id));
  let current = index;

  const layers = document.getElementById('layers');
  const ov = document.createElement('div');
  ov.className = 'overlay audio-overlay';
  const multiple = playlist.length > 1;
  ov.innerHTML = `
    <div class="dialog-backdrop"></div>
    <div class="audio-card">
      <div class="audio-head">
        <button class="icon-btn audio-close" title="关闭">${icon('close')}</button>
        <span class="audio-title"></span>
        <a class="icon-btn" title="下载原文件" target="_blank">${icon('download')}</a>
      </div>
      <div class="audio-art">${icon('music')}</div>
      <div class="audio-name"></div>
      <div class="audio-meta"></div>
      <div class="audio-mount"></div>
      ${multiple ? `<div class="audio-nav">
        <button class="btn btn-ghost audio-prev">${icon('chevronLeft')} 上一首</button>
        <button class="btn btn-ghost audio-next">下一首 ${icon('chevronRight')}</button>
      </div>` : ''}
    </div>`;
  layers.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));

  const mount = ov.querySelector('.audio-mount');
  const audio = document.createElement('audio');
  audio.controls = true;
  audio.autoplay = true;
  audio.preload = 'metadata';
  audio.style.width = '100%';
  mount.appendChild(audio);

  const titleEl = ov.querySelector('.audio-title');
  const nameEl = ov.querySelector('.audio-name');
  const metaEl = ov.querySelector('.audio-meta');
  const downloadEl = ov.querySelector('a');

  const setCurrent = () => {
    const cur = playlist[current];
    audio.src = rawUrl(cur.id);
    titleEl.textContent = cur.name;
    nameEl.textContent = cur.name;
    metaEl.textContent = `${current + 1} / ${playlist.length}`;
    downloadEl.href = downloadUrl(cur.id);
    ov.querySelector('.audio-prev')?.toggleAttribute('disabled', current <= 0);
    ov.querySelector('.audio-next')?.toggleAttribute('disabled', current >= playlist.length - 1);
    audio.play().catch(() => { /* 浏览器可能拦截自动播放，用户可手动点击播放 */ });
  };

  const step = (d) => {
    const next = current + d;
    if (next < 0 || next >= playlist.length) return;
    current = next;
    setCurrent();
  };

  ov.querySelector('.audio-prev')?.addEventListener('click', () => step(-1));
  ov.querySelector('.audio-next')?.addEventListener('click', () => step(1));
  audio.addEventListener('ended', () => {
    if (current < playlist.length - 1) step(1);
  });

  const close = () => {
    document.removeEventListener('keydown', onKey);
    audio.pause();
    audio.removeAttribute('src');
    ov.classList.remove('show');
    setTimeout(() => ov.remove(), 180);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  ov.querySelector('.audio-close').addEventListener('click', close);
  ov.querySelector('.dialog-backdrop').addEventListener('click', close);

  setCurrent();
  return close;
}

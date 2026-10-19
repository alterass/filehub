// @ts-nocheck
// 视频播放器（xgplayer）：长按倍速（手机/鼠标通用）、播放列表切换
import { icon, formatRate } from '../util.js';
import { rawUrl, downloadUrl } from '../api.js';
import { state, MAX_LONG_PRESS_RATE } from '../store.js';

const LONG_PRESS_MS = 400;

/** 当前生效的长按加速倍率（个人设置，默认 2x，最大 5x） */
function longPressRate() {
  const n = Number(state.longPressRate);
  if (!Number.isFinite(n) || n < 1) return 2;
  return Math.min(MAX_LONG_PRESS_RATE, n);
}

export function openPlayer(item, playlist = []) {
  const index = Math.max(0, playlist.findIndex((p) => p.id === item.id));
  let current = index;
  let player = null;

  const layers = document.getElementById('layers');
  const ov = document.createElement('div');
  ov.className = 'overlay player-overlay';
  const multiple = playlist.length > 1;
  ov.innerHTML = `
    <div class="pl-stage">
      <div class="pl-head">
        <button class="icon-btn pl-close" title="关闭">${icon('close')}</button>
        <span class="pl-title"></span>
        <a class="icon-btn" title="下载原文件" target="_blank">${icon('download')}</a>
      </div>
      <div class="pl-box">
        <div class="pl-mount"></div>
        ${multiple ? `<button class="icon-btn pl-prev" title="上一个">${icon('chevronLeft')}</button>
        <button class="icon-btn pl-next" title="下一个">${icon('chevronRight')}</button>` : ''}
      </div>
    </div>`;
  layers.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));

  const mount = ov.querySelector('.pl-mount');
  const badge = document.createElement('div');
  badge.className = 'pl-speed-badge';
  badge.textContent = `▶▶ ${formatRate(longPressRate())}x`;
  mount.appendChild(badge);

  const Player = window.Player;
  if (!Player) {
    mount.innerHTML = '<div class="pl-error">播放器组件加载失败，请刷新页面重试</div>';
    return () => {};
  }

  // 全屏策略：
  //  - 设备判定用内置 Sniffer（基于 UA）：触屏笔记本仍算桌面，避免被误判为手机。
  //  - 移动端也必须走系统全屏（Fullscreen API / video.webkitEnterFullscreen）：
  //    xgplayer 的 rotateFullscreen 只是 CSS 旋转 + fixed 铺满页面，属于「伪全屏」，
  //    浏览器地址栏和系统导航栏依然可见，并不是真正的全屏。
  //  - 关闭「网页全屏」（cssFullscreen）：它同样只是把播放器放大到页面内。
  const isMobile = Player.Sniffer ? Player.Sniffer.device === 'mobile' : ('ontouchstart' in window);

  player = new Player({
    el: mount,
    url: rawUrl(playlist[current].id),
    autoplay: true,
    playsinline: true,
    lang: 'zh-cn',
    fluid: true,
    playbackRate: [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5],
    pip: !isMobile,
    cssFullscreen: false,          // 移除「网页全屏」，只保留系统全屏
    fullscreen: { rotateFullscreen: false },
  });

  // 移动端进入系统全屏后再尝试锁横屏：
  // requestFullscreen 是异步的，同一 tick 调 orientation.lock 会因「尚未全屏」被拒绝，
  // 所以必须等 fullscreen_change 事件；竖屏视频不强制旋转，iOS 不支持时静默忽略。
  const unlockOrientation = () => {
    if (!isMobile) return;
    try { screen.orientation?.unlock?.(); } catch { /* 不支持 */ }
  };
  player.on('fullscreen_change', (on) => {
    if (!on) { unlockOrientation(); return; }
    if (!isMobile || !screen.orientation?.lock) return;
    const media = player.media;
    if (!media || media.videoWidth <= media.videoHeight) return;
    try { screen.orientation.lock('landscape')?.catch?.(() => {}); } catch { /* 不支持 */ }
  });

  const setTitle = () => {
    ov.querySelector('.pl-title').textContent = playlist[current].name;
    ov.querySelector('a').href = downloadUrl(playlist[current].id);
  };
  setTitle();

  const step = (d) => {
    const next = current + d;
    if (next < 0 || next >= playlist.length) return;
    current = next;
    player.src = rawUrl(playlist[current].id);
    player.play();
    setTitle();
  };
  ov.querySelector('.pl-prev')?.addEventListener('click', () => step(-1));
  ov.querySelector('.pl-next')?.addEventListener('click', () => step(1));

  // ---------- 长按倍速 ----------
  let pressTimer = null;
  let fast = false;
  let originRate = 1;
  let swallowClickUntil = 0;

  const stage = ov.querySelector('.pl-stage');
  const startFast = () => {
    fast = true;
    originRate = player.playbackRate || 1;
    player.playbackRate = longPressRate();
    badge.classList.add('show');
    navigator.vibrate?.(30);
  };
  const endFast = () => {
    clearTimeout(pressTimer);
    pressTimer = null;
    if (fast) {
      fast = false;
      player.playbackRate = originRate;
      badge.classList.remove('show');
      swallowClickUntil = Date.now() + 400; // 松手后的 click 不应触发播放/暂停
    }
  };

  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.xg-controls, .pl-head, .xg-icon')) return;
    if (pressTimer) return;
    pressTimer = setTimeout(startFast, LONG_PRESS_MS);
  });
  stage.addEventListener('pointerup', endFast);
  stage.addEventListener('pointercancel', endFast);
  stage.addEventListener('pointerleave', endFast);
  stage.addEventListener('contextmenu', (e) => {
    // 长按在移动端可能触发系统菜单
    if (pressTimer || fast) e.preventDefault();
  });
  stage.addEventListener('click', (e) => {
    if (Date.now() < swallowClickUntil) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);

  // ---------- 关闭 ----------
  const close = () => {
    endFast();
    document.removeEventListener('keydown', onKey);
    unlockOrientation();
    try { player.destroy(); } catch { /* 已销毁 */ }
    ov.classList.remove('show');
    setTimeout(() => ov.remove(), 180);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  ov.querySelector('.pl-close').addEventListener('click', close);

  return close;
}

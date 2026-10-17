// @ts-nocheck
// 个人设置面板：长按加速倍数（可修改）与服务端工作目录（只读展示）
import { api } from '../api.js';
import {
  state, setLongPressRate, DEFAULT_LONG_PRESS_RATE, MAX_LONG_PRESS_RATE,
} from '../store.js';
import { icon, toast, formatRate } from '../util.js';

export async function openSettingsPanel() {
  const ov = document.createElement('div');
  ov.className = 'overlay settings-overlay';
  ov.innerHTML = `
    <div class="dialog-backdrop"></div>
    <div class="dialog settings-panel">
      <h3>${icon('settings')} 个人设置</h3>

      <div class="settings-section">
        <div class="settings-label">长按加速倍数</div>
        <div class="rate-control">
          <input id="rateRange" type="range" min="1" max="${MAX_LONG_PRESS_RATE}" step="0.5" value="${state.longPressRate}" />
          <span class="rate-value" id="rateValue">${formatRate(state.longPressRate)}x</span>
        </div>
        <div class="rate-chips" id="rateChips">
          ${[1, 1.5, 2, 2.5, 3, 4, 5]
            .map((r) => `<button class="rate-chip ${r === state.longPressRate ? 'active' : ''}" data-rate="${r}">${formatRate(r)}x</button>`)
            .join('')}
        </div>
        <p class="settings-hint">长按视频画面时加速播放。默认 ${formatRate(DEFAULT_LONG_PRESS_RATE)}x，最大 ${formatRate(MAX_LONG_PRESS_RATE)}x。</p>
      </div>

      <div class="settings-section">
        <div class="settings-label">${icon('folder')} 工作目录</div>
        <div class="settings-workdir" id="settingsWorkDir" title="服务端工作目录（只读）">读取中…</div>
      </div>

      <div class="dialog-actions">
        <button class="btn btn-ghost settings-close">关闭</button>
      </div>
    </div>`;
  document.getElementById('layers').appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));

  const close = () => { ov.classList.remove('show'); setTimeout(() => ov.remove(), 180); };
  ov.querySelector('.settings-close').addEventListener('click', close);
  ov.querySelector('.dialog-backdrop').addEventListener('click', close);

  const range = ov.querySelector('#rateRange');
  const valueEl = ov.querySelector('#rateValue');
  const chips = ov.querySelector('#rateChips');

  const apply = (rate) => {
    const next = setLongPressRate(rate);
    range.value = String(next);
    valueEl.textContent = `${formatRate(next)}x`;
    chips.querySelectorAll('.rate-chip').forEach((chip) => {
      chip.classList.toggle('active', Number(chip.dataset.rate) === next);
    });
    toast(`长按加速倍数已设为 ${formatRate(next)}x`, 'ok', 1500);
  };

  range.addEventListener('input', () => {
    valueEl.textContent = `${formatRate(range.value)}x`;
  });
  range.addEventListener('change', () => apply(parseFloat(range.value)));

  chips.addEventListener('click', (e) => {
    const chip = e.target.closest('.rate-chip');
    if (chip) apply(parseFloat(chip.dataset.rate));
  });

  // 工作目录：只读展示，数据来自服务端
  try {
    const info = await api.serverInfo();
    const workdir = ov.querySelector('#settingsWorkDir');
    if (workdir) {
      workdir.textContent = info.workDir;
      workdir.title = `${info.workDir}（${info.platform} · v${info.version}）`;
    }
  } catch {
    const workdir = ov.querySelector('#settingsWorkDir');
    if (workdir) workdir.textContent = '读取失败';
  }
}

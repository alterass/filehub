// @ts-nocheck
// 个人设置面板：长按加速倍数（可修改）、服务端工作目录（只读），
// 以及仅管理员可见的缩略图维护（补齐/重建/清理）
import { api } from '../api.js';
import {
  state, reload, setLongPressRate, DEFAULT_LONG_PRESS_RATE, MAX_LONG_PRESS_RATE,
} from '../store.js';
import { icon, toast, formatRate, formatSize } from '../util.js';
import { confirm } from './dialogs.js';

export async function openSettingsPanel() {
  const isAdmin = state.user?.role === 'admin';
  const ov = document.createElement('div');
  ov.className = 'overlay settings-overlay';
  ov.innerHTML = `
    <div class="dialog-backdrop"></div>
    <div class="dialog settings-panel" role="dialog" aria-label="个人设置">
      <div class="dialog-head">
        <h3>个人设置</h3>
        <button class="icon-btn settings-close" title="关闭">${icon('close')}</button>
      </div>

      <div class="settings-body">
        <section class="settings-section">
          <div class="settings-copy">
            <h4>视频长按加速</h4>
            <p>长按视频画面时加速播放。默认 ${formatRate(DEFAULT_LONG_PRESS_RATE)}x，最大 ${formatRate(MAX_LONG_PRESS_RATE)}x。</p>
          </div>
          <div class="settings-panel-body">
            <div class="rate-control">
              <input id="rateRange" type="range" min="1" max="${MAX_LONG_PRESS_RATE}" step="0.5" value="${state.longPressRate}" aria-label="长按加速倍数" />
              <span class="rate-value" id="rateValue">${formatRate(state.longPressRate)}x</span>
            </div>
            <div class="rate-chips" id="rateChips">
              ${[1, 1.5, 2, 2.5, 3, 4, 5]
                .map((r) => `<button class="rate-chip ${r === state.longPressRate ? 'active' : ''}" data-rate="${r}">${formatRate(r)}x</button>`)
                .join('')}
            </div>
          </div>
        </section>

        <section class="settings-section">
          <div class="settings-copy">
            <h4>工作目录</h4>
            <p>网盘根目录。配置、数据库与缩略图缓存都保存在其中的 .filehub 文件夹。</p>
          </div>
          <div class="settings-panel-body">
            <div class="settings-workdir" id="settingsWorkDir" title="服务端工作目录（只读）">读取中…</div>
          </div>
        </section>

        ${isAdmin ? `
        <section class="settings-section">
          <div class="settings-copy">
            <h4>缩略图维护</h4>
            <p>图片与视频封面由服务端后台生成。补齐缺失只处理还没有缓存的条目；全部重建会重新解码或抽帧并覆盖已有文件。</p>
          </div>
          <div class="settings-panel-body">
            <div class="thumb-stats" id="thumbStats">读取中…</div>
            <div class="thumb-actions">
              <button class="btn btn-ghost btn-sm" id="thumbMissing">补齐缺失</button>
              <button class="btn btn-ghost btn-sm" id="thumbForce">全部重建</button>
              <button class="btn btn-ghost btn-sm" id="thumbClean">清理过时</button>
            </div>
            <div class="thumb-progress" id="thumbProgress" hidden>
              <div class="thumb-bar"><i id="thumbBar"></i></div>
              <div class="thumb-progress-row">
                <span id="thumbProgressText"></span>
                <button class="btn btn-ghost btn-sm" id="thumbCancel">停止</button>
              </div>
            </div>
            <p class="settings-hint">任务在服务端后台执行，可以关掉此面板；完成后列表会自动刷新。</p>
          </div>
        </section>` : ''}
      </div>
    </div>`;
  document.getElementById('layers').appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));

  let stopPolling = () => {};
  const close = () => { stopPolling(); ov.classList.remove('show'); setTimeout(() => ov.remove(), 180); };
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

  if (isAdmin) mountThumbAdmin(ov, (fn) => { stopPolling = fn; });
}

/** 缩略图维护区块：统计、后台任务进度、清理（仅管理员） */
function mountThumbAdmin(ov, registerStop) {
  const statsEl = ov.querySelector('#thumbStats');
  const progressEl = ov.querySelector('#thumbProgress');
  const barEl = ov.querySelector('#thumbBar');
  const progressText = ov.querySelector('#thumbProgressText');
  let timer = null;
  let wasRunning = false;

  const stopPolling = () => { if (timer) { clearInterval(timer); timer = null; } };
  const startPolling = () => { if (!timer) timer = setInterval(() => { refresh().catch(() => {}); }, 1000); };
  registerStop(stopPolling);

  const refresh = async () => {
    const s = await api.thumbStatus();
    const job = s.job;
    let summary = `缓存 ${s.entries} 个文件 · ${formatSize(s.bytes)}`;
    if (job && !job.running && job.finishedAt) {
      summary += ` ｜ 上次${job.mode === 'force' ? '重建' : '补齐'}：成功 ${job.made} · 跳过 ${job.skipped} · 失败 ${job.failed}`;
    }
    statsEl.textContent = summary;

    if (job?.running) {
      wasRunning = true;
      const pct = job.total ? Math.round((job.done / job.total) * 100) : 0;
      progressEl.hidden = false;
      barEl.style.width = `${pct}%`;
      progressText.textContent =
        `${job.mode === 'force' ? '全部重建' : '补齐缺失'} ${job.done}/${job.total}（${pct}%）`
        + ` · 成功 ${job.made} 失败 ${job.failed}`
        + (job.current ? ` · ${job.current}` : '');
      return;
    }

    progressEl.hidden = true;
    if (!wasRunning) return;
    // 任务刚结束：提示结果，并让列表用新缩略图重新加载
    wasRunning = false;
    stopPolling();
    if (job?.error) toast(`缩略图任务失败：${job.error}`, 'error', 5000);
    else toast(`缩略图任务完成：成功 ${job.made} · 跳过 ${job.skipped} · 失败 ${job.failed}`, 'ok', 4000);
    state.thumbBust = Date.now();
    reload();
  };

  const start = async (mode, label) => {
    try {
      await api.thumbRebuild(mode);
      toast(`已开始${label}（后台执行）`, 'info', 2000);
      wasRunning = true;
      progressEl.hidden = false;
      startPolling();
      await refresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  ov.querySelector('#thumbMissing').addEventListener('click', () => start('missing', '补齐缺失缩略图'));
  ov.querySelector('#thumbForce').addEventListener('click', async () => {
    if (!(await confirm({
      title: '全部重建缩略图',
      message: '将重新解码/抽帧并覆盖现有缩略图，文件多时耗时较长（后台执行，可随时停止）。确定？',
    }))) return;
    start('force', '全部重建缩略图');
  });

  ov.querySelector('#thumbCancel').addEventListener('click', async () => {
    try {
      await api.thumbCancel();
      toast('已请求停止，等待当前项结束', 'info', 2000);
    } catch (err) { toast(err.message, 'error'); }
  });

  ov.querySelector('#thumbClean').addEventListener('click', async () => {
    if (!(await confirm({
      title: '清理过时缩略图',
      message: '将删除源文件已不存在/已被修改、以及类型不再适用的缓存文件。这些缩略图之后会按需重新生成。确定？',
    }))) return;
    try {
      const r = await api.thumbClean();
      const { reasons } = r;
      toast(
        `已清理 ${r.removed}/${r.scanned} 个缓存文件，释放 ${formatSize(r.freedBytes)}`
        + `（无源文件 ${reasons.missingSource} · 源已改 ${reasons.sourceModified}`
        + ` · 类型不符 ${reasons.wrongKind} · 无效残留 ${reasons.invalid}）`,
        'ok', 6000,
      );
      state.thumbBust = Date.now();
      reload();
      await refresh();
    } catch (err) { toast(err.message, 'error'); }
  });

  refresh().catch((err) => { statsEl.textContent = err.message || '读取失败'; });
  // 打开面板时若已有任务在跑，直接接上进度
  api.thumbStatus().then((s) => { if (s.job?.running) { wasRunning = true; startPolling(); } }).catch(() => {});
}


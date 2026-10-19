// FileHub WebUI 样式 —— “档案卡片”：暖灰纸面、墨色界面、单一蓝色只用在数据上。
// 由 JSX <style> 内联，无独立 CSS 文件。
export const APP_CSS = String.raw`
/* ============================================================
   Tokens
   ============================================================ */
:root {
  --ground: #f1f3f5;
  --surface: #ffffff;
  --raised: #f6f7f8;
  --active: #eceef0;
  --border: #e3e6e9;
  --rule: #eef0f2;
  --control: #d4d8dc;
  --text: #15181b;
  --muted: #5b6167;
  --faint: #6b7278;
  --accent: #1d5fbf;
  --accent-soft: #eaf1fb;
  --accent-ink: #164a95;
  --primary: #16181a;
  --primary-fg: #fbfbfa;
  --positive: #1f6b45;
  --negative: #ad2f27;
  --negative-soft: #fbeeed;
  --warning: #8a4b12;
  --toast-bg: #16181a;
  --toast-fg: #f7f8f9;
  --toast-ok: #7bdb9f;
  --toast-err: #ff9c92;
  --toast-info: #a8c8ff;
  --shadow-pop: 0 18px 50px rgba(22, 27, 33, 0.16), 0 2px 8px rgba(22, 27, 33, 0.06);
  --shadow-dialog: 0 28px 90px rgba(16, 20, 24, 0.24), 0 2px 10px rgba(16, 20, 24, 0.08);
  --radius-card: 8px;
  --radius-control: 6px;
  --radius-chip: 4px;
  --header-h: 56px;
  --page-max: 1200px;
  --gap: 16px;
  --ease: cubic-bezier(0.22, 0.61, 0.36, 1);
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root {
    --ground: #0d0e0f;
    --surface: #151617;
    --raised: #1d1e20;
    --active: #26282a;
    --border: #292b2d;
    --rule: #212325;
    --control: #3d4044;
    --text: #f1f2f3;
    --muted: #b3b7bb;
    --faint: #a0a5aa;
    --accent: #7fb0ff;
    --accent-soft: #16243a;
    --accent-ink: #9cc3ff;
    --primary: #f1f2f3;
    --primary-fg: #141516;
    --positive: #6fd39a;
    --negative: #ff8a80;
    --negative-soft: #2c1917;
    --warning: #e0a66a;
    --toast-bg: #f1f2f3;
    --toast-fg: #141516;
    --toast-ok: #1f6b45;
    --toast-err: #ad2f27;
    --toast-info: #1d5fbf;
    --shadow-pop: 0 18px 50px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.35);
    --shadow-dialog: 0 28px 90px rgba(0, 0, 0, 0.7), 0 2px 10px rgba(0, 0, 0, 0.4);
    color-scheme: dark;
  }
}

/* ============================================================
   Base
   ============================================================ */
*, *::before, *::after { box-sizing: border-box; }
html, body { height: 100%; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: 'Geist', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, sans-serif;
  background: var(--ground);
  color: var(--text);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  touch-action: manipulation;
  overscroll-behavior: none;
}
button, input, select, textarea { font: inherit; color: inherit; }
button { cursor: pointer; }
input::placeholder { color: var(--faint); opacity: 1; }
::selection { background: color-mix(in srgb, var(--accent) 24%, transparent); }
[hidden] { display: none !important; }
a { color: inherit; }

.icon {
  width: 18px; height: 18px; flex: none;
  stroke-width: 1.7;
}
.num {
  font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Consolas, monospace;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}
.dim { color: var(--muted); }

/* thin scrollbars */
* { scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--muted) 30%, transparent) transparent; }
*::-webkit-scrollbar { width: 10px; height: 10px; }
*::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--muted) 28%, transparent);
  border-radius: 999px; border: 2px solid transparent; background-clip: padding-box;
}
*::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--muted) 45%, transparent); background-clip: padding-box; }
*::-webkit-scrollbar-track { background: transparent; }

/* ============================================================
   Controls
   ============================================================ */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  height: 36px; padding: 0 14px;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  background: var(--raised);
  color: var(--text);
  font-size: 13px; font-weight: 500;
  white-space: nowrap;
  transition: background 0.14s var(--ease), border-color 0.14s var(--ease), color 0.14s var(--ease), transform 0.1s var(--ease);
}
.btn:hover { background: var(--active); }
.btn:active { transform: translateY(1px); }
.btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
.btn-primary { background: var(--primary); color: var(--primary-fg); }
.btn-primary:hover { background: color-mix(in srgb, var(--primary) 86%, var(--text)); }
.btn-ghost { background: transparent; border-color: var(--border); }
.btn-ghost:hover { background: var(--raised); border-color: var(--control); }
.btn-danger { background: transparent; border-color: color-mix(in srgb, var(--negative) 42%, transparent); color: var(--negative); }
.btn-danger:hover { background: var(--negative-soft); border-color: var(--negative); }
.btn-sm { height: 30px; padding: 0 10px; font-size: 12px; border-radius: 5px; }
.btn-block { width: 100%; }
.btn .icon { width: 16px; height: 16px; }

.icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px;
  border: none; border-radius: var(--radius-control);
  background: transparent; color: var(--muted);
  transition: background 0.14s var(--ease), color 0.14s var(--ease), transform 0.1s var(--ease);
}
.icon-btn:hover { background: var(--raised); color: var(--text); }
.icon-btn:active { transform: scale(0.95); }
.icon-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.icon-btn .icon { width: 18px; height: 18px; }

.input {
  width: 100%; height: 40px; padding: 0 12px;
  border: 1px solid var(--control); border-radius: var(--radius-control);
  background: var(--surface); color: var(--text);
  outline: none;
  transition: border-color 0.14s var(--ease), box-shadow 0.14s var(--ease);
}
.input:hover { border-color: color-mix(in srgb, var(--control) 70%, var(--text)); }
.input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent); }

.loading-spin {
  width: 22px; height: 22px; margin: 64px auto;
  border: 2px solid var(--border); border-top-color: var(--text);
  border-radius: 50%; animation: spin 0.75s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ============================================================
   Top bar
   ============================================================ */
.app-header {
  position: sticky; top: 0; z-index: 30;
  height: var(--header-h);
  background: var(--ground);
  border-bottom: 1px solid var(--border);
}
.header-inner {
  height: 100%;
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 0 24px;
  display: flex; align-items: center; gap: 20px;
}
.brand {
  display: inline-flex; align-items: center; gap: 8px;
  text-decoration: none; user-select: none;
  font-size: 15px; font-weight: 600; letter-spacing: -0.01em;
  flex: none;
}
.brand .brand-mark {
  width: 26px; height: 26px;
  display: flex; align-items: center; justify-content: center;
  color: var(--text);
}
.brand .brand-mark-svg { width: 26px; height: 26px; display: block; }

.search-box {
  flex: 1; min-width: 0; max-width: 420px;
  height: 36px;
  display: flex; align-items: center; gap: 8px;
  padding: 0 8px 0 12px;
  background: var(--surface);
  border: 1px solid var(--control);
  border-radius: var(--radius-control);
  transition: border-color 0.14s var(--ease), box-shadow 0.14s var(--ease);
}
.search-box:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent); }
.search-box > .icon { color: var(--muted); width: 15px; height: 15px; }
.search-box input {
  flex: 1; min-width: 0;
  border: none; background: transparent; outline: none;
  font-size: 13px;
}
.search-box input::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; }
.search-box .icon-btn { width: 24px; height: 24px; }
.search-box .icon-btn .icon { width: 14px; height: 14px; }

.header-actions { margin-left: auto; display: flex; align-items: center; gap: 4px; }
.header-divider { width: 1px; height: 20px; background: var(--border); margin: 0 8px; flex: none; }
.user-chip {
  display: inline-flex; align-items: center; gap: 8px;
  height: 36px; padding: 0 8px 0 4px;
  border: none; border-radius: var(--radius-control);
  background: transparent; max-width: 170px;
  transition: background 0.14s var(--ease);
}
.user-chip:hover { background: var(--raised); }
.user-chip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.avatar {
  width: 26px; height: 26px; flex: none;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: var(--active); color: var(--text);
  font-size: 11px; font-weight: 600;
  text-transform: uppercase;
}
.user-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: var(--muted); }
#btnMenu { display: none; }

/* ============================================================
   Page canvas
   ============================================================ */
.file-area { position: relative; padding-bottom: 96px; min-height: calc(100vh - var(--header-h)); }
.page { max-width: var(--page-max); margin: 0 auto; padding: 0 24px; }

.crumb-row { padding-top: 22px; min-height: 20px; }
.crumbs { display: flex; align-items: center; gap: 1px; overflow-x: auto; scrollbar-width: none; }
.crumbs::-webkit-scrollbar { display: none; }
.crumb {
  border: none; background: transparent;
  padding: 3px 6px; border-radius: 4px;
  display: inline-flex; align-items: center; gap: 6px;
  white-space: nowrap; color: var(--muted);
  font-size: 13px; flex: none;
  transition: background 0.12s var(--ease), color 0.12s var(--ease);
}
.crumb:hover { background: var(--raised); color: var(--text); }
.crumb:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.crumb.current { color: var(--text); font-weight: 500; }
.crumb .icon { width: 15px; height: 15px; }
.crumb-sep { color: var(--faint); display: inline-flex; flex: none; }
.crumb-sep .icon { width: 13px; height: 13px; }
.search-crumb { color: var(--text); }

.page-head {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 20px; margin-top: 12px;
}
.page-head-main { min-width: 0; }
h1.page-title {
  margin: 0;
  font-size: 26px; line-height: 1.18; font-weight: 600;
  letter-spacing: -0.025em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  max-width: 100%;
}
.page-meta {
  margin: 7px 0 0;
  color: var(--muted); font-size: 13px;
  display: flex; flex-wrap: wrap; align-items: center; gap: 0 6px;
}
.page-meta .dot { color: var(--faint); }
.page-meta .num { font-size: 12.5px; }
.page-meta b { font-weight: 500; color: var(--text); }

.head-tools { display: flex; align-items: center; gap: 6px; flex: none; padding-bottom: 2px; }
.seg {
  display: inline-flex; align-items: center; gap: 2px;
  padding: 2px;
  background: var(--raised);
  border: 1px solid var(--border);
  border-radius: 7px;
}
.seg-btn {
  width: 30px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid transparent; border-radius: 5px;
  background: transparent; color: var(--muted);
  transition: background 0.12s var(--ease), color 0.12s var(--ease), border-color 0.12s var(--ease);
}
.seg-btn:hover { color: var(--text); }
.seg-btn.active { background: var(--surface); border-color: var(--border); color: var(--text); }
.seg-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.seg-btn .icon { width: 16px; height: 16px; }

/* ============================================================
   Content grid + rail
   ============================================================ */
.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 288px;
  gap: 24px;
  align-items: start;
  margin-top: 22px;
}
.content-grid.no-rail { grid-template-columns: minmax(0, 1fr); }
.content-main { min-width: 0; }
.rail {
  position: sticky;
  top: calc(var(--header-h) + 18px);
  display: flex; flex-direction: column; gap: 24px;
  min-width: 0;
}
.rail-section { min-width: 0; }
.rail-title {
  margin: 0 0 9px;
  color: var(--muted); font-size: 12px; font-weight: 500;
}
.rail-media {
  display: block; width: 100%;
  padding: 0; text-align: left;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  overflow: hidden;
  transition: border-color 0.14s var(--ease), background 0.14s var(--ease);
}
.rail-media:hover { border-color: var(--control); background: var(--raised); }
.rail-media:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.rail-thumb {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  width: 100%; aspect-ratio: 4 / 3;
  background: var(--raised);
  color: var(--muted);
  overflow: hidden;
}
.rail-thumb .icon { width: 34px; height: 34px; }
.rail-thumb img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
.rail-media-copy { display: block; padding: 10px 12px 12px; }
.rail-media-name {
  display: block;
  font-size: 13px; line-height: 1.35;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.rail-media-meta {
  display: block;
  margin-top: 3px;
  color: var(--faint); font-size: 11px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.rail-empty {
  padding: 26px 20px;
  text-align: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  color: var(--faint); font-size: 12px; line-height: 1.55;
}
.rail-empty .icon { width: 24px; height: 24px; margin-bottom: 8px; }
.rail-empty p { margin: 0; }
.rail-types {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 13px 14px;
}
.type-row + .type-row { margin-top: 12px; }
.type-line {
  display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  color: var(--muted); font-size: 12px;
}
.type-line .num { color: var(--text); font-size: 11.5px; }
.type-bar {
  height: 3px; margin-top: 5px;
  background: var(--rule); border-radius: 999px; overflow: hidden;
}
.type-bar i { display: block; height: 100%; background: var(--control); border-radius: 999px; }
.type-row:first-child .type-bar i { background: var(--accent); }

/* ============================================================
   Shelf / file list
   ============================================================ */
.shelf {
  margin-top: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
}
.shelf.grid { background: transparent; border: none; }

.list-head {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 112px 96px 150px 34px;
  gap: 12px; align-items: center;
  height: 40px; padding: 0 14px;
  color: var(--faint); font-size: 12px;
  border-bottom: 1px solid var(--rule);
  position: sticky; top: var(--header-h); z-index: 3;
  background: var(--surface);
  border-radius: var(--radius-card) var(--radius-card) 0 0;
}
.list-head .num { text-align: right; font-family: 'Geist', system-ui, sans-serif; font-variant-numeric: normal; }
.shelf.grid .list-head { display: none; }

.file-list.list { display: flex; flex-direction: column; padding: 6px; }
.file-list.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 14px;
  padding: 0;
  margin-top: 18px;
}

/* 列表底部的收纳行：把卡片收口，并说明拖拽上传的用法 */
.list-foot {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  min-height: 42px; padding: 8px 16px;
  border-top: 1px solid var(--rule);
  color: var(--faint); font-size: 12px;
}
.list-foot .num { color: var(--muted); font-size: 11.5px; }

.frow {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 112px 96px 150px 34px;
  gap: 12px; align-items: center;
  min-height: 46px; padding: 5px 8px;
  border-radius: 5px;
  cursor: pointer; user-select: none;
  transition: background 0.12s var(--ease);
}
.frow:hover { background: var(--raised); }
.frow:active { background: var(--active); }
.frow:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.frow.dragging { opacity: 0.45; }
.frow.drop-target { background: var(--accent-soft); outline: 1.5px solid var(--accent); outline-offset: -1.5px; }

.ficon, .ticon { position: relative; display: flex; align-items: center; justify-content: center; }
.ficon { width: 34px; height: 34px; }
.ficon .icon { width: 20px; height: 20px; }
.ficon .thumb-img {
  position: absolute; inset: 2px;
  width: calc(100% - 4px); height: calc(100% - 4px);
  object-fit: cover; border-radius: 4px; display: block;
}
.k-folder { color: var(--accent); }
.k-image, .k-video, .k-audio, .k-archive, .k-code, .k-text, .k-other { color: var(--muted); }

.fname { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.fname .nt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.frow .fname .nt { font-weight: 400; }
.ftype { color: var(--muted); font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fpath { color: var(--faint); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fsub { display: none; color: var(--faint); font-size: 11px; line-height: 1.3; }
.fsize, .fdate { color: var(--muted); font-size: 12.5px; text-align: right; white-space: nowrap; }
.fmore {
  width: 30px; height: 30px;
  border: none; border-radius: 5px;
  background: transparent; color: var(--muted);
  display: inline-flex; align-items: center; justify-content: center;
  opacity: 0;
  transition: opacity 0.13s var(--ease), background 0.13s var(--ease), color 0.13s var(--ease);
}
.frow:hover .fmore, .ftile:hover .fmore { opacity: 1; }
.fmore:hover { background: var(--active); color: var(--text); }
.fmore:focus-visible { opacity: 1; outline: 2px solid var(--accent); outline-offset: 1px; }
.fmore .icon { width: 18px; height: 18px; }

/* grid tiles */
.ftile {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 8px;
  cursor: pointer; user-select: none;
  transition: border-color 0.14s var(--ease), background 0.14s var(--ease);
}
.ftile:hover { border-color: var(--control); background: var(--raised); }
.ftile:active { background: var(--active); }
.ftile:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ftile.dragging { opacity: 0.45; }
.ftile.drop-target { border-color: var(--accent); background: var(--accent-soft); }
.ticon {
  width: 100%; aspect-ratio: 4 / 3;
  border-radius: 5px;
  background: var(--raised);
  overflow: hidden;
}
.ftile:hover .ticon { background: var(--active); }
.ticon .icon { width: 34px; height: 34px; }
.ticon .thumb-img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover; border-radius: 5px; display: block;
}
.tmeta { padding: 9px 2px 1px; min-width: 0; }
.tname { font-size: 13px; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tsub { margin-top: 2px; color: var(--faint); font-size: 11px; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ftile .fmore { position: absolute; top: 12px; right: 12px; background: var(--surface); border: 1px solid transparent; }
.ftile .fmore:hover { background: var(--active); border-color: var(--border); }

/* touch: always show the trailing action */
@media (hover: none) { .fmore { opacity: 1; } }

/* skeleton */
.sk-row {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 112px 96px 150px 34px;
  gap: 12px; align-items: center;
  min-height: 46px; padding: 5px 8px;
}
.sk {
  display: block; height: 10px; border-radius: 3px;
  background: var(--raised);
  animation: sk-pulse 1.2s ease-in-out infinite alternate;
}
.sk-icon { width: 22px; height: 22px; border-radius: 4px; }
.sk-name { width: 46%; }
.sk-type { width: 48px; }
.sk-size { width: 44px; justify-self: end; }
.sk-date { width: 80px; justify-self: end; }
@keyframes sk-pulse { from { opacity: 0.55; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .sk { animation: none; }
}

/* empty / error */
.empty {
  margin-top: 0;
  min-height: 320px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center;
  padding: 64px 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
}
.empty .empty-icon { color: var(--faint); display: flex; }
.empty .empty-icon .icon { width: 42px; height: 42px; stroke-width: 1.4; }
.empty h2 { margin: 18px 0 4px; font-size: 17px; font-weight: 500; letter-spacing: -0.01em; }
.empty p { margin: 0; color: var(--muted); font-size: 13px; max-width: 42ch; }
.empty .btn { margin-top: 20px; }
.load-error {
  margin-top: 0; padding: 40px 24px; text-align: center;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-card);
  color: var(--negative);
}

/* drop hint */
.drop-hint {
  position: fixed; inset: 12px; z-index: 45;
  display: flex; align-items: center; justify-content: center;
  border: 2px dashed var(--accent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent-soft) 92%, transparent);
  color: var(--accent-ink);
  font-size: 15px; font-weight: 500;
  pointer-events: none;
}

/* floating upload removed: the top bar's 上传 is the one primary action at every width */

/* ============================================================
   Auth
   ============================================================ */
.auth-view {
  min-height: 100vh; min-height: 100svh;
  display: grid; place-items: center;
  padding: 32px;
  background: var(--ground);
}
.auth-shell {
  width: min(940px, 100%);
  min-height: 560px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 420px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}
.auth-intro {
  display: flex; flex-direction: column;
  padding: 36px 40px 32px;
  background: var(--raised);
  border-right: 1px solid var(--border);
}
.auth-brand { display: inline-flex; align-items: center; gap: 9px; font-size: 15px; font-weight: 600; }
.auth-logo {
  width: 32px; height: 32px;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--text);
}
.auth-logo .brand-mark-svg { width: 30px; height: 30px; display: block; }
.auth-statement {
  margin: 64px 0 0;
  font-size: 34px; line-height: 1.16; font-weight: 500;
  letter-spacing: -0.03em;
  max-width: 12ch;
}
.auth-lead {
  margin: 16px 0 0;
  max-width: 38ch;
  color: var(--muted); font-size: 14px; line-height: 1.65;
}
.auth-facts {
  margin-top: auto; padding-top: 28px;
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px;
  color: var(--faint); font-size: 12px;
}
.auth-facts .sep { width: 1px; height: 11px; background: var(--control); }
.auth-card {
  padding: 44px 36px;
  display: flex; flex-direction: column; justify-content: center;
}
.auth-error {
  width: 420px; max-width: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 32px;
}
.auth-error h1 { margin: 0 0 6px; font-size: 21px; font-weight: 600; letter-spacing: -0.02em; }
.auth-error .btn { margin-top: 18px; }
.auth-card h1 { margin: 0 0 6px; font-size: 22px; line-height: 1.25; font-weight: 600; letter-spacing: -0.02em; }
.auth-sub { color: var(--muted); margin: 0 0 26px; line-height: 1.6; font-size: 13px; }
.auth-form .field { display: block; margin-bottom: 16px; position: relative; }
.field-label { display: block; margin-bottom: 7px; color: var(--muted); font-size: 13px; font-weight: 500; }
.auth-form .input { height: 42px; padding: 0 12px; }
.auth-form .field.has-eye .input { padding-right: 44px; }
.field-eye {
  position: absolute; right: 5px; bottom: 4px;
  width: 34px; height: 34px; border: none; border-radius: 5px;
  background: transparent; color: var(--muted);
  display: flex; align-items: center; justify-content: center;
}
.field-eye:hover { background: var(--raised); color: var(--text); }
.field-eye:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.field-eye .icon { width: 16px; height: 16px; }
.form-error {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 10px 12px; margin: 0 0 14px;
  border: 1px solid color-mix(in srgb, var(--negative) 32%, transparent);
  border-radius: var(--radius-control);
  background: var(--negative-soft); color: var(--negative);
  font-size: 12.5px; line-height: 1.5;
}
.form-error .icon { width: 15px; height: 15px; flex: none; margin-top: 1px; }
.auth-form .btn-primary { width: 100%; height: 44px; font-size: 14px; }
.btn .spinner {
  width: 15px; height: 15px; border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--primary-fg) 36%, transparent); border-top-color: var(--primary-fg);
  animation: spin 0.7s linear infinite; display: inline-block;
}

/* ============================================================
   Overlays, dialog, menu, sheet
   ============================================================ */
.overlay { position: fixed; inset: 0; z-index: 100; }
.overlay:not(.show) { pointer-events: none; }
.dialog-backdrop, .lb-backdrop {
  position: absolute; inset: 0;
  background: rgba(18, 15, 12, 0.46);
  opacity: 0; transition: opacity 0.18s var(--ease);
}
.overlay.show .dialog-backdrop, .overlay.show .lb-backdrop { opacity: 1; }
.lightbox .lb-backdrop { background: rgba(8, 8, 8, 0.97); }

.dialog {
  position: absolute; left: 50%; top: 50%;
  transform: translate(-50%, -50%) scale(0.985);
  width: 420px; max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  display: flex; flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow-dialog);
  opacity: 0;
  transition: opacity 0.18s var(--ease), transform 0.18s var(--ease);
  overflow: hidden;
}
.overlay.show .dialog { opacity: 1; transform: translate(-50%, -50%) scale(1); }
.dialog-head {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 16px 20px; border-bottom: 1px solid var(--rule);
  flex: none;
}
.dialog-head h3 { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
.dialog-body { padding: 20px; overflow-y: auto; }
.dialog-label { color: var(--muted); margin: 0 0 14px; line-height: 1.6; font-size: 13px; }
.dialog-actions {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 4px 20px 20px; flex: none;
}
.dialog-tree { width: 480px; }
.mv-tree {
  max-height: 340px; overflow-y: auto;
  border: 1px solid var(--border); border-radius: var(--radius-control);
  padding: 4px; background: var(--surface);
}
.mv-node {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px 8px calc(10px + var(--depth, 0) * 18px);
  border-radius: 4px; cursor: pointer; font-size: 13px;
}
.mv-node:hover { background: var(--raised); }
.mv-node.selected { background: var(--accent-soft); color: var(--accent-ink); }
.mv-node.disabled { opacity: 0.4; cursor: not-allowed; }
.mv-node .icon { width: 15px; height: 15px; color: var(--muted); }
.mv-node.selected .icon { color: var(--accent); }

.menu-pop {
  position: absolute; z-index: 5; min-width: 168px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow-pop);
  padding: 5px;
  opacity: 0; transform: scale(0.975);
  transition: opacity 0.14s var(--ease), transform 0.14s var(--ease);
}
.overlay.show .menu-pop { opacity: 1; transform: scale(1); }
.menu-item {
  display: flex; align-items: center; gap: 10px; width: 100%;
  border: none; background: transparent;
  padding: 8px 10px; border-radius: 5px; text-align: left;
  font-size: 13px;
  transition: background 0.12s var(--ease), color 0.12s var(--ease);
}
.menu-item:hover { background: var(--raised); }
.menu-item:active { background: var(--active); }
.menu-item:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.menu-item .icon { width: 16px; height: 16px; color: var(--muted); }
.menu-item.danger { color: var(--negative); }
.menu-item.danger .icon { color: var(--negative); }

.sheet {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 5;
  background: var(--surface);
  border-top: 1px solid var(--border);
  border-radius: 12px 12px 0 0;
  box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.16);
  padding: 8px 8px calc(12px + env(safe-area-inset-bottom));
  transform: translateY(100%);
  transition: transform 0.22s var(--ease);
}
.sheet::before {
  content: ''; display: block;
  width: 32px; height: 4px; margin: 2px auto 8px;
  border-radius: 999px; background: var(--control);
}
.overlay.show .sheet { transform: translateY(0); }
.sheet .menu-item { padding: 12px 12px; font-size: 14px; }

/* ============================================================
   Upload queue panel
   ============================================================ */
.upload-panel {
  position: fixed; right: 18px; bottom: 18px; z-index: 40;
  width: 320px; max-width: calc(100vw - 36px);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-pop);
  overflow: hidden;
}
.up-head {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 10px 10px 14px;
  border-bottom: 1px solid var(--rule);
  font-size: 13px; font-weight: 500;
}
.up-title { flex: none; }
.up-count { color: var(--faint); font-size: 12px; flex: 1; }
.up-min { width: 26px; height: 26px; }
.up-min .icon { transform: rotate(-90deg); width: 15px; height: 15px; }
.upload-panel.min .up-list { display: none; }
.up-list { max-height: 280px; overflow-y: auto; padding: 4px 14px 10px; }
.up-row { position: relative; padding: 10px 0 9px; border-bottom: 1px solid var(--rule); }
.up-row:last-child { border-bottom: none; }
.up-name { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 30px; }
.up-bar { height: 3px; border-radius: 999px; background: var(--rule); margin: 7px 0 5px; overflow: hidden; }
.up-bar i { display: block; height: 100%; width: 0; background: var(--accent); transition: width 0.2s var(--ease); }
.up-row.done .up-bar i { background: var(--positive); }
.up-row.error .up-bar i { background: var(--negative); }
.up-meta { font-size: 11.5px; color: var(--muted); display: flex; align-items: center; gap: 5px; }
.up-meta .icon { width: 12px; height: 12px; color: var(--positive); }
.up-err { color: var(--negative); }
.up-cancel { position: absolute; right: 0; top: 8px; width: 26px; height: 26px; }

/* ============================================================
   Lightbox
   ============================================================ */
.lb-top {
  position: absolute; top: 0; left: 0; right: 0; z-index: 6;
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; color: #e8e6e2;
}
.lb-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.lb-count { color: #9d9a95; font-size: 12px; }
.lb-top .icon-btn { color: #b9b5af; }
.lb-top .icon-btn:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
.lb-stage {
  position: absolute; inset: 52px 0 0; display: flex;
  align-items: center; justify-content: center; overflow: hidden;
  touch-action: none;
}
.lb-img {
  max-width: 94%; max-height: 92%;
  transition: transform 0.15s var(--ease);
  will-change: transform;
  user-select: none; -webkit-user-drag: none;
}
.lb-nav {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 6;
  width: 44px; height: 44px; border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 50%;
  background: rgba(20, 20, 20, 0.36); color: #fff;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.14s var(--ease), border-color 0.14s var(--ease);
}
.lb-nav:hover { background: rgba(255, 255, 255, 0.16); border-color: rgba(255, 255, 255, 0.35); }
.lb-prev { left: 14px; }
.lb-next { right: 14px; }

/* ============================================================
   Video player
   ============================================================ */
.player-overlay { background: #000; }
.pl-stage { position: absolute; inset: 0; display: flex; flex-direction: column; }
.pl-head {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; color: #e8e6e2;
}
.pl-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.pl-head .icon-btn { color: #b9b5af; }
.pl-head .icon-btn:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
.pl-box { position: relative; flex: 1; display: flex; align-items: center; }
.pl-mount { width: 100%; }
.pl-mount .xgplayer { width: 100% !important; }
.pl-prev, .pl-next {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 6;
  width: 42px; height: 42px; border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 50%; background: rgba(18, 18, 18, 0.4); color: #fff;
}
.pl-prev:hover, .pl-next:hover { background: rgba(255, 255, 255, 0.16); }
.pl-prev { left: 12px; }
.pl-next { right: 12px; }
.pl-speed-badge {
  position: absolute; top: 14px; left: 50%;
  transform: translateX(-50%) scale(0.94);
  z-index: 30; pointer-events: none;
  background: rgba(10, 10, 10, 0.78); color: #fff;
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 14px; font-weight: 500; letter-spacing: 0.02em;
  padding: 7px 14px; border-radius: 5px;
  opacity: 0; transition: opacity 0.15s var(--ease), transform 0.15s var(--ease);
}
.pl-speed-badge.show { opacity: 1; transform: translateX(-50%) scale(1); }
.pl-error { color: #e8e6e2; text-align: center; padding: 60px 20px; }

/* ============================================================
   Admin panel
   ============================================================ */
.admin-panel { width: 640px; }
.admin-toolbar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 14px 20px; border-bottom: 1px solid var(--rule);
}
.admin-toolbar p { margin: 0; color: var(--muted); font-size: 12.5px; }
.admin-list { max-height: 420px; overflow-y: auto; padding: 4px 20px 12px; }
.admin-row {
  display: flex; align-items: center; gap: 12px;
  min-height: 54px; padding: 8px 0;
  border-bottom: 1px solid var(--rule);
}
.admin-row:last-child { border-bottom: none; }
.au-name { flex: 1; display: flex; align-items: center; gap: 9px; min-width: 0; }
.au-name > span:not(.avatar) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13.5px; }
.au-role, .au-me {
  font-style: normal; font-size: 11px; line-height: 20px; height: 20px; padding: 0 7px;
  border-radius: var(--radius-chip); white-space: nowrap; flex: none;
}
.au-role { background: var(--accent-soft); color: var(--accent-ink); }
.au-me { background: var(--raised); color: var(--muted); border: 1px solid var(--border); }
.au-actions { display: flex; gap: 4px; flex: none; }
.au-actions .btn { color: var(--muted); }
.au-actions .btn:hover { color: var(--text); }
.au-actions .danger { color: var(--negative); }
.au-actions .danger:hover { color: var(--negative); background: var(--negative-soft); }

/* ============================================================
   Settings panel
   ============================================================ */
.settings-panel { width: 780px; }
.settings-body { padding: 4px 0 8px; overflow-y: auto; }
.settings-section {
  display: grid;
  grid-template-columns: 210px minmax(0, 1fr);
  gap: 28px;
  padding: 22px 24px;
  border-bottom: 1px solid var(--rule);
}
.settings-section:last-of-type { border-bottom: none; }
.settings-copy h4 { margin: 1px 0 6px; font-size: 14px; font-weight: 500; letter-spacing: -0.005em; }
.settings-copy p { margin: 0; color: var(--muted); font-size: 12.5px; line-height: 1.6; }
.settings-panel-body { min-width: 0; }
.settings-label { font-size: 14px; font-weight: 500; }
.settings-hint { color: var(--muted); font-size: 12px; line-height: 1.6; margin: 10px 0 0; }
.rate-control { display: flex; align-items: center; gap: 14px; }
.rate-control input[type='range'] { flex: 1; accent-color: var(--accent); height: 20px; }
.rate-value {
  min-width: 46px; text-align: right;
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 20px; font-weight: 500; color: var(--text);
}
.rate-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
.rate-chip {
  height: 30px; padding: 0 11px;
  border: 1px solid var(--border); border-radius: 5px;
  background: var(--surface); color: var(--muted);
  font-family: 'Geist Mono', ui-monospace, monospace;
  font-size: 12px;
  transition: background 0.12s var(--ease), color 0.12s var(--ease), border-color 0.12s var(--ease);
}
.rate-chip:hover { border-color: var(--control); color: var(--text); }
.rate-chip.active { background: var(--primary); border-color: var(--primary); color: var(--primary-fg); }
.settings-workdir {
  padding: 10px 12px;
  border: 1px solid var(--border); border-radius: var(--radius-control);
  background: var(--raised); color: var(--muted);
  font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 11.5px; line-height: 1.5;
  word-break: break-all; user-select: text;
}
.thumb-stats {
  padding: 10px 12px;
  border: 1px solid var(--border); border-radius: var(--radius-control);
  background: var(--raised); color: var(--muted);
  font-size: 12px; line-height: 1.6; margin-bottom: 10px;
}
.thumb-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.thumb-progress { margin-top: 14px; }
.thumb-bar { height: 3px; border-radius: 999px; background: var(--rule); overflow: hidden; }
.thumb-bar i { display: block; height: 100%; width: 0; background: var(--accent); transition: width 0.3s var(--ease); }
.thumb-progress-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 8px; }
.thumb-progress-row span { color: var(--muted); font-size: 11.5px; line-height: 1.5; word-break: break-all; }

/* ============================================================
   Audio player
   ============================================================ */
.audio-overlay { display: flex; align-items: center; justify-content: center; padding: 24px; }
.audio-card {
  position: relative; width: 420px; max-width: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px; padding: 18px;
  box-shadow: var(--shadow-dialog);
  opacity: 0; transform: translateY(10px) scale(0.985);
  transition: opacity 0.18s var(--ease), transform 0.18s var(--ease);
}
.overlay.show .audio-card { opacity: 1; transform: none; }
.audio-head { display: flex; align-items: center; gap: 6px; }
.audio-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: var(--muted); }
.audio-art {
  display: flex; align-items: center; justify-content: center;
  margin: 22px auto 14px; color: var(--faint);
}
.audio-art .icon { width: 64px; height: 64px; stroke-width: 1.2; }
.audio-name {
  font-size: 15px; font-weight: 500; text-align: center;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.audio-meta { text-align: center; color: var(--faint); font-size: 12px; margin: 4px 0 16px; }
.audio-mount { margin: 4px 0 6px; }
.audio-nav { display: flex; justify-content: space-between; gap: 8px; margin-top: 14px; }
.audio-nav .btn { flex: 1; }

/* ============================================================
   Document preview
   ============================================================ */
.doc-overlay { display: flex; align-items: center; justify-content: center; padding: 24px; }
.doc-panel {
  position: relative; width: min(980px, 100%); height: min(88vh, 920px);
  display: flex; flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow-dialog);
  overflow: hidden;
  opacity: 0; transform: translateY(10px) scale(0.99);
  transition: opacity 0.18s var(--ease), transform 0.18s var(--ease);
}
.overlay.show .doc-panel { opacity: 1; transform: none; }
.doc-head {
  display: flex; align-items: center; gap: 4px;
  padding: 8px 10px 8px 16px;
  border-bottom: 1px solid var(--border);
  flex: none;
}
.doc-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.doc-body { flex: 1; overflow: auto; background: var(--surface); }
.doc-mount { min-height: 100%; }
.doc-iframe { display: block; width: 100%; height: 100%; min-height: 70vh; border: 0; background: #fff; }
.doc-fallback { color: var(--muted); font-size: 12px; margin: 10px 16px; }
.doc-pre {
  margin: 0; padding: 24px 28px;
  white-space: pre-wrap; word-break: break-word;
  font: 13px/1.75 'Geist Mono', ui-monospace, SFMono-Regular, Consolas, monospace;
  color: var(--text);
}
.doc-md, .doc-epub-wrap { max-width: 720px; margin: 0 auto; padding: 36px 32px 80px; }
.doc-md h1, .doc-md h2, .doc-md h3 { line-height: 1.3; margin: 1.4em 0 0.5em; letter-spacing: -0.015em; }
.doc-md h1 { font-size: 24px; }
.doc-md h2 { font-size: 19px; }
.doc-md h3 { font-size: 16px; }
.doc-md p { margin: 0.7em 0; line-height: 1.7; }
.doc-md pre {
  background: var(--raised); border: 1px solid var(--border); border-radius: var(--radius-control);
  padding: 12px 14px; overflow-x: auto;
}
.doc-md code { font-family: 'Geist Mono', ui-monospace, Consolas, monospace; font-size: 0.92em; }
.doc-md blockquote {
  margin: 1em 0; padding: 2px 14px;
  border-left: 2px solid var(--border); color: var(--muted);
}
.doc-md img { max-width: 100%; border-radius: 6px; }
.doc-epub-title { font-size: 24px; margin: 0 0 20px; line-height: 1.3; letter-spacing: -0.02em; }
.epub-chapter { margin-bottom: 32px; }
.epub-chapter-title { font-size: 18px; margin: 0 0 10px; padding-bottom: 8px; border-bottom: 1px solid var(--rule); }
.doc-error { display: flex; align-items: center; gap: 10px; color: var(--negative); padding: 40px 24px; }
.doc-error .icon { width: 20px; height: 20px; }

/* ============================================================
   Toast
   ============================================================ */
#toasts {
  position: fixed; left: 50%; bottom: calc(22px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 200; display: flex; flex-direction: column; gap: 8px; align-items: center;
  pointer-events: none;
}
.toast {
  display: flex; align-items: center; gap: 9px;
  max-width: min(520px, calc(100vw - 32px));
  min-height: 40px; padding: 8px 14px;
  background: var(--toast-bg); color: var(--toast-fg);
  border-radius: var(--radius-control);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  font-size: 13px; line-height: 1.4;
  opacity: 0; transform: translateY(8px);
  transition: opacity 0.22s var(--ease), transform 0.22s var(--ease);
}
.toast.show { opacity: 1; transform: translateY(0); }
.toast .icon { width: 15px; height: 15px; flex: none; }
.t-ok .icon { color: var(--toast-ok); }
.t-error .icon { color: var(--toast-err); }
.t-info .icon { color: var(--toast-info); }

/* ============================================================
   Responsive
   ============================================================ */
@media (max-width: 1000px) {
  .list-head, .frow, .sk-row { grid-template-columns: 34px minmax(0, 1fr) 100px 90px 34px; }
  .fdate, .sk-date { display: none; }
  .head-date { display: none; }
  .content-grid { grid-template-columns: minmax(0, 1fr); }
  .rail { display: none; }
}

@media (max-width: 900px) {
  .auth-shell { grid-template-columns: 1fr; min-height: 0; }
  .auth-intro { border-right: none; border-bottom: 1px solid var(--border); padding: 26px 26px 24px; }
  .auth-statement { margin-top: 28px; font-size: 27px; max-width: 16ch; }
  .auth-lead { margin-top: 10px; font-size: 13px; }
  .auth-facts { margin-top: 18px; padding-top: 0; }
  .auth-card { padding: 30px 26px 34px; }
  .settings-panel, .admin-panel { width: 620px; }
  .settings-section { grid-template-columns: 170px minmax(0, 1fr); gap: 20px; padding: 18px 20px; }
}

@media (max-width: 640px) {
  :root { --header-h: 52px; }
  .header-inner { padding: 0 16px; gap: 8px; }
  .brand span:not(.brand-mark) { display: none; }
  .brand .brand-mark { width: 30px; height: 30px; }
  .search-box { max-width: none; height: 36px; }
  .search-box input { font-size: 16px; } /* prevent iOS focus zoom */
  #btnNewFolder, #btnUser, .header-divider { display: none; }
  #btnMenu { display: inline-flex; }
  #btnUpload { width: 36px; padding: 0; }
  #btnUpload span { display: none; }
  #btnUpload .icon { width: 18px; height: 18px; }
  .header-actions { gap: 2px; }
  .page { padding: 0 16px; }
  .crumb-row { padding-top: 16px; }
  .page-head { margin-top: 8px; align-items: center; gap: 10px; }
  h1.page-title { font-size: 22px; }
  .page-meta { margin-top: 5px; font-size: 13px; }
  .head-tools { gap: 2px; }
  .head-tools #btnRefresh { display: none; }
  .content-grid { margin-top: 16px; }
  .shelf { margin-top: 0; }
  .file-list.list { padding: 4px; }
  .list-head { display: none; }
  .frow, .sk-row {
    grid-template-columns: 34px minmax(0, 1fr) 30px;
    gap: 10px; min-height: 54px; padding: 6px 8px;
  }
  .frow .fsize, .frow .fdate, .frow .ftype { display: none; }
  .sk-type, .sk-size, .sk-date { display: none; }
  .fsub { display: block; font-size: 13px; }
  .fmore { opacity: 1; }
  .file-list.grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; margin-top: 14px; }
  .ftile { padding: 6px; }
  .tname { font-size: 13px; }
  .tsub { font-size: 12px; }
  .ftile .fmore { top: 10px; right: 10px; opacity: 1; }
  .empty { min-height: 320px; padding: 48px 20px; margin-top: 0; }
  .drop-hint { inset: 8px; font-size: 14px; }
  .auth-view { padding: 16px; }
  .dialog { max-width: calc(100vw - 20px); max-height: calc(100vh - 20px); }
  .dialog-head { padding: 14px 16px; }
  .dialog-body { padding: 16px; }
  .dialog-actions { padding: 4px 16px 16px; }
  .settings-panel, .admin-panel { width: calc(100vw - 20px); }
  .settings-section { grid-template-columns: 1fr; gap: 12px; padding: 18px 16px; }
  .settings-body { max-height: calc(100vh - 120px); }
  .admin-list { max-height: 56vh; padding: 4px 16px 12px; }
  .admin-toolbar { padding: 12px 16px; }
  .audio-overlay, .doc-overlay { padding: 0; }
  .audio-card { width: 100%; border-radius: 12px 12px 0 0; align-self: flex-end; border-bottom: none; }
  .doc-panel { width: 100%; height: 100%; max-height: none; border-radius: 0; border: none; }
  .doc-md, .doc-epub-wrap { padding: 24px 20px 64px; }
  .upload-panel { right: 12px; bottom: 12px; }
  #toasts { bottom: calc(14px + env(safe-area-inset-bottom)); }
}
`;

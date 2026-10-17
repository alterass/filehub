// WebUI 全部样式（由原 app.css 迁移而来）——经 JSX <style> 内联，无独立 CSS 文件
export const APP_CSS = String.raw`
/* FileHub WebUI —— 全响应式布局，随视口宽度自适应 */

/* ---------- 变量与基础 ---------- */
:root {
  --bg: #f4f6fa;
  --panel: #ffffff;
  --panel-2: #f8fafd;
  --fg: #18202f;
  --dim: #68738a;
  --line: #e3e8f0;
  --accent: #3b82f6;
  --accent-2: #8b5cf6;
  --accent-soft: #eaf2ff;
  --accent-fg: #ffffff;
  --danger: #e5484d;
  --danger-soft: #fdebec;
  --ok: #2f9e63;
  --radius: 10px;
  --radius-lg: 14px;
  --shadow-xs: 0 1px 2px rgba(15, 23, 42, 0.05);
  --shadow: 0 6px 24px rgba(15, 23, 42, 0.08);
  --shadow-lg: 0 16px 48px rgba(15, 23, 42, 0.16);
  --ring: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
  --header-h: 56px;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0e1116;
    --panel: #161a22;
    --panel-2: #1b202a;
    --fg: #e7ebf3;
    --dim: #8a93a6;
    --line: #262d3a;
    --accent: #4c8dff;
    --accent-2: #9d7bff;
    --accent-soft: #17253d;
    --danger: #f2555a;
    --danger-soft: #3a1719;
    --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.4);
    --shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
    --shadow-lg: 0 16px 48px rgba(0, 0, 0, 0.6);
    color-scheme: dark;
  }
}
* { box-sizing: border-box; }
html, body { height: 100%; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: var(--bg);
  color: var(--fg);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  touch-action: manipulation;
  overscroll-behavior: none;
}
button { font: inherit; color: inherit; cursor: pointer; }
input { font: inherit; color: inherit; }
input::placeholder { color: color-mix(in srgb, var(--dim) 70%, transparent); }
::selection { background: color-mix(in srgb, var(--accent) 26%, transparent); }
[hidden] { display: none !important; }
.icon { width: 18px; height: 18px; flex: none; }
.dim { color: var(--dim); }

/* ---------- 细滚动条 ---------- */
* { scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--dim) 32%, transparent) transparent; }
*::-webkit-scrollbar { width: 10px; height: 10px; }
*::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--dim) 30%, transparent);
  border-radius: 999px; border: 2px solid transparent; background-clip: padding-box;
}
*::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--dim) 48%, transparent); background-clip: padding-box;
}
*::-webkit-scrollbar-track { background: transparent; }

/* ---------- 通用控件 ---------- */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  border: 1px solid transparent; border-radius: 9px;
  padding: 7px 14px; background: var(--panel-2);
  font-weight: 500; box-shadow: var(--shadow-xs);
  transition: filter 0.15s, background 0.15s, box-shadow 0.15s, transform 0.12s, border-color 0.15s;
  white-space: nowrap;
}
.btn:hover { filter: brightness(0.96); box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08); }
.btn:active { transform: translateY(1px) scale(0.99); }
.btn:focus-visible { outline: none; box-shadow: var(--ring); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
.btn-primary { background: var(--accent); color: var(--accent-fg); }
.btn-primary:hover { filter: brightness(1.06); box-shadow: 0 6px 18px color-mix(in srgb, var(--accent) 32%, transparent); }
.btn-danger { background: var(--danger); color: #fff; }
.btn-danger:hover { filter: brightness(1.06); }
.btn-ghost { background: transparent; border-color: var(--line); box-shadow: none; }
.btn-sm { padding: 4px 10px; font-size: 13px; border-radius: 7px; }
.btn-block { width: 100%; justify-content: center; padding: 10px; }
.btn .icon { width: 16px; height: 16px; }

.icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border: none; border-radius: 9px;
  background: transparent; color: var(--dim);
  transition: background 0.15s, color 0.15s, transform 0.12s;
}
.icon-btn:hover { background: var(--accent-soft); color: var(--accent); }
.icon-btn:active { transform: scale(0.94); }
.icon-btn:focus-visible { outline: none; box-shadow: var(--ring); }
.icon-btn .icon { width: 19px; height: 19px; }

.input {
  width: 100%; padding: 9px 12px;
  border: 1px solid var(--line); border-radius: 9px;
  background: var(--panel); outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.input:focus { border-color: var(--accent); box-shadow: var(--ring); }

.loading-spin {
  width: 28px; height: 28px; margin: 48px auto;
  border: 3px solid var(--line); border-top-color: var(--accent);
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ---------- 认证页 ---------- */
.auth-view {
  min-height: 100vh; display: grid; place-items: center;
  padding: 24px; position: relative; overflow: hidden;
  background:
    radial-gradient(1100px 620px at 12% -12%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 62%),
    radial-gradient(900px 560px at 108% 112%, color-mix(in srgb, #8b5cf6 20%, transparent), transparent 62%),
    var(--bg);
}
.auth-orb {
  position: absolute; border-radius: 50%; pointer-events: none;
  filter: blur(90px); opacity: 0.5;
  background: radial-gradient(circle, var(--accent) 0%, transparent 70%);
}
.auth-orb.o1 { width: 420px; height: 420px; top: -120px; left: -100px; }
.auth-orb.o2 { width: 380px; height: 380px; bottom: -140px; right: -80px; background: radial-gradient(circle, #8b5cf6 0%, transparent 70%); }
.auth-card {
  width: 400px; max-width: 100%; position: relative;
  background: color-mix(in srgb, var(--panel) 82%, transparent);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--line);
  border-radius: 22px; padding: 40px 36px 34px;
  box-shadow: 0 24px 70px rgba(2, 6, 23, 0.35), 0 2px 8px rgba(2, 6, 23, 0.12);
  animation: card-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes card-in {
  from { opacity: 0; transform: translateY(14px) scale(0.98); }
  to { opacity: 1; transform: none; }
}
.auth-brand {
  display: flex; align-items: center; gap: 12px;
  font-weight: 800; font-size: 18px; letter-spacing: 0.3px;
  margin-bottom: 26px; justify-content: center;
}
.auth-logo {
  width: 44px; height: 44px; border-radius: 13px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--accent), #8b5cf6);
  color: #fff; box-shadow: 0 8px 22px color-mix(in srgb, var(--accent) 45%, transparent);
}
.auth-logo .icon { width: 24px; height: 24px; }
.auth-card h1 { font-size: 21px; margin: 0 0 6px; text-align: center; }
.auth-sub { color: var(--dim); margin: 0 0 24px; line-height: 1.55; text-align: center; font-size: 13px; }
.auth-form .field { display: block; margin-bottom: 16px; position: relative; }
.auth-form .input {
  height: 44px; padding: 0 44px 0 42px; border-radius: 12px;
  transition: border-color 0.15s, box-shadow 0.15s;
  background: color-mix(in srgb, var(--panel-2) 65%, transparent);
}
.auth-form .input:focus { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent); }
/* 图标/眼睛按钮与输入框（44px）垂直居中：label 用 .field-label 专类，避免误中图标元素 */
.auth-form .field-label {
  display: block; margin-bottom: 7px; color: var(--dim); font-size: 13px; font-weight: 500;
  line-height: 23.8px; height: 23.8px;
}
.field-icon {
  position: absolute; left: 13px; top: 30.8px; height: 44px;
  display: flex; align-items: center; color: var(--dim); pointer-events: none;
  transition: color 0.15s;
}
.auth-form .field:focus-within .field-icon { color: var(--accent); }
.field-icon .icon { width: 17px; height: 17px; }
.field-eye {
  position: absolute; right: 6px; top: 30.8px;
  width: 34px; height: 44px; border: none; background: transparent;
  color: var(--dim); border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
}
.field-eye:hover { color: var(--accent); background: var(--accent-soft); }
.field-eye .icon { width: 17px; height: 17px; }
.form-error {
  background: var(--danger-soft); color: var(--danger);
  padding: 9px 12px; border-radius: 10px; margin-bottom: 14px; font-size: 13px;
  display: flex; align-items: center; gap: 8px;
}
.form-error .icon { width: 15px; height: 15px; flex: none; }
.auth-form .btn-primary {
  height: 46px; border-radius: 12px; font-size: 15px; font-weight: 600;
  background: linear-gradient(135deg, var(--accent), #7c5cfc);
  box-shadow: 0 8px 20px color-mix(in srgb, var(--accent) 35%, transparent);
  transition: transform 0.15s, box-shadow 0.15s, filter 0.15s;
}
.auth-form .btn-primary:hover { transform: translateY(-1px); filter: brightness(1.05); }
.auth-form .btn-primary.loading { opacity: 0.7; transform: none; }
.btn .spinner {
  width: 15px; height: 15px; border-radius: 50%;
  border: 2px solid color-mix(in srgb, #fff 40%, transparent); border-top-color: #fff;
  animation: spin 0.7s linear infinite; display: inline-block;
}

/* ---------- 顶栏 ---------- */
.app-header {
  height: var(--header-h);
  display: flex; align-items: center; gap: 12px;
  padding: 0 16px;
  background: color-mix(in srgb, var(--panel) 88%, transparent);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--line);
  position: sticky; top: 0; z-index: 20;
}
.brand { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; letter-spacing: 0.2px; }
.brand .icon { color: var(--accent); width: 22px; height: 22px; }
.search-box {
  flex: 1; max-width: 420px; display: flex; align-items: center; gap: 8px;
  background: var(--panel-2); border: 1px solid var(--line);
  border-radius: 999px; padding: 0 12px; height: 36px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.search-box:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); }
.search-box .icon { color: var(--dim); width: 16px; height: 16px; }
.search-box input {
  flex: 1; border: none; background: transparent; outline: none; min-width: 0;
}
.search-box .icon-btn { width: 26px; height: 26px; }
.header-actions { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.user-chip {
  display: inline-flex; align-items: center; gap: 6px;
  height: 34px; padding: 0 12px; border: none; border-radius: 999px;
  background: var(--panel-2); max-width: 140px;
}
.user-chip .icon { width: 16px; height: 16px; color: var(--dim); }
.user-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ---------- 面包屑 ---------- */
.crumb-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px;
  background: color-mix(in srgb, var(--panel) 80%, transparent);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
  position: sticky; top: var(--header-h); z-index: 15;
}
.crumbs { display: flex; align-items: center; gap: 2px; overflow-x: auto; scrollbar-width: none; flex: 1; min-width: 0; }
.crumbs::-webkit-scrollbar { display: none; }
.crumb {
  border: none; background: transparent; padding: 4px 8px; border-radius: 7px;
  display: inline-flex; align-items: center; gap: 6px;
  white-space: nowrap; color: var(--dim); flex: none;
  transition: background 0.12s, color 0.12s;
}
.crumb:hover { background: var(--accent-soft); color: var(--accent); }
.crumb:active { background: color-mix(in srgb, var(--accent-soft) 70%, transparent); }
.crumb-sep { color: var(--dim); display: inline-flex; flex: none; }
.crumb-sep .icon { width: 14px; height: 14px; }
.crumb .icon { width: 16px; height: 16px; }
.search-crumb { color: var(--accent); }
.dir-stats { color: var(--dim); font-size: 12px; white-space: nowrap; }

/* ---------- 文件区域 ---------- */
.file-area { position: relative; padding: 12px 16px 96px; min-height: calc(100vh - var(--header-h) - 53px); }
.file-list.list { display: flex; flex-direction: column; gap: 2px; }
.file-list.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(clamp(96px, 14vw, 160px), 1fr));
  gap: 14px;
}

.frow {
  display: grid; grid-template-columns: 36px minmax(0, 1fr) 90px 150px 34px;
  align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: 10px; cursor: pointer; user-select: none;
  border: 1px solid transparent;
  transition: background 0.12s, border-color 0.12s, box-shadow 0.12s, transform 0.12s;
}
.frow:hover { background: var(--panel); border-color: var(--line); box-shadow: var(--shadow-xs); }
.frow:active { transform: scale(0.995); }
.ficon, .ticon { display: flex; align-items: center; justify-content: center; }
.ficon .icon, .ticon .icon { width: 22px; height: 22px; }
.k-folder { color: #4c9aff; }
.k-image { color: #35b37e; }
.k-video { color: #b35be0; }
.k-audio { color: #e0a13b; }
.k-archive { color: #c98a4b; }
.k-code { color: #4bc0c8; }
.k-text { color: var(--dim); }
.k-other { color: var(--dim); }

.fname { min-width: 0; display: flex; align-items: baseline; gap: 8px; }
.fname .nt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fpath { color: var(--dim); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: none; max-width: 45%; }
.fsize, .fdate { color: var(--dim); font-size: 13px; }
.fmore {
  border: none; background: transparent; color: var(--dim);
  width: 30px; height: 30px; border-radius: 6px;
  display: inline-flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.15s;
}
.frow:hover .fmore { opacity: 1; }
.fmore:hover { background: var(--accent-soft); color: var(--accent); }
.fmore .icon { width: 17px; height: 17px; }
/* 触屏设备无 hover，列表行“更多”按钮常显 */
@media (hover: none) { .fmore { opacity: 1; } }

/* 缩略图：图片垫底为类型图标，img 覆盖其上，加载失败时移除即露出图标 */
.ficon, .ticon { position: relative; overflow: hidden; }
/* 列表模式小图标居中 */
.ficon { display: flex; align-items: center; justify-content: center; }
.ficon .thumb-img {
  position: absolute; inset: 4px; width: calc(100% - 8px); height: calc(100% - 8px);
  object-fit: contain; border-radius: 7px; display: block;
}
/* 网格模式图标/缩略图区：正方形，内容居中，缩略图 contain 不拉伸不撑高 */
.ticon {
  width: 100%; aspect-ratio: 1; margin-bottom: 10px;
  border-radius: 12px; background: var(--panel-2);
  display: flex; align-items: center; justify-content: center;
}
.ticon .icon { width: 44px; height: 44px; }
.ticon .thumb-img {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: contain; border-radius: 12px; display: block;
}

.ftile {
  position: relative; background: var(--panel); border: 1px solid var(--line);
  border-radius: 14px; padding: 12px 12px 10px; text-align: center;
  cursor: pointer; user-select: none;
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
}
.ftile:hover {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
  transform: translateY(-3px);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--accent) 16%, transparent);
}
.ftile:active { transform: translateY(-1px) scale(0.98); }
.tname { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.empty { text-align: center; padding: 80px 0; color: var(--dim); }
.empty .icon { width: 52px; height: 52px; opacity: 0.5; }
.empty p { margin: 14px 0 4px; }
.load-error { text-align: center; padding: 48px; color: var(--danger); }

.drop-hint {
  position: absolute; inset: 10px; z-index: 15;
  display: flex; align-items: center; justify-content: center;
  border: 2px dashed var(--accent); border-radius: 14px;
  background: color-mix(in srgb, var(--accent-soft) 80%, transparent);
  color: var(--accent); font-size: 16px; font-weight: 600;
  pointer-events: none;
}

/* ---------- 悬浮上传按钮（手机模式） ---------- */
.fab {
  display: none; position: fixed; right: 20px; bottom: calc(24px + env(safe-area-inset-bottom));
  width: 56px; height: 56px; border-radius: 50%; border: none;
  background: var(--accent); color: var(--accent-fg);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4); z-index: 30;
  align-items: center; justify-content: center;
}
.fab .icon { width: 24px; height: 24px; }
@media (max-width: 640px) { .fab { display: flex; } }

/* ---------- 上传面板 ---------- */
.upload-panel {
  position: fixed; right: 16px; bottom: 16px; z-index: 40;
  width: 320px; max-width: calc(100vw - 32px);
  background: var(--panel); border: 1px solid var(--line);
  border-radius: 12px; box-shadow: var(--shadow);
}
.upload-panel .up-head {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px;
  border-bottom: 1px solid var(--line); font-weight: 600;
}
.up-count { color: var(--dim); font-size: 12px; flex: 1; }
.up-min { width: 26px; height: 26px; }
.up-min .icon { transform: rotate(-90deg); }
.upload-panel.min .up-list { display: none; }
.up-list { max-height: 260px; overflow-y: auto; padding: 6px 12px; }
.up-row { position: relative; padding: 8px 0; }
.up-name { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 30px; }
.up-bar { height: 4px; border-radius: 2px; background: var(--line); margin: 6px 0 4px; overflow: hidden; }
.up-bar i { display: block; height: 100%; background: var(--accent); transition: width 0.2s; }
.up-row.done .up-bar i { background: var(--ok); }
.up-row.error .up-bar i { background: var(--danger); }
.up-meta { font-size: 12px; color: var(--dim); display: flex; align-items: center; gap: 4px; }
.up-meta .icon { width: 13px; height: 13px; color: var(--ok); }
.up-err { color: var(--danger); }
.up-cancel { position: absolute; right: 0; top: 8px; width: 26px; height: 26px; }

/* ---------- 浮层 / 对话框 ---------- */
.overlay { position: fixed; inset: 0; z-index: 100; }
.overlay:not(.show) { pointer-events: none; }
.dialog-backdrop, .lb-backdrop {
  position: absolute; inset: 0;
  background: rgba(10, 14, 22, 0.5);
  opacity: 0; transition: opacity 0.18s;
}
.overlay.show .dialog-backdrop, .overlay.show .lb-backdrop { opacity: 1; }
.lightbox .lb-backdrop { background: rgba(5, 8, 14, 0.92); }
.dialog {
  position: absolute; left: 50%; top: 50%;
  transform: translate(-50%, -50%) scale(0.96);
  width: 400px; max-width: calc(100vw - 32px);
  background: var(--panel); border-radius: 14px;
  box-shadow: var(--shadow); padding: 20px;
  opacity: 0; transition: opacity 0.18s, transform 0.18s;
}
.overlay.show .dialog { opacity: 1; transform: translate(-50%, -50%) scale(1); }
.dialog h3 { margin: 0 0 12px; font-size: 16px; display: flex; align-items: center; gap: 8px; }
.dialog-label { color: var(--dim); margin: 0 0 14px; line-height: 1.6; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }

.dialog-tree { width: 420px; }
.mv-tree {
  max-height: 320px; overflow-y: auto;
  border: 1px solid var(--line); border-radius: 8px; padding: 6px;
}
.mv-node {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px 7px calc(10px + var(--depth, 0) * 20px);
  border-radius: 6px; cursor: pointer;
}
.mv-node:hover { background: var(--panel-2); }
.mv-node.selected { background: var(--accent-soft); color: var(--accent); }
.mv-node.disabled { opacity: 0.4; cursor: not-allowed; }
.mv-node .icon { width: 16px; height: 16px; color: #4c9aff; }

/* 操作菜单（电脑端浮层） */
.menu-pop {
  position: absolute; z-index: 5; min-width: 150px;
  background: var(--panel); border: 1px solid var(--line);
  border-radius: 10px; box-shadow: var(--shadow); padding: 5px;
  opacity: 0; transform: scale(0.97); transition: opacity 0.15s, transform 0.15s;
}
.overlay.show .menu-pop { opacity: 1; transform: scale(1); }
.menu-item {
  display: flex; align-items: center; gap: 10px; width: 100%;
  border: none; background: transparent;
  padding: 9px 12px; border-radius: 8px; text-align: left;
  transition: background 0.12s, color 0.12s;
}
.menu-item:hover { background: var(--panel-2); }
.menu-item:active { background: var(--accent-soft); }
.menu-item .icon { width: 16px; height: 16px; color: var(--dim); }
.menu-item.danger { color: var(--danger); }
.menu-item.danger .icon { color: var(--danger); }

/* 手机端底部面板 */
.sheet {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 5;
  background: var(--panel); border-radius: 16px 16px 0 0;
  padding: 10px 10px calc(14px + env(safe-area-inset-bottom));
  transform: translateY(100%); transition: transform 0.22s;
}
.overlay.show .sheet { transform: translateY(0); }
.sheet .menu-item { padding: 13px 14px; font-size: 15px; }

/* ---------- 灯箱 ---------- */
.lightbox .lb-backdrop { background: rgba(5, 8, 14, 0.92); }
.lb-top {
  position: absolute; top: 0; left: 0; right: 0; z-index: 6;
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; color: #dfe6f1;
}
.lb-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lb-count { color: #93a0b5; font-size: 13px; }
.lb-top .icon-btn { color: #aeb9cb; }
.lb-top .icon-btn:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }
.lb-stage {
  position: absolute; inset: 52px 0 0; display: flex;
  align-items: center; justify-content: center; overflow: hidden;
  touch-action: none;
}
.lb-img {
  max-width: 94%; max-height: 92%;
  transition: transform 0.15s; will-change: transform;
  user-select: none; -webkit-user-drag: none;
}
.lb-nav {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 6;
  width: 44px; height: 44px; border: none; border-radius: 50%;
  background: rgba(255, 255, 255, 0.12); color: #fff;
  display: flex; align-items: center; justify-content: center;
}
.lb-nav:hover { background: rgba(255, 255, 255, 0.25); }
.lb-prev { left: 14px; }
.lb-next { right: 14px; }

/* ---------- 播放器 ---------- */
.player-overlay { background: #000; }
.pl-stage { position: absolute; inset: 0; display: flex; flex-direction: column; }
.pl-head {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; color: #dfe6f1;
}
.pl-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pl-head .icon-btn { color: #aeb9cb; }
.pl-head .icon-btn:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }
.pl-box { position: relative; flex: 1; display: flex; align-items: center; }
.pl-mount { width: 100%; }
.pl-mount .xgplayer { width: 100% !important; }
.pl-prev, .pl-next {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 6;
  width: 40px; height: 40px; border: none; border-radius: 50%;
  background: rgba(255, 255, 255, 0.14); color: #fff;
}
.pl-prev { left: 12px; }
.pl-next { right: 12px; }
.pl-speed-badge {
  position: absolute; top: 14px; left: 50%; transform: translateX(-50%) scale(0.9);
  z-index: 30; pointer-events: none;
  background: rgba(0, 0, 0, 0.62); color: #fff;
  font-size: 15px; font-weight: 600; letter-spacing: 1px;
  padding: 7px 16px; border-radius: 999px;
  opacity: 0; transition: opacity 0.15s, transform 0.15s;
}
.pl-speed-badge.show { opacity: 1; transform: translateX(-50%) scale(1); }
.pl-error { color: #dfe6f1; text-align: center; padding: 60px 20px; }

/* ---------- 管理面板 ---------- */
.admin-panel { width: 460px; }
.admin-add { margin-bottom: 12px; }
.admin-list { max-height: 320px; overflow-y: auto; }
.admin-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 4px; border-bottom: 1px solid var(--line);
}
.au-name { flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; }
.au-name .icon { width: 16px; height: 16px; color: var(--dim); }
.au-role, .au-me {
  font-style: normal; font-size: 11px; padding: 2px 8px; border-radius: 999px;
}
.au-role { background: var(--accent-soft); color: var(--accent); }
.au-me { background: var(--panel-2); color: var(--dim); }
.au-actions { display: flex; gap: 8px; }
.au-actions .danger { color: var(--danger); }

/* ---------- 个人设置面板 ---------- */
.settings-panel { width: 460px; }
.settings-section { padding: 4px 0 14px; border-bottom: 1px solid var(--line); margin-bottom: 14px; }
.settings-section:last-of-type { border-bottom: none; margin-bottom: 0; }
.settings-label {
  display: flex; align-items: center; gap: 7px;
  font-weight: 600; margin-bottom: 10px;
}
.settings-label .icon { width: 16px; height: 16px; color: var(--accent); }
.settings-hint { color: var(--dim); font-size: 12px; margin: 10px 0 0; line-height: 1.6; }
.rate-control { display: flex; align-items: center; gap: 14px; }
.rate-control input[type='range'] { flex: 1; accent-color: var(--accent); }
.rate-value {
  min-width: 48px; text-align: right;
  font-weight: 700; font-size: 18px; color: var(--accent);
}
.rate-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.rate-chip {
  border: 1px solid var(--line); background: var(--panel-2);
  border-radius: 999px; padding: 5px 12px; font-size: 13px;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.rate-chip:hover { border-color: var(--accent); }
.rate-chip.active { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
.settings-workdir {
  padding: 9px 12px; border: 1px solid var(--line); border-radius: 9px;
  background: var(--panel-2); color: var(--dim);
  font-size: 12px; word-break: break-all; user-select: text;
}

/* ---------- 音频播放器 ---------- */
.audio-overlay { display: flex; align-items: center; justify-content: center; padding: 24px; }
.audio-card {
  position: relative; width: 420px; max-width: 100%;
  background: var(--panel); border-radius: 16px; padding: 18px;
  box-shadow: var(--shadow-lg);
  opacity: 0; transform: translateY(12px) scale(0.97);
  transition: opacity 0.18s, transform 0.18s;
}
.overlay.show .audio-card { opacity: 1; transform: none; }
.audio-head { display: flex; align-items: center; gap: 8px; }
.audio-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.audio-art {
  display: flex; align-items: center; justify-content: center;
  margin: 18px auto 10px; color: var(--accent);
}
.audio-art .icon { width: 88px; height: 88px; stroke-width: 1; }
.audio-name {
  font-weight: 700; text-align: center;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.audio-meta { text-align: center; color: var(--dim); font-size: 12px; margin: 2px 0 12px; }
.audio-mount { margin: 4px 0 6px; }
.audio-nav { display: flex; justify-content: space-between; gap: 10px; margin-top: 12px; }
.audio-nav .btn { flex: 1; }

/* ---------- 文档预览 ---------- */
.doc-overlay { display: flex; align-items: center; justify-content: center; padding: 24px; }
.doc-panel {
  position: relative; width: min(960px, 100%); height: min(88vh, 900px);
  display: flex; flex-direction: column;
  background: var(--panel); border-radius: 14px;
  box-shadow: var(--shadow-lg); overflow: hidden;
  opacity: 0; transform: translateY(12px) scale(0.98);
  transition: opacity 0.18s, transform 0.18s;
}
.overlay.show .doc-panel { opacity: 1; transform: none; }
.doc-head {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; border-bottom: 1px solid var(--line);
}
.doc-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.doc-body { flex: 1; overflow: auto; background: var(--panel-2); }
.doc-mount { min-height: 100%; }
.doc-iframe { display: block; width: 100%; height: 100%; min-height: 70vh; border: 0; background: #fff; }
.doc-fallback { color: var(--dim); font-size: 12px; margin: 10px 14px; }
.doc-pre {
  margin: 0; padding: 20px 24px;
  white-space: pre-wrap; word-break: break-word;
  font: 13px/1.7 ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
}
.doc-md, .doc-epub-wrap { max-width: 780px; margin: 0 auto; padding: 28px 32px 64px; }
.doc-md h1, .doc-md h2, .doc-md h3 { line-height: 1.35; margin: 1.2em 0 0.5em; }
.doc-md h1 { font-size: 24px; border-bottom: 1px solid var(--line); padding-bottom: 8px; }
.doc-md h2 { font-size: 20px; }
.doc-md h3 { font-size: 16px; }
.doc-md p { margin: 0.6em 0; }
.doc-md pre {
  background: var(--panel); border: 1px solid var(--line); border-radius: 8px;
  padding: 12px 14px; overflow-x: auto;
}
.doc-md code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.92em; }
.doc-md blockquote {
  margin: 0.8em 0; padding: 4px 14px;
  border-left: 3px solid var(--accent); color: var(--dim);
}
.doc-md img { max-width: 100%; border-radius: 8px; }
.doc-epub-title { font-size: 26px; margin: 0 0 18px; line-height: 1.3; }
.epub-chapter { margin-bottom: 28px; }
.epub-chapter-title {
  font-size: 18px; margin: 0 0 10px;
  border-bottom: 1px solid var(--line); padding-bottom: 8px;
}
.doc-error {
  display: flex; align-items: center; gap: 10px;
  color: var(--danger); padding: 40px 24px;
}
.doc-error .icon { width: 20px; height: 20px; }

/* ---------- toast ---------- */
#toasts {
  position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
  z-index: 200; display: flex; flex-direction: column; gap: 8px; align-items: center;
  pointer-events: none;
}
.toast {
  display: flex; align-items: center; gap: 8px;
  background: var(--panel); border: 1px solid var(--line);
  box-shadow: var(--shadow); border-radius: 999px;
  padding: 9px 18px; font-size: 14px;
  opacity: 0; transform: translateY(-8px); transition: all 0.25s;
  max-width: calc(100vw - 40px);
}
.toast.show { opacity: 1; transform: translateY(0); }
.toast .icon { width: 16px; height: 16px; }
.t-ok .icon { color: var(--ok); }
.t-error .icon { color: var(--danger); }
.t-info .icon { color: var(--accent); }

/* ---------- 响应式：窄屏（手机） ---------- */
@media (max-width: 640px) {
  .app-header { gap: 8px; padding: 0 10px; }
  .brand b { display: none; }
  .header-actions { gap: 2px; }
  #btnUpload { display: none; }         /* 由 FAB 承担 */
  #btnAdmin { display: none; }          /* 收进用户菜单 */
  .search-box { max-width: none; }
  .search-box input { font-size: 16px; } /* 防 iOS 聚焦缩放 */
  .crumb-bar { padding: 6px 10px; }
  .file-area { padding: 10px 10px 110px; }
  .ftile { padding: 10px 8px 8px; }
  .tname { font-size: 12px; }
  .frow { grid-template-columns: 32px minmax(0, 1fr) 34px; padding: 10px 6px; }
  .frow .fsize, .frow .fdate { display: none; }
  .dir-stats { display: none; }
  .user-chip span { display: none; }
  .audio-overlay, .doc-overlay { padding: 0; }
  .audio-card { width: 100%; border-radius: 16px 16px 0 0; align-self: flex-end; }
  .doc-panel { width: 100%; height: 100%; max-height: none; border-radius: 0; }
}

/* 桌面宽度较小时隐藏日期列 */
@media (max-width: 1000px) {
  .frow { grid-template-columns: 36px minmax(0, 1fr) 90px 34px; }
  .fdate { display: none; }
}

`;

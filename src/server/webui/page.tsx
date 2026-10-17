import type { FC } from 'hono/jsx';
import { raw } from 'hono/html';

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%233b82f6'/%3E%3Cpath d='M8 11a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V21a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z' fill='white'/%3E%3C/svg%3E";

export interface PageAssets {
  css: string;
  vendorCss: string;
  vendorJs: string;
  clientJs: string;
}

/** 单文档页面：样式与脚本全部内联，无独立 html/js/css 文件 */
export const Page: FC<PageAssets & { children?: unknown }> = ({ css, vendorCss, vendorJs, clientJs, children }) => (
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      <meta name="theme-color" content="#3b82f6" />
      <title>FileHub</title>
      <link rel="icon" href={FAVICON} />
      <style>{raw(vendorCss + '\n' + css)}</style>
    </head>
    <body>
      <div id="app" aria-live="polite"></div>
      <div id="toasts"></div>
      <div id="layers"></div>
      <script>{raw(vendorJs)}</script>
      <script type="module">{raw(clientJs)}</script>
    </body>
  </html>
);

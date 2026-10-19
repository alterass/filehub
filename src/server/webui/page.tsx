import type { FC } from 'hono/jsx';
import { raw } from 'hono/html';
import { FAVICON } from './favicon.js';

export interface PageAssets {
  css: string;
  fontCss: string;
  vendorCss: string;
  vendorJs: string;
  clientJs: string;
}

/** 单文档页面：样式与脚本全部内联，无独立 html/js/css 文件 */
export const Page: FC<PageAssets & { children?: unknown }> = ({ css, fontCss, vendorCss, vendorJs, clientJs, children }) => (
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      <meta name="theme-color" content="#f3f1ee" media="(prefers-color-scheme: light)" />
      <meta name="theme-color" content="#0d0d0d" media="(prefers-color-scheme: dark)" />
      <title>FileHub</title>
      <link rel="icon" href={FAVICON} />
      <style>{raw(fontCss + '\n' + vendorCss + '\n' + css)}</style>
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

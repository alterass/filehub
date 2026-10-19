// WebUI 模块：hono JSX renderer 渲染单文档页面，样式与脚本全部内联（无静态 html/js 文件）
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { jsxRenderer } from 'hono/jsx-renderer';
import { Page } from './page.js';
import { APP_CSS } from './styles.js';
import { FONT_CSS } from './fonts.js';
import { CLIENT_BUNDLE } from './client-bundle.gen.js';
import type { CoreContext, FileHubModule } from '../core/registry.js';

/**
 * xgplayer 浏览器端产物：读取并内联进页面。
 * 用模块解析（createRequire）而不是拼 `projectRoot()/node_modules` 路径 —— 这样在
 * 全局安装、依赖被提升（hoist）到上层 node_modules 时依然能定位到（xgplayer 无 exports
 * 限制，可直接解析 dist 子路径）。缺包时返回空串，页面只是没有播放器脚本，不影响启动。
 */
function readVendor(): { css: string; js: string } {
  const req = createRequire(import.meta.url);
  const read = (id: string): string => {
    try {
      return readFileSync(req.resolve(id), 'utf8');
    } catch {
      return '';
    }
  };
  return {
    js: read('xgplayer/dist/index.min.js'),
    css: read('xgplayer/dist/index.min.css'),
  };
}

export const webUiModule: FileHubModule = {
  name: 'webui',
  register(ctx: CoreContext) {
    const vendor = readVendor();
    // 页面资源在启动时读取一次（LAN 场景改动后重启即可）

    ctx.app.use(
      jsxRenderer(({ children }) => (
        <Page css={APP_CSS} fontCss={FONT_CSS} vendorCss={vendor.css} vendorJs={vendor.js} clientJs={CLIENT_BUNDLE}>
          {children}
        </Page>
      )),
    );
    ctx.app.get('/', (c) => c.render(<span id="boot" hidden />));
  },
};

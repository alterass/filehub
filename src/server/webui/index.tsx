// WebUI 模块：hono JSX renderer 渲染单文档页面，样式与脚本全部内联（无静态 html/js 文件）
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { jsxRenderer } from 'hono/jsx-renderer';
import { Page } from './page.js';
import { APP_CSS } from './styles.js';
import { CLIENT_BUNDLE } from './client-bundle.gen.js';
import { projectRoot } from '../core/paths.js';
import type { CoreContext, FileHubModule } from '../core/registry.js';

function readIfExists(...paths: string[]): string {
  for (const p of paths) {
    try {
      if (existsSync(p)) return readFileSync(p, 'utf8');
    } catch {
      // 尝试下一个候选路径
    }
  }
  return '';
}

/** xgplayer 浏览器端产物：直接从 node_modules 读取并内联 */
function readVendor(): { css: string; js: string } {
  const xgDist = join(projectRoot(), 'node_modules', 'xgplayer', 'dist');
  return {
    js: readIfExists(join(xgDist, 'index.min.js')),
    css: readIfExists(join(xgDist, 'index.min.css')),
  };
}

export const webUiModule: FileHubModule = {
  name: 'webui',
  register(ctx: CoreContext) {
    const vendor = readVendor();
    // 页面资源在启动时读取一次（LAN 场景改动后重启即可）

    ctx.app.use(
      jsxRenderer(({ children }) => (
        <Page css={APP_CSS} vendorCss={vendor.css} vendorJs={vendor.js} clientJs={CLIENT_BUNDLE}>
          {children}
        </Page>
      )),
    );
    ctx.app.get('/', (c) => c.render(<span id="boot" hidden />));
  },
};

import { healthModule } from './health.js';
import { authModule } from './auth.js';
import { filesModule } from './files/routes.js';
import { adminModule } from './admin.js';
import { webUiModule } from '../webui/index.js';
import { registerModule } from '../core/registry.js';

/** 内置功能模块清单：新增功能 = 在此追加一行（或直接向 ~/.filehub/modules 放置 *.js） */
export function registerBuiltinModules(): void {
  registerModule(healthModule);
  registerModule(authModule);
  registerModule(filesModule);
  registerModule(adminModule);
  registerModule(webUiModule);
}

export { initModules, loadExternalModules, listModules, registerModule } from '../core/registry.js';
export type { FileHubModule, CoreContext } from '../core/registry.js';

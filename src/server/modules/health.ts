import { dirname } from 'node:path';
import { type, arch } from 'node:os';
import type { FileHubModule } from '../core/registry.js';

export const healthModule: FileHubModule = {
  name: 'health',
  register(ctx) {
    ctx.app.get('/api/health', (c) =>
      c.json({ ok: true, name: 'FileHub', version: '0.1.0', time: new Date().toISOString() }),
    );

    // 服务信息（需登录）：工作目录等
    ctx.app.get('/api/server/info', (c) =>
      c.json({
        name: 'FileHub',
        version: '0.1.0',
        workDir: ctx.paths.workDir,
        platform: `${type()} ${arch()}`,
        time: new Date().toISOString(),
      }),
    );
  },
};

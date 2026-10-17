// 编译 WebUI 前端脚本：src/server/webui/client/main.ts → 单文件 IIFE，
// 由服务端 JSX 页面内联（<script type="module">），不产出独立静态 js 文件。
// 输出：dist/server/webui/client.js（生产）与 src/server/webui/client-bundle.gen.ts（内联字符串模块）。
import esbuild from 'esbuild';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function buildWebUI(root = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
  const outfile = join(root, 'dist', 'server', 'webui', 'client.js');
  mkdirSync(dirname(outfile), { recursive: true });
  await esbuild.build({
    entryPoints: [join(root, 'src', 'server', 'webui', 'client', 'main.ts')],
    bundle: true,
    format: 'iife',
    target: ['es2022'],
    minify: true,
    outfile,
    logLevel: 'warning',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  // 生成可被服务端直接 import 的字符串模块（JSON.stringify 保证转义安全），
  // 这样发行版单文件里也无需携带额外资源
  const js = readFileSync(outfile, 'utf8');
  const genFile = join(root, 'src', 'server', 'webui', 'client-bundle.gen.ts');
  writeFileSync(
    genFile,
    '// 该文件由 scripts/build-webui.mjs 自动生成，请勿手改\nexport const CLIENT_BUNDLE = ' + JSON.stringify(js) + ';\n',
  );
  const kb = Math.round(statSync(outfile).size / 1024);
  console.log(`[build:webui] client.js (${kb} KB) -> dist + client-bundle.gen.ts`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await buildWebUI();
}

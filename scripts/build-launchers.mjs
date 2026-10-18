// 生成分发目录 dist/ 里的跨平台启动脚本：
//   dist/filehub.bat（Windows）与 dist/filehub.sh（Linux/macOS）
// 两者都定位到自身所在目录并调用编译后的 CLI（server/cli.js），因此：
//   - 不依赖当前工作目录，从任意目录执行都正确；
//   - 把 dist/ 加入 PATH 后，可直接用 `filehub` / `filehub.sh` 启动；
//   - 参数原样转发（%* / "$@"），支持 --dir/--host/--port 等全部参数。
// 由 package.json 的 build 脚本在 tsc 编译之后调用。
import { chmodSync, cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
mkdirSync(dist, { recursive: true });

// Windows：%~dp0 是脚本所在目录（含尾部反斜杠），%* 原样转发所有参数。
// 注意：.bat 必须保持纯 ASCII——cmd 在 chcp 65001 之后若文件中含 UTF-8 多字节注释会
// 出现字节偏移错乱导致脚本卡死（已在中文 Windows 上复现），因此注释只用英文。
const BAT = [
  '@echo off',
  'rem FileHub launcher (auto-generated, do not edit)',
  'rem Usage: filehub.bat [options], e.g. filehub.bat --port 9000 --host 0.0.0.0',
  'chcp 65001 >nul',
  'node "%~dp0server\\cli.js" %*',
  'exit /b %errorlevel%',
  '',
].join('\r\n');

// POSIX：定位脚本真实目录，保证在任意当前目录下都能找到 server/cli.js。
// "$@" 按原样转发所有参数（含带空格/引号的参数）。
const SH = [
  '#!/usr/bin/env sh',
  '# FileHub 启动脚本（自动生成，请勿手改）',
  '# 用法: ./filehub.sh [选项]，例如 ./filehub.sh --port 9000 --host 0.0.0.0',
  'set -e',
  '',
  'SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)',
  '',
  'exec node "$SCRIPT_DIR/server/cli.js" "$@"',
  '',
].join('\n');

// 让 dist/ 在没有上层 package.json 时也能被识别为 ESM 项目（cli.js 使用 import）
const PKG = {
  name: 'filehub',
  version: '0.1.0',
  type: 'module',
  private: true,
};

writeFileSync(join(dist, 'filehub.bat'), BAT);
writeFileSync(join(dist, 'filehub.sh'), SH);
try {
  chmodSync(join(dist, 'filehub.sh'), 0o755);
} catch {}
writeFileSync(join(dist, 'package.json'), JSON.stringify(PKG, null, 2) + '\n');

// 随产物分发迁移 SQL：运行时的 bundledSqlDir 优先读 dist/sql，
// 这样分发/镜像只需 dist/ + node_modules/，不再依赖仓库根的 sql/。
cpSync(join(root, 'sql'), join(dist, 'sql'), { recursive: true });

console.log('[build:launchers] 已生成 dist/filehub.bat + dist/filehub.sh');
console.log('[build:launchers] 已同步 sql/ -> dist/sql');

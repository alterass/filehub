// FileHub 命令行入口（编译为 dist/server/cli.js）。
// 参数解析的唯一事实来源：npm 脚本（npm run serve / npm start）与分发目录里的
// filehub.bat / filehub.sh 都委托到这里，避免同一套参数在多处维护。
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer } from './index.js';

const USAGE = `
FileHub 局域网网盘

用法: filehub [选项]

选项:
  --workdir, --dir <path>   工作目录（网盘根目录，默认当前目录）
  -H, --host <host>         监听地址（默认 0.0.0.0，局域网可访问）
  -p, --port <port>         监听端口（默认 3880）
  -h, --help                显示本帮助
`;

export interface CliOptions {
  home?: string;
  host?: string;
  port?: number;
}

interface ParseResult {
  opts: CliOptions;
  help: boolean;
  error?: string;
}

// Windows 下路径可能残留成对引号（例如 cmd 转发参数时），这里剥掉
function stripQuotes(s: string): string {
  return s.length > 1 && s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
}

export function parseArgs(args: string[]): ParseResult {
  const opts: CliOptions = {};
  const unknown: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const eq = arg.indexOf('=');
    const key = eq >= 0 ? arg.slice(0, eq) : arg;
    const inline = eq >= 0 ? arg.slice(eq + 1) : undefined;

    const readValue = (): string | undefined => {
      if (inline !== undefined) return inline;
      const next = args[i + 1];
      if (next === undefined) return undefined;
      i++; // 消费下一个参数
      return next;
    };

    switch (key) {
      case '-h':
      case '--help':
        return { opts, help: true };
      case '--workdir':
      case '--dir':
      case '-d': {
        const v = readValue();
        if (v === undefined) return { opts, help: false, error: `${key} 需要路径参数` };
        opts.home = stripQuotes(v);
        break;
      }
      case '--host':
      case '-H': {
        const v = readValue();
        if (v === undefined) return { opts, help: false, error: `${key} 需要地址参数` };
        opts.host = v;
        break;
      }
      case '--port':
      case '-p': {
        const v = readValue();
        if (v === undefined) return { opts, help: false, error: `${key} 需要端口参数` };
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > 65535) {
          return { opts, help: false, error: `端口需为 1-65535 的整数，收到: ${v}` };
        }
        opts.port = n;
        break;
      }
      default:
        unknown.push(arg);
    }
  }

  if (unknown.length) return { opts, help: false, error: `未知参数: ${unknown.join(' ')}` };
  return { opts, help: false };
}

export async function runCli(args: string[]): Promise<void> {
  const { opts, help, error } = parseArgs(args);
  if (help) {
    console.log(USAGE);
    return;
  }
  if (error) {
    console.error(`错误: ${error}\n`);
    console.log(USAGE);
    process.exitCode = 1;
    return;
  }

  // 未指定工作目录时默认用当前目录
  const handle = await startServer({
    home: opts.home ?? process.cwd(),
    ...(opts.host != null ? { host: opts.host } : {}),
    ...(opts.port != null ? { port: opts.port } : {}),
  });

  const shutdown = () => {
    console.log('\n[server] 正在关闭…');
    handle.close().finally(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  await runCli(process.argv.slice(2));
}

import { startServer } from './index.js';

const handle = await startServer();

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
function shutdown() {
  console.log('\n[server] 正在关闭…');
  handle.close().finally(() => process.exit(0));
}

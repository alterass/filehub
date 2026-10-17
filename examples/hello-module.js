// FileHub 外部模块示例：把本文件复制到工作目录的 .filehub/modules/（默认 ~/.filehub/modules/），
// 重启服务后即可访问 http://localhost:3880/api/hello，并在文件上传时打印事件日志。
export default {
  name: 'hello',
  register(ctx) {
    ctx.app.get('/api/hello', (c) => c.json({ hello: 'world' }));      // 新路由
    const files = ctx.service('files');                                // 复用内置服务
    ctx.bus.on('files:uploaded', ({ node }) => { /* 事件挂钩 */ });      // 订阅事件
  },
};

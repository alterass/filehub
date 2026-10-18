import type { Context } from 'hono';
import type { FileHubModule } from '../../core/registry.js';
import { badRequest, forbidden, notFound } from '../../core/errors.js';
import { isImageName, isVideoName, unsafeToInline } from '../../core/mime.js';
import { FilesService, type NodeInfo } from './service.js';
import { DEFAULT_THUMB_SIZE, sniffThumbMime, thumbCacheId, THUMB_SIZES } from './thumb.js';
import {
  cancelThumbTask,
  cleanStaleThumbs,
  enqueueUploaded,
  getThumbJob,
  isThumbTaskRunning,
  startThumbTask,
  thumbCacheStats,
} from './thumb-cache.js';

function parseRangeHeader(range: string | undefined, size: number): { start: number; end: number } | 'invalid' | null {
  if (!range) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!m || (m[1] === '' && m[2] === '')) return 'invalid';
  let start: number;
  let end: number;
  if (m[1] === '') {
    const suffix = Number(m[2]);
    if (suffix === 0) return 'invalid';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Number(m[2]);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return 'invalid';
  if (start >= size) return 'invalid';
  return { start, end: Math.min(end, size - 1) };
}

function contentDisposition(name: string, mode: 'inline' | 'attachment'): string {
  const encoded = encodeURIComponent(name);
  return `${mode}; filename="${name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'")}"; filename*=UTF-8''${encoded}`;
}

export const filesModule: FileHubModule = {
  name: 'files',
  register(ctx) {
    const svc = new FilesService(ctx.db, ctx.storage, ctx.bus);
    ctx.provide('files', svc);
    const app = ctx.app;

    // 相对路径 → 节点 id（与 FilesService 一致）
    const svcIdOf = (rel: string) => Buffer.from(rel, 'utf8').toString('base64url');

    /** 缩略图维护仅管理员可用（会影响全库、且重建很吃 CPU/磁盘） */
    const requireAdmin = (c: Context) => {
      if (c.get('user')?.role !== 'admin') throw forbidden('仅管理员可执行缩略图维护操作');
    };

    // 启动补齐：交给统一的后台任务（missing = 只生成还没有的，不覆盖已有缓存）。
    // 覆盖图片与视频；视频封面走全黑判断，历史遗留的纯黑封面会被顺手重生成。
    // 不阻塞启动，进度在「个人设置 → 缩略图维护」可见。
    try {
      startThumbTask(ctx.storage, 'missing', 'startup');
      console.log(`[thumbs] 启动补齐任务已排队 → ${ctx.config.thumbDir}`);
    } catch (err) {
      console.error('[thumbs] 启动补齐任务启动失败', err);
    }

    // 新文件落地后排队生成缩略图（走统一串行任务链，不在请求里生成）
    ctx.bus.on('files:uploaded', ({ row }) => {
      const node = row as NodeInfo | undefined;
      if (!node?.name || node.type !== 'file') return;
      if (!isImageName(node.name) && !isVideoName(node.name)) return;
      enqueueUploaded(ctx.storage, node);
    });

    // ---- 缩略图维护（仅管理员）：统计 / 补齐·重建（后台任务）/ 停止 / 清理过时缓存 ----
    // 静态路径必须注册在 /:id 之前，避免被参数路由抢匹配
    app.get('/api/files/thumbs/status', async (c) => {
      requireAdmin(c);
      const stats = await thumbCacheStats(ctx.storage);
      return c.json({ ...stats, dir: ctx.storage.thumbDirPath(), job: getThumbJob() });
    });

    app.post('/api/files/thumbs/rebuild', async (c) => {
      requireAdmin(c);
      const body = await c.req.json().catch(() => null);
      const mode = body?.mode === 'force' ? 'force' : 'missing';
      return c.json(startThumbTask(ctx.storage, mode, 'manual'), 202);
    });

    app.post('/api/files/thumbs/rebuild/cancel', (c) => {
      requireAdmin(c);
      return c.json({ job: cancelThumbTask() });
    });

    app.post('/api/files/thumbs/clean', async (c) => {
      requireAdmin(c);
      return c.json(await cleanStaleThumbs(ctx.storage));
    });

    // ---- 目录浏览 ----
    app.get('/api/files/list', async (c) => {
      const parentId = c.req.query('parentId') || null;
      const result = await svc.list(parentId);
      return c.json({
        parentId,
        path: result.path,
        stats: result.stats,
        items: result.items,
        // 后台正在生成缩略图：前端据此在任务期间自动重载列表，让缩略图逐步出现
        thumbsRunning: isThumbTaskRunning(),
      });
    });

    app.get('/api/files/search', async (c) => {
      const q = (c.req.query('q') ?? '').trim();
      if (!q) throw badRequest('搜索词不能为空');
      const results = await svc.search(q);
      return c.json({ query: q, items: results });
    });

    app.get('/api/files/folders', async (c) => {
      const rows = await svc.folders();
      return c.json({ items: rows });
    });

    app.post('/api/files/folder', async (c) => {
      const body = await c.req.json().catch(() => null);
      if (!body) throw badRequest('请求体不是合法 JSON');
      const node = await svc.createFolder(body.parentId ?? null, body.name);
      return c.json(node, 201);
    });

    // ---- 上传：原始字节流，先落 <meta>/uploads/tmp 再 rename 到真实目标路径 ----
    app.post('/api/files/upload', async (c) => {
      const name = c.req.query('name') ?? '';
      const parentId = c.req.query('parentId') || null;
      const parentRel = parentId ? svcNodeIdToRel(parentId) : '';
      const fileName = (name || 'unnamed').split('/').pop()!.split('\\').pop()!;
      if (!c.req.raw.body) throw badRequest('请求体为空');
      const { tmpAbs } = await ctx.storage.putStream(c.req.raw.body, fileName);
      const targetRel = parentRel ? `${parentRel}/${fileName}` : fileName;
      try {
        const { mkdir: mk, rename: rn } = await import('node:fs/promises');
        const targetAbs = ctx.storage.absPath(targetRel);
        await mk(ctx.storage.absPath(parentRel), { recursive: true });
        await rn(tmpAbs, targetAbs);
      } catch (err) {
        await import('node:fs/promises').then((m) => m.rm(tmpAbs, { force: true })).catch(() => {});
        throw err;
      }
      svc.registerUpload(targetRel);
      return c.json(await svc.getNode(svcIdOf(targetRel)), 201);
    });

    function svcNodeIdToRel(id: string): string {
      try {
        return Buffer.from(id, 'base64url').toString('utf8');
      } catch {
        return '';
      }
    }

    // ---- 单文件元信息 ----
    app.get('/api/files/:id', async (c) => {
      const node = await svc.getNode(c.req.param('id'));
      return c.json(node);
    });

    // ---- 下载 ----
    app.get('/api/files/:id/download', async (c) => {
      const node = await svc.getNode(c.req.param('id'));
      if (node.type !== 'file') throw notFound('文件夹不支持下载');
      const { stream, size } = ctx.storage.openRange(node.key);
      return new Response(stream, {
        status: 200,
        headers: {
          'content-type': 'application/octet-stream',
          'content-length': String(size),
          'content-disposition': contentDisposition(node.name, 'attachment'),
          'cache-control': 'private, no-cache',
        },
      });
    });

    // ---- 原始内容（图片预览 / 视频播放，支持 HTTP Range）----
    app.get('/api/files/:id/raw', async (c) => {
      const node = await svc.getNode(c.req.param('id'));
      if (node.type !== 'file') throw notFound('文件夹没有原始内容');
      const size = await ctx.storage.sizeOf(node.key);
      const base: Record<string, string> = {
        'content-type': node.mime ?? 'application/octet-stream',
        'accept-ranges': 'bytes',
        'cache-control': 'private, max-age=3600',
      };
      if (unsafeToInline(node.name)) {
        base['content-disposition'] = contentDisposition(node.name, 'attachment');
      }

      const range = parseRangeHeader(c.req.header('range'), size);
      if (range === 'invalid') {
        return new Response(null, {
          status: 416,
          headers: { 'content-range': `bytes */${size}` },
        });
      }
      if (range) {
        const { stream } = ctx.storage.openRange(node.key, range.start, range.end);
        return new Response(stream, {
          status: 206,
          headers: {
            ...base,
            'content-range': `bytes ${range.start}-${range.end}/${size}`,
            'content-length': String(range.end - range.start + 1),
          },
        });
      }
      const { stream } = ctx.storage.openRange(node.key);
      return new Response(stream, {
        status: 200,
        headers: { ...base, 'content-length': String(size) },
      });
    });

    // ---- 缩略图（只读缓存 + ETag 复验；生成一律由后台任务负责，不在请求里跑）----
    app.get('/api/files/:id/thumb', async (c) => {
      const node = await svc.getNode(c.req.param('id'));
      if (node.type !== 'file') throw notFound('文件夹没有缩略图');
      const requested = Number(c.req.query('s'));
      const size = THUMB_SIZES.includes(requested) ? requested : DEFAULT_THUMB_SIZE;

      const cacheId = thumbCacheId(node);
      const meta = await ctx.storage.thumbMeta(cacheId, size);
      // 还没生成：直接 404，前端回落图标（后台任务跑完后由列表自动刷新接管）
      if (!meta) return new Response(null, { status: 404 });

      // ETag 取缓存文件的大小+mtime：缓存被重建/清理后 ETag 变化，浏览器立刻换图。
      // 配合 no-cache（每次带 ETag 复验而不是直接用本地副本），
      // 避免「重建过封面后重启，浏览器仍吐一周前缓存的旧黑图」。
      const etag = `"${meta.size.toString(16)}-${Math.round(meta.mtimeMs).toString(16)}"`;
      if (c.req.header('if-none-match') === etag) return new Response(null, { status: 304 });

      const buffer = await ctx.storage.readThumb(cacheId, size);
      if (!buffer) return new Response(null, { status: 404 });
      return new Response(buffer, {
        status: 200,
        headers: {
          'content-type': sniffThumbMime(buffer, node.name),
          'cache-control': 'private, no-cache',
          etag,
        },
      });
    });

    // ---- 重命名 / 移动 ----
    app.patch('/api/files/:id', async (c) => {
      const id = c.req.param('id');
      const body = await c.req.json().catch(() => null);
      if (!body || (body.name === undefined && body.parentId === undefined)) {
        throw badRequest('需要提供 name 或 parentId');
      }
      if (body.name !== undefined) {
        const node = await svc.rename(id, body.name);
        return c.json(node);
      }
      const targetParent = typeof body.parentId === 'string' && body.parentId !== '' ? body.parentId : null;
      const node = await svc.move(id, targetParent);
      return c.json(node);
    });

    // ---- 删除（递归）----
    app.delete('/api/files/:id', async (c) => {
      const result = await svc.remove(c.req.param('id'));
      return c.json({ ok: true, ...result });
    });
  },
};

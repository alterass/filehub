import type { Context } from 'hono';
import type { FileHubModule } from '../../core/registry.js';
import { badRequest, notFound } from '../../core/errors.js';
import { isImageName, unsafeToInline } from '../../core/mime.js';
import { FilesService } from './service.js';
import {
  DEFAULT_THUMB_SIZE,
  getThumb,
  isVideoPosterSource,
  readVideoPoster,
  saveVideoPoster,
  THUMB_SIZES,
} from './thumb.js';

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

    // 启动预扫：为已有图片补齐默认尺寸缩略图（异步执行，不阻塞启动）
    void (async () => {
      try {
        const images = await scanImages();
        let made = 0;
        for (const rel of images) {
          const node = await svc.getNode(svcIdOf(rel));
          const cached = await ctx.storage.readThumb(node.id, DEFAULT_THUMB_SIZE);
          if (!cached) {
            const result = await getThumb(ctx.storage, node, DEFAULT_THUMB_SIZE);
            if (result) made++;
          }
        }
        if (images.length) {
          console.log(`[thumbs] 启动检查：${images.length} 张图片，补齐 ${made} 张缩略图 → ${ctx.config.thumbDir}`);
        }
      } catch (err) {
        console.error('[thumbs] 启动检查失败', err);
      }
    })();

    // 新文件落地后异步补齐缩略图索引（图片即时生成；视频封面由前端抽帧回传）
    ctx.bus.on('files:uploaded', ({ row }) => {
      const node = row as { name: string; id: string } | undefined;
      if (!node?.name || !isImageName(node.name) || unsafeToInline(node.name)) return;
      void getThumb(ctx.storage, node as never, DEFAULT_THUMB_SIZE).catch(() => {});
    });

    async function scanImages(): Promise<string[]> {
      const { readdirSync } = await import('node:fs');
      const out: string[] = [];
      const walk = (rel: string, depth: number): void => {
        if (depth > 6) return;
        const abs = ctx.storage.absPath(rel);
        let entries: import('node:fs').Dirent[];
        try {
          entries = readdirSync(abs, { withFileTypes: true });
        } catch {
          return;
        }
        for (const e of entries) {
          if (e.name.startsWith('.filehub')) continue;
          const childRel = rel ? `${rel}/${e.name}` : e.name;
          if (e.isDirectory()) walk(childRel, depth + 1);
          else if (isImageName(e.name) && !unsafeToInline(e.name)) out.push(childRel);
        }
      };
      walk('', 0);
      return out;
    }

    // ---- 目录浏览 ----
    app.get('/api/files/list', async (c) => {
      const parentId = c.req.query('parentId') || null;
      const result = await svc.list(parentId);
      return c.json({
        parentId,
        path: result.path,
        stats: result.stats,
        items: result.items,
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

    // ---- 视频封面：前端抽帧后回传（POST），或读取已缓存封面（GET 内嵌在 thumb 接口）----
    app.post('/api/files/:id/poster', async (c) => {
      const node = await svc.getNode(c.req.param('id'));
      const body = await c.req.json().catch(() => null);
      const dataUrl = typeof body?.dataUrl === 'string' ? body.dataUrl : '';
      const m = /^data:image\/jpeg;base64,(.+)$/.exec(dataUrl);
      if (!m) throw badRequest('需要 image/jpeg 的 dataUrl');
      const requested = Number(c.req.query('s'));
      const size = THUMB_SIZES.includes(requested) ? requested : DEFAULT_THUMB_SIZE;
      const ok = await saveVideoPoster(ctx.storage, node.id, size, m[1]);
      if (!ok) throw badRequest('封面保存失败');
      return c.json({ ok: true });
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

    // ---- 缩略图（生成 + 缓存；视频优先返回已缓存封面，否则回退原图/原视频）----
    app.get('/api/files/:id/thumb', async (c) => {
      const node = await svc.getNode(c.req.param('id'));
      if (node.type !== 'file') throw notFound('文件夹没有缩略图');
      const requested = Number(c.req.query('s'));
      const size = THUMB_SIZES.includes(requested) ? requested : DEFAULT_THUMB_SIZE;
      if (isVideoPosterSource(node.name)) {
        const poster = await readVideoPoster(ctx.storage, node.id, size);
        if (poster) {
          return new Response(poster, {
            status: 200,
            headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=604800' },
          });
        }
        return c.redirect(`/api/files/${node.id}/raw`, 302);
      }
      const thumb = await getThumb(ctx.storage, node, size);
      if (!thumb) return c.redirect(`/api/files/${node.id}/raw`, 302);
      return new Response(thumb.buffer, {
        status: 200,
        headers: {
          'content-type': thumb.mime,
          'cache-control': 'private, max-age=604800',
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

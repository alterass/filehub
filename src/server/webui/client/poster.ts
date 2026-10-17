// 视频封面（前端抽帧）：服务端无 ffmpeg，用 <video>+canvas 抽第一帧回传缓存。
// 站在浏览器的解码能力上（mp4/webm/mov 基本都支持），失败静默降级为图标。

const extracting = new Set();
const failed = new Set();

/**
 * 尝试为视频生成封面：seek 到 ~1s 处抽帧 → canvas → JPEG dataURL → POST /poster。
 * 成功后刷新列表中该项的缩略图（通过追加查询参数强制 img 重新加载）。
 */
export async function ensureVideoPoster(item, size = 384) {
  if (extracting.has(item.id) || failed.has(item.id)) return;
  extracting.add(item.id);
  try {
    const dataUrl = await extractFrame(item.id);
    if (!dataUrl) {
      failed.add(item.id);
      return;
    }
    const res = await fetch(`/api/files/${item.id}/poster?s=${size}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl }),
    });
    if (!res.ok) {
      failed.add(item.id);
      return;
    }
    // 让当前 DOM 里的缩略图立即显示封面
    const img = document.querySelector(`[data-id="${item.id}"] .thumb-img`);
    if (img) {
      img.src = `/api/files/${item.id}/thumb?s=${size}&t=${Date.now()}`;
    }
  } catch {
    failed.add(item.id);
  } finally {
    extracting.delete(item.id);
  }
}

/** 抽帧：加载视频元数据 → seek 到 1s（或 10% 处）→ 绘制到 canvas */
function extractFrame(fileId) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.crossOrigin = 'same-origin';
    const url = `/api/files/${fileId}/raw`;
    let settled = false;
    const done = (val) => {
      if (settled) return;
      settled = true;
      video.removeAttribute('src');
      video.load();
      resolve(val);
    };
    // 大文件/不可解码格式超时保护
    const timer = setTimeout(() => done(null), 12000);

    video.addEventListener('loadeddata', () => {
      const t = Math.min(1, (video.duration || 2) * 0.1);
      video.currentTime = Number.isFinite(t) ? t : 0;
    });
    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        const maxSide = 384;
        const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight || 1));
        canvas.width = Math.max(2, Math.round((video.videoWidth || 320) * scale));
        canvas.height = Math.max(2, Math.round((video.videoHeight || 180) * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        clearTimeout(timer);
        done(canvas.toDataURL('image/jpeg', 0.8));
      } catch {
        clearTimeout(timer);
        done(null);
      }
    });
    video.addEventListener('error', () => {
      clearTimeout(timer);
      done(null);
    });
    video.src = url;
  });
}

// 供列表渲染后批量触发
export function ensurePosters(items, size = 384) {
  for (const item of items) {
    if (kindIsVideo(item)) void ensureVideoPoster(item, size);
  }
}

function kindIsVideo(item) {
  return /\.(mp4|m4v|webm|mov|mkv)$/i.test(item.name);
}

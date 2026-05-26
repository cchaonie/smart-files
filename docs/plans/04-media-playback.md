# 视频/音频在线播放 — 实现计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 点击视频/音频文件时直接在线播放，支持拖拽进度条（HTTP Range），无需下载到本地。

**Architecture:** 后端 preview 端点已存在且支持流式返回。需要增加 HTTP 206 Partial Content (Range) 响应以支持视频 seek。前端复用现有 PreviewThumb 按钮 → 改为通用 MediaPreviewModal，按文件类型渲染 `<video>` / `<audio>` / `<img>`。

**Tech Stack:** Node.js fs.createReadStream + Range 解析, React `<video>` / `<audio>`

---

### Task 1: 后端 — Preview 端点增加 Range 支持

**Objective:** 视频播放需要支持 HTTP Range 请求以实现 seek 拖拽

**Files:**
- Modify: `packages/backend/src/files/files.controller.ts` — previewFile 方法

改动: 解析 `Range` 请求头，返回 206 Partial Content

```typescript
@Get(':id/preview')
async previewFile(
  @CurrentUser() user: UserEntity,
  @Param('id') id: string,
  @Req() req: Request,       // 新增
  @Res() res: Response,
) {
  const { stream, mimeType, size } = await this.filesService.previewFile(user.id, id);
  
  const range = req.headers.range;
  if (range && size) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
    
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.setHeader('Content-Length', end - start + 1);
    res.setHeader('Accept-Ranges', 'bytes');
    if (mimeType) res.setHeader('Content-Type', mimeType);
    
    createReadStream(filePath, { start, end }).pipe(res);
  } else {
    if (mimeType) res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    stream.pipe(res);
  }
}
```

**FilesService 同步修改:** `previewFile` 返回时增加 `size` 字段:
```typescript
return { stream: createReadStream(filePath), mimeType: file.mimeType, size: Number(file.size) };
```

---

### Task 2: 共享工具 — 增加媒体类型判断

**Objective:** 前端能识别视频/音频文件，触发对应播放器

**Files:**
- Modify: `packages/shared/src/utils.ts`

新增两个函数:

```typescript
export function isPreviewableVideo(mimeType: string | null, name: string): boolean {
  if (mimeType?.startsWith('video/')) return true;
  const ext = name.split('.').pop()?.toLowerCase();
  return ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext || '');
}

export function isPreviewableAudio(mimeType: string | null, name: string): boolean {
  if (mimeType?.startsWith('audio/')) return true;
  const ext = name.split('.').pop()?.toLowerCase();
  return ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext || '');
}
```

---

### Task 3: 前端 — MediaPreviewModal 组件

**Objective:** 统一的多媒体预览弹窗，按文件类型选渲染器

**Files:**
- Modify: `packages/web/src/pages/FilesPage.tsx`

新增 `MediaPreview` 组件:

```tsx
function MediaPreview({ file, onClose }: { file: FileItem; onClose: () => void }) {
  const url = filesApi.previewUrl(file.id);
  const isVideo = isPreviewableVideo(file.mimeType, file.name);
  const isAudio = isPreviewableAudio(file.mimeType, file.name);
  const isImage = isPreviewableImage(file.mimeType, file.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
         role="dialog" aria-modal="true" onClick={onClose}>
      <button className="absolute right-4 top-4 rounded-full bg-zinc-800/90 px-3 py-1 text-sm text-white"
              onClick={onClose}>Close</button>
      
      <div onClick={e => e.stopPropagation()} className="max-h-[90vh] max-w-[90vw]">
        {isVideo && (
          <video controls className="max-h-[90vh] max-w-[90vw]" autoPlay>
            <source src={url} type={file.mimeType || 'video/mp4'} />
          </video>
        )}
        {isAudio && (
          <audio controls className="w-96" autoPlay>
            <source src={url} type={file.mimeType || 'audio/mpeg'} />
          </audio>
        )}
        {isImage && <img src={url} alt={file.name} className="max-h-[90vh] max-w-full object-contain" />}
      </div>
    </div>
  );
}
```

---

### Task 4: 前端 — 替换现有 PreviewThumb 预览触发逻辑

**Objective:** 将图片/视频/音频文件的预览按钮统一改为触发 MediaPreview

**Files:**
- Modify: `packages/web/src/pages/FilesPage.tsx`

改动:
1. 现有 `previewFile` state → 保持，传给 `MediaPreview`
2. `PreviewThumb` 组件的 `onOpen` → 视频/音频文件也展示缩略按钮
3. 文件列表 Action 列的 Preview 按钮 → 视频/音频也显示
4. 替换现有仅图片的预览弹窗为通用 `MediaPreview`

---

### Task 5: 确认 Vite 代理转发 Range 请求

**Objective:** Vite dev server 需要正确代理 Range 头

**Files:**
- Check: `packages/web/vite.config.ts`

通常 Vite proxy 默认会转发 headers。如果 Range 请求被拦截，需要加配置:
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:4000',
    changeOrigin: true,
    // Vite 默认会转发 headers, 但如果 Range 不正常:
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq, req) => {
        if (req.headers.range) {
          proxyReq.setHeader('range', req.headers.range);
        }
      });
    }
  }
}
```

---

## 总改动量

| 层 | 新增文件 | 修改文件 | 代码量 |
|----|----------|----------|--------|
| 后端 | 0 | 2 (controller + service) | ~30 行 |
| 共享 | 0 | 1 (utils.ts) | ~20 行 |
| 前端 | 0 | 1 (FilesPage.tsx) | ~60 行 |

**总改动量极小，约 110 行代码 + 1 个新组件。**

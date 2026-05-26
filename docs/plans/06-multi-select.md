# 多选功能 — 实现计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 文件列表和上传记录支持多选，提供批量操作（删除、移动、恢复、彻底删除），提升批量管理效率。

**Architecture:** 前端维护选中状态（Set），列表每行加 checkbox，表头加全选。选中项 ≥ 1 时浮动操作栏出现。后端新增 batch 端点。

**⚠️ 前置修复:** 当前 `PATCH /files/:id` move 端点无后端 handler，需一并修复。

**Tech Stack:** NestJS, Prisma, React, TypeScript

---

### Task 1: 后端 — 修复 moveFile 端点

**Objective:** 补上缺失的 `PATCH /api/files/:id` 端点（现前端 API 调用它但无 handler）

**Files:**
- Modify: `packages/backend/src/files/files.service.ts`
- Modify: `packages/backend/src/files/files.controller.ts`

```typescript
// files.service.ts
async moveFile(userId: string, fileId: string, folderId: string | null) {
  const file = await this.prisma.file.findFirst({
    where: { id: fileId, userId, deletedAt: null },
  });
  if (!file) throw new NotFoundException('File not found');

  const updated = await this.prisma.file.update({
    where: { id: fileId },
    data: { folderId },
    select: { id: true, name: true, size: true, mimeType: true, folderId: true, createdAt: true },
  });
  return { ...updated, size: updated.size.toString(), createdAt: updated.createdAt.toISOString() };
}

// files.controller.ts
@Patch(':id')
@ApiOperation({ summary: 'Move/rename file' })
async updateFile(
  @CurrentUser() user: UserEntity,
  @Param('id') id: string,
  @Body() body: { folderId?: string; name?: string },
) {
  if (body.name !== undefined) return this.filesService.renameFile(user.id, id, body.name);
  return this.filesService.moveFile(user.id, id, body.folderId ?? null);
}
```

同时删除 `PATCH /:id/rename` 端点，合并到 `PATCH /:id`。

---

### Task 2: 后端 — 批量操作 Service

**Objective:** FilesService 新增批量操作方法

**Files:**
- Modify: `packages/backend/src/files/files.service.ts`

```typescript
async batchDelete(userId: string, ids: string[]) {
  const count = await this.prisma.file.updateMany({
    where: { id: { in: ids }, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return { deleted: count.count };
}

async batchMove(userId: string, ids: string[], folderId: string | null) {
  const count = await this.prisma.file.updateMany({
    where: { id: { in: ids }, userId, deletedAt: null },
    data: { folderId },
  });
  return { moved: count.count };
}

async batchRestore(userId: string, ids: string[]) {
  const count = await this.prisma.file.updateMany({
    where: { id: { in: ids }, userId, deletedAt: { not: null } },
    data: { deletedAt: null },
  });
  return { restored: count.count };
}

async batchPurge(userId: string, ids: string[]) {
  // Delete physical files first
  const files = await this.prisma.file.findMany({
    where: { id: { in: ids }, userId, deletedAt: { not: null } },
  });
  for (const file of files) {
    const filePath = path.join(this.uploadRoot, 'files', userId, file.storageKey);
    import('fs/promises').then(fs => fs.unlink(filePath).catch(() => {}));
  }

  const count = await this.prisma.file.deleteMany({
    where: { id: { in: ids }, userId, deletedAt: { not: null } },
  });
  return { purged: count.count };
}
```

---

### Task 3: 后端 — 批量操作 Controller

**Objective:** 暴露批量操作 API

**Files:**
- Modify: `packages/backend/src/files/files.controller.ts`

新增路由（放在 `/search` 之后，`:id` 之前）：

```
POST   /api/files/batch/delete    — { ids: string[] }
POST   /api/files/batch/move      — { ids: string[], folderId: string | null }
POST   /api/files/batch/restore   — { ids: string[] }
DELETE /api/files/batch/permanent — { ids: string[] }  ← body 在 DELETE 中用 @Body()
```

```typescript
@Post('batch/delete')
@ApiOperation({ summary: 'Soft-delete multiple files' })
async batchDelete(@CurrentUser() user: UserEntity, @Body() body: { ids: string[] }) {
  return this.filesService.batchDelete(user.id, body.ids);
}

@Post('batch/move')
@ApiOperation({ summary: 'Move multiple files' })
async batchMove(@CurrentUser() user: UserEntity, @Body() body: { ids: string[], folderId?: string | null }) {
  return this.filesService.batchMove(user.id, body.ids, body.folderId ?? null);
}

@Post('batch/restore')
@ApiOperation({ summary: 'Restore multiple files from trash' })
async batchRestore(@CurrentUser() user: UserEntity, @Body() body: { ids: string[] }) {
  return this.filesService.batchRestore(user.id, body.ids);
}

@Delete('batch/permanent')
@ApiOperation({ summary: 'Permanently delete multiple files' })
async batchPurge(@CurrentUser() user: UserEntity, @Body() body: { ids: string[] }) {
  return this.filesService.batchPurge(user.id, body.ids);
}
```

---

### Task 4: 前端 — API 方法

**Objective:** 封装批量操作 API

**Files:**
- Modify: `packages/web/src/api/files.ts`

```typescript
batchDelete: async (ids: string[]) => {
  await apiClient.post('/files/batch/delete', { ids });
},
batchMove: async (ids: string[], folderId: string | null) => {
  await apiClient.post('/files/batch/move', { ids, folderId });
},
batchRestore: async (ids: string[]) => {
  await apiClient.post('/files/batch/restore', { ids });
},
batchPurge: async (ids: string[]) => {
  await apiClient.delete('/files/batch/permanent', { data: { ids } });
},
```

---

### Task 5: 前端 — 文件多选 UI

**Objective:** FilesPage 文件列表支持 checkbox 多选 + 浮动操作栏

**Files:**
- Modify: `packages/web/src/pages/FilesPage.tsx`

状态:
```typescript
const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

function toggleFileSelect(id: string) {
  setSelectedFileIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
}

function toggleSelectAll() {
  if (selectedFileIds.size === files.length) {
    setSelectedFileIds(new Set());
  } else {
    setSelectedFileIds(new Set(files.map(f => f.id)));
  }
}
```

UI 变化:

1. **表头加 checkbox 列** — 第一列从「Preview」改为「Select」+ checkbox
2. **每行加 checkbox** — 文件行的第一列加 checkbox
3. **全选逻辑** — 表头 checkbox: 全选/取消全选
4. **浮动操作栏** — `selectedFileIds.size > 0` 时在表格上方显示:

```
┌──────────────────────────────────────────────────────┐
│ 已选 3 项  [Move]  [Delete]  [Deselect all]         │
└──────────────────────────────────────────────────────┘
```

5. **选中行高亮** — `selectedFileIds.has(f.id)` ? `bg-zinc-100 dark:bg-zinc-800` : 默认
6. **批量 Move** — 复用 MoveFileModal，但不传 file 参数，而是传 ids
7. **批量 Delete** — 确认后调用 batchDelete + 刷新
8. **取消选择** — 点击空白区域或按 Escape

---

### Task 6: 前端 — 上传记录多选 UI

**Objective:** 上传进度列表支持多选，提供批量取消/重试/清除

**Files:**
- Modify: `packages/web/src/pages/FilesPage.tsx`

状态:
```typescript
const [selectedUploadIds, setSelectedUploadIds] = useState<Set<number>>(new Set());
```

UI 变化:

1. **每行加 checkbox** — 上传项左侧加小 checkbox
2. **浮动操作栏** — 选中时显示:

```
┌──────────────────────────────────────────────────────┐
│ 已选 2 项  [Retry]  [Cancel]  [Clear]               │
└──────────────────────────────────────────────────────┘
```

3. **批量 Retry** — 遍历 selected 调用 retryUpload
4. **批量 Cancel** — 从 uploadItems 中移除选中项（中止它们的上传）
5. **批量 Clear** — 仅移除已完成/错误的选中项

注意：Cancel 单个上传需要更细粒度的 abort 控制，当前 `abortRef` 是全局的。需要改为 per-item 或至少支持「标记某些 item 为 cancelled」。

**简化方案:** 上传多选的 Cancel/Clear 仅做前端移除，不影响后台上传（后台会继续但被忽略）。

---

### Task 7: 前端 — 回收站多选适配

**Objective:** 回收站视图也支持多选

**Files:**
- Modify: `packages/web/src/pages/FilesPage.tsx`

回收站视图的 checkbox 选中状态用独立的 `selectedTrashIds`。操作栏提供:
- Restore selected — 批量恢复
- Delete permanently — 批量彻底删除

---

## 总改动量

| 层 | 新增文件 | 修改文件 | 代码量 |
|----|----------|----------|--------|
| 后端 | 0 | 2 (service+controller) | ~100 行 |
| 前端 | 0 | 2 (api+page) | ~180 行 |

**总计约 280 行。**

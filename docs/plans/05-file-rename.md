# 文件重命名 — 实现计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 让文件也能像文件夹一样重命名，功能对称化。

**Architecture:** 后端增加 PATCH /api/files/:id/rename 端点，前端在文件操作列增加「Rename」按钮。

**Tech Stack:** NestJS, Prisma, React

---

### Task 1: 后端 — renameFile 方法

**Objective:** FilesService 新增 renameFile

**Files:**
- Modify: `packages/backend/src/files/files.service.ts`

```typescript
async renameFile(userId: string, fileId: string, name: string) {
  const file = await this.prisma.file.findFirst({
    where: { id: fileId, userId },
  });
  if (!file) throw new NotFoundException('File not found');

  const updated = await this.prisma.file.update({
    where: { id: fileId },
    data: { name },
    select: { id: true, name: true, size: true, mimeType: true, folderId: true, createdAt: true },
  });

  return {
    ...updated,
    size: updated.size.toString(),
    createdAt: updated.createdAt.toISOString(),
  };
}
```

---

### Task 2: 后端 — Controller 端点

**Objective:** 暴露 PATCH /api/files/:id

**Files:**
- Modify: `packages/backend/src/files/files.controller.ts`

```typescript
@Patch(':id')
@ApiOperation({ summary: 'Rename file' })
async renameFile(
  @CurrentUser() user: UserEntity,
  @Param('id') id: string,
  @Body() body: { name: string },
) {
  return this.filesService.renameFile(user.id, id, body.name);
}
```

---

### Task 3: 前端 — API 方法

**Objective:** 封装重命名 API

**Files:**
- Modify: `packages/web/src/api/files.ts`

```typescript
renameFile: async (id: string, name: string) => {
  const r = await apiClient.patch(`/files/${id}`, { name });
  return r.data;
},
```

---

### Task 4: 前端 — Rename 按钮

**Objective:** 文件列表每行增加 Rename 按钮

**Files:**
- Modify: `packages/web/src/pages/FilesPage.tsx`

在文件操作列增加:
```tsx
<button onClick={() => {
  const name = window.prompt('New name', f.name);
  if (name && name.trim()) {
    filesApi.renameFile(f.id, name.trim()).then(loadBrowse);
  }
}}>
  Rename
</button>
```

---

## 总改动量

| 层 | 新增文件 | 修改文件 | 代码量 |
|----|----------|----------|--------|
| 后端 | 0 | 2 (service+controller) | ~30 行 |
| 前端 | 0 | 2 (api+page) | ~15 行 |

**总改动约 45 行。这是最简单的功能。**

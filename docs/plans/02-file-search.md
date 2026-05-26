# 文件搜索 — 实现计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 用户可通过文件名关键词跨所有文件夹搜索文件，支持模糊匹配，结果中显示文件所属文件夹路径。

**Architecture:** 利用 PostgreSQL `ILIKE` 实现模糊搜索，无需引入外部搜索引擎。后端新增 search API 端点，前端在导航栏增加搜索框。结果列表展示文件名、所在文件夹路径、大小、日期。

**Tech Stack:** NestJS, Prisma, PostgreSQL ILIKE, React, TypeScript

---

### Task 1: 后端搜索 Service

**Objective:** 在 FilesService 中新增 searchFiles 方法

**Files:**
- Modify: `packages/backend/src/files/files.service.ts`

```typescript
async searchFiles(userId: string, query: string) {
  const files = await this.prisma.file.findMany({
    where: {
      userId,
      name: { contains: query, mode: 'insensitive' },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      size: true,
      mimeType: true,
      folderId: true,
      createdAt: true,
      folder: {
        select: { id: true, name: true },
      },
    },
    take: 50, // limit results
  });

  return {
    results: files.map((f) => ({
      ...f,
      size: f.size.toString(),
      createdAt: f.createdAt.toISOString(),
      folderName: f.folder?.name || null,
    })),
  };
}
```

---

### Task 2: 后端搜索 Controller 端点

**Objective:** 暴露 GET /api/files/search?q=xxx

**Files:**
- Modify: `packages/backend/src/files/files.controller.ts`

```typescript
@Get('search')
@ApiOperation({ summary: 'Search files by name' })
async searchFiles(
  @CurrentUser() user: UserEntity,
  @Query('q') query: string,
) {
  if (!query || query.trim().length === 0) {
    return { results: [] };
  }
  return this.filesService.searchFiles(user.id, query.trim());
}
```

---

### Task 3: 前端搜索 UI

**Objective:** 在文件列表页顶部加搜索框，输入关键词即时搜索

**Files:**
- Modify: `packages/web/src/pages/FilesPage.tsx`
- Modify: `packages/web/src/api/files.ts` — 新增 search 方法

前端 API:
```typescript
// files.ts
search: async (q: string) => {
  const r = await apiClient.get('/files/search', { params: { q } });
  return r.data.results;
}
```

搜索框 UI:
- 在面包屑导航下方新增搜索栏
- 🔍 输入框 + 清除按钮
- 输入后调用 API 实时展示结果（debounce 300ms）
- 结果列表替换当前的文件夹/文件视图
- 点击结果文件跳转到其所在文件夹
- 空状态：「未找到匹配的文件」

---

### Task 4: 搜索 UX 细节

**Objective:** 完善交互细节

- 回车触发搜索
- 点击搜索结果的文件夹名 → 导航到该文件夹
- 搜索结果支持预览/下载/删除操作（复用 FilesPage 的逻辑）
- 清空搜索框 → 恢复当前文件夹视图
- 移动端适配搜索框宽度

---

## 总改动量

| 层 | 新增文件 | 修改文件 | 代码量 |
|----|----------|----------|--------|
| 后端 | 0 | 2 (service+controller) | ~50 行 |
| 前端 | 0 | 2 (api+page) | ~100 行 |

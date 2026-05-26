# 回收站 — 实现计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 删除文件时进入回收站（软删除），30 天后自动彻底清除。用户可从回收站恢复或彻底删除文件。

**Architecture:** Prisma `File` 模型新增 `deletedAt` 字段（NULL = 正常），所有查询自动过滤 `deletedAt IS NULL`。前端新增「回收站」入口，后端新增恢复/彻底删除/清空回收站 API。

**Tech Stack:** Prisma soft-delete, NestJS, React

---

### Task 1: 数据库 Schema 变更

**Objective:** File 模型增加 deletedAt 字段

**Files:**
- Modify: `packages/shared/prisma/schema.prisma`

```prisma
model File {
  // ... existing fields ...
  deletedAt   DateTime?   // NULL = active; non-NULL = in trash
  @@index([userId, deletedAt])  // for efficient trash queries
}
```

运行 migration:
```bash
cd packages/shared && npx prisma migrate dev --name add_file_deleted_at
```

---

### Task 2: 修改 FilesService 支持软删除

**Objective:** 所有查询/操作适配软删除模式

**Files:**
- Modify: `packages/backend/src/files/files.service.ts`

变更内容:
1. **listFiles / browse** — 查询时自动加 `deletedAt: null`
2. **deleteFile** — 改为 `update({ data: { deletedAt: new Date() } })`，不再物理删除
3. **downloadFile** — 增加校验：`deletedAt !== null` 时返回 404
4. **新增 listTrashFiles** — 查询 `deletedAt IS NOT NULL`
5. **新增 restoreFile** — 设置 `deletedAt = null`
6. **新增 purgeFile** — 物理删除文件 + 数据
7. **新增 emptyTrash** — 批量物理删除所有已删除文件

---

### Task 3: 修改 FilesController 增加回收站路由

**Objective:** 暴露回收站相关 API

**Files:**
- Modify: `packages/backend/src/files/files.controller.ts`

新增路由:
```
GET    /api/files/trash        — 查看回收站文件列表
POST   /api/files/:id/restore  — 恢复单个文件
DELETE /api/files/:id/permanent — 彻底删除单个文件
DELETE /api/files/trash/empty   — 清空回收站
```

---

### Task 4: FoldersService 同步适配

**Objective:** 文件夹浏览不再返回已删除文件

**Files:**
- Modify: `packages/backend/src/folders/folders.service.ts`

browse 方法中的文件查询加 `deletedAt: null` 过滤条件。

---

### Task 5: 前端回收站页面

**Objective:** 前端增加回收站入口和页面

**Files:**
- Modify: `packages/web/src/pages/FilesPage.tsx` — 顶部加「回收站」按钮
- Modify: `packages/web/src/api/files.ts` — 新增 trash/restore/purge API

回收站 UI:
- 文件列表显示原文件名、删除时间、原始位置
- 每行操作按钮: 恢复 / 彻底删除
- 顶部按钮: 清空回收站 (需确认)
- 空状态:「回收站是空的」

---

## 总改动量

| 层 | 新增文件 | 修改文件 | 代码量 |
|----|----------|----------|--------|
| Prisma | 0 | 1 (schema) | ~5 行 |
| 后端 | 0 | 3 (files.service/controller, folders.service) | ~80 行 |
| 前端 | 0 | 2 (api+page) | ~80 行 |

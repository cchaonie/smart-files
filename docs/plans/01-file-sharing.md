# 文件分享链接 — 实现计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 用户可为文件生成带过期时间和可选密码的分享链接，外部用户无需登录即可在线预览/下载。

**Architecture:** 新增 `Share` 数据模型存储分享令牌与配置，后端新增分享 Controller；前端 FilesPage 增加「生成分享链接」按钮和 ShareModal 弹窗。分享页无鉴权，通过 token 找到文件后流式返回。

**Tech Stack:** NestJS, Prisma, PostgreSQL, React, TypeScript

---

## 数据库变更

### Task 1: 添加 Share 模型到 Prisma Schema

**Objective:** 在 `schema.prisma` 中增加 Share 表

**Files:**
- Modify: `packages/shared/prisma/schema.prisma`

```prisma
model Share {
  id           String    @id @default(cuid())
  fileId       String
  file         File      @relation(fields: [fileId], references: [id], onDelete: Cascade)
  token        String    @unique
  passwordHash String?   // bcrypt hash, null = 无密码
  expiresAt    DateTime? // null = 永不过期
  downloadCount Int      @default(0)
  createdAt    DateTime  @default(now())

  @@index([token])
  @@index([fileId])
}
```

**Step 2:** 运行 migration:
```bash
cd packages/shared && npx prisma migrate dev --name add_share_model
```

---

### Task 2: 创建分享 Service

**Objective:** 实现分享的 CRUD 逻辑

**Files:**
- Create: `packages/backend/src/share/share.service.ts`
- Create: `packages/backend/src/share/share.module.ts`

核心方法:
- `createShare(userId, fileId, { password?, expiresInHours? })` → 生成 SHA256 token，可选 bcrypt 加密密码
- `verifyShare(token, password?)` → 校验 token 是否存在、是否过期、密码是否正确
- `getSharedFile(token)` → 返回文件信息用于展示
- `listShares(userId)` → 列出当前用户的所有分享
- `deleteShare(userId, shareId)` → 撤销分享

---

### Task 3: 创建分享 Controller

**Objective:** 暴露 REST API

**Files:**
- Create: `packages/backend/src/share/share.controller.ts`

路由:
```
POST   /api/shares              — 创建分享 (需登录)
GET    /api/shares               — 列出我的分享 (需登录)
DELETE /api/shares/:id           — 撤销分享 (需登录)
GET    /api/share/:token         — 查看分享页信息 (无需登录)
GET    /api/share/:token/download — 下载/流式播放 (无需登录)
POST   /api/share/:token/verify  — 验证密码 (无需登录)
```

---

### Task 4: 前端 API 层

**Objective:** 前端封装分享 API 调用

**Files:**
- Create: `packages/web/src/api/shares.ts`

```typescript
import apiClient from './client';

export interface ShareInfo {
  id: string;
  token: string;
  fileId: string;
  fileName: string;
  hasPassword: boolean;
  expiresAt: string | null;
  downloadCount: number;
  createdAt: string;
}

export const sharesApi = {
  create: (fileId: string, opts?: { password?: string; expiresInHours?: number }) =>
    apiClient.post<ShareInfo>('/shares', { fileId, ...opts }),

  list: () => apiClient.get<ShareInfo[]>('/shares'),

  delete: (id: string) => apiClient.delete(`/shares/${id}`),
};
```

---

### Task 5: 前端 ShareModal 组件

**Objective:** 点击「分享」按钮弹出设置面板

**Files:**
- Modify: `packages/web/src/pages/FilesPage.tsx` — 添加 ShareModal 组件和触发按钮
- Create: `packages/web/src/pages/SharePage.tsx` — 独立分享查看页

ShareModal 功能:
- 设置有效期 (1天/7天/30天/永久)
- 可选设置提取密码
- 生成后显示完整分享链接 + 一键复制
- 在文件列表增加「分享管理」入口

---

## 总改动量

| 层 | 新增文件 | 修改文件 | 代码量 |
|----|----------|----------|--------|
| Prisma | 0 | 1 (schema) | ~20 行 |
| 后端 | 3 (share.module/service/controller) | 1 (app.module 注册) | ~200 行 |
| 前端 | 1 (api/shares.ts) | 1 (FilesPage.tsx) | ~150 行 |

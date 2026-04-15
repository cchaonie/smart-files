# Podman 开发环境配置

本文档说明如何使用 Podman 进行本地开发，支持文件修改后立即生效（热重载）。

## 前提条件

- [Podman](https://podman.io/getting-started/installation) 已安装
- [podman-compose](https://github.com/containers/podman-compose) 已安装 (`pip3 install podman-compose`)

验证安装：

```bash
podman --version
podman-compose --version
```

## 快速开始

### 1. 启动开发环境

```bash
npm run dev:podman
```

或者使用 podman-compose 直接启动：

```bash
podman-compose -f podman-compose.dev.yml up --build
```

### 2. 访问应用

- 应用: http://localhost:3000
- 数据库: localhost:5432 (PostgreSQL)

### 3. 停止开发环境

```bash
npm run dev:podman:down
```

### 4. 完全清理（不包括数据）

```bash
npm run dev:podman:clean
```

**注意**：此命令只会删除容器和网络，**不会**删除 `./data/` 目录中的数据。如需删除数据，请手动执行 `rm -rf ./data`。

## 特性

- **热重载**: 修改本地文件会自动同步到容器中，Next.js 会自动刷新
- **数据持久化**: 数据库和上传文件保存在 `./data/` 目录，dev 和生产环境共享
- **文件上传**: 上传的文件保存在 `./data/storage/`
- **rootless 安全**: Podman 默认以非 root 用户运行容器

## 从本地开发迁移到 Podman

如果你之前使用 `npm run dev`（本地 Node.js）开发，想切换到 Podman 同时保留数据：

### 数据存储差异

| 环境 | 数据库位置 | 上传文件位置 |
|------|-----------|-------------|
| `npm run dev` | 本地 PostgreSQL | `./data/storage/` |
| Podman | `./data/postgres/` | `./data/storage/` |

**上传文件**：两个环境都使用 `./data/storage/`，所以上传的文件会保留。

**数据库**：需要手动迁移。

### 自动迁移脚本

```bash
# 确保本地 PostgreSQL 正在运行
npm run dev

# 在另一个终端执行迁移
npm run db:migrate-to-podman
```

此脚本会：
1. 导出本地 PostgreSQL 数据
2. 启动 Podman 数据库
3. 导入数据到 Podman

### 手动迁移

如果你更喜欢手动操作：

```bash
# 1. 导出本地数据库
pg_dump -h localhost -U postgres -d smartfiles > backup.sql

# 2. 确保数据目录存在
mkdir -p ./data/postgres ./data/storage

# 3. 启动 Podman 数据库
podman-compose -f podman-compose.dev.yml up -d db

# 4. 导入数据（需要等几秒让数据库启动）
podman-compose -f podman-compose.dev.yml exec -T db psql -U postgres -d smartfiles < backup.sql

# 5. 启动完整开发环境
npm run dev:podman
```

## 数据持久化（重要）

所有数据（数据库 + 上传文件）都保存在项目根目录的 `./data/` 文件夹中：

```
./data/
├── postgres/          # 数据库文件（账号、文件记录等）
├── storage/           # 上传的文件
│   ├── files/         # 已上传的文件
│   └── tmp/           # 临时分块文件
└── backups/           # 自动备份文件
```

**这意味着：**
- 在 dev 环境注册的账号和上传的文件，切换到生产环境时会**完全保留**
- 数据存储在宿主机上，删除容器不会丢失数据
- `./data/` 目录已添加到 `.gitignore`，不会被提交到代码仓库
- 上传文件路径 (`./data/storage/`) 与本地 `npm run dev` 保持一致

### 备份数据

如果你想备份所有数据，只需复制 `./data/` 目录：

```bash
# 备份
cp -r data data-backup-$(date +%Y%m%d)

# 或者压缩备份
tar czvf smartfiles-backup-$(date +%Y%m%d).tar.gz data/
```

### 迁移到新机器

将 `./data/` 目录复制到新机器的相同位置，然后启动 Podman 即可。

### 完全重置数据

**警告：这将删除所有账号和上传的文件！**

```bash
npm run dev:podman:clean
rm -rf ./data
```

## 环境变量

在 `podman-compose.dev.yml` 中配置以下变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AUTH_SECRET` | dev-secret-change-me-in-production | 用于 session 加密，建议本地开发也设置一个固定值 |
| `AUTH_URL` | http://localhost:3000 | 认证回调 URL |
| `MAX_FILE_SIZE_BYTES` | 524288000 (500MB) | 最大上传文件大小 |

你可以在项目根目录创建 `.env.local` 文件来覆盖这些变量：

```bash
AUTH_SECRET=your-local-dev-secret
```

## 数据库操作

### 执行 Prisma 迁移

```bash
# 在容器内执行
podman-compose -f podman-compose.dev.yml exec app npx prisma migrate dev

# 或者进入容器 shell
podman-compose -f podman-compose.dev.yml exec app sh
npx prisma migrate dev
```

### 查看数据库

```bash
podman-compose -f podman-compose.dev.yml exec db psql -U postgres -d smartfiles
```

## Podman 与 Docker 的差异

| 特性 | Podman | Docker |
|------|--------|--------|
| 守护进程 | 无守护进程 | 需要 dockerd |
| 权限 | 默认 rootless | 默认 root |
| 命令 | `podman` | `docker` |
| Compose | `podman-compose` | `docker-compose` |
| SELinux | 支持 :Z 标签 | 不支持 |

### SELinux 支持

本配置使用了 `:Z` 标签（如 `./data/postgres:/var/lib/postgresql/data:Z`），这是为了支持启用了 SELinux 的系统（如 Fedora、RHEL）。Podman 会自动处理标签，确保容器可以访问挂载的卷。

如果你的系统没有启用 SELinux，`:Z` 标签会被安全地忽略。

### 权限问题

PostgreSQL 容器需要对数据目录有正确的权限。在 Podman rootless 模式下，容器内的用户会被映射到宿主机的当前用户。

首次启动时如果遇到权限错误：

```bash
# 1. 停止容器
podman-compose -f podman-compose.dev.yml down

# 2. 清理并重新创建数据目录
rm -rf ./data/postgres
mkdir -p ./data/postgres

# 3. 重新启动（Podman 会自动设置正确权限）
podman-compose -f podman-compose.dev.yml up -d db
```

### macOS 注意事项

在 macOS 上使用 Podman 时，需要确保 Podman 虚拟机已启动：

```bash
# 检查 Podman 虚拟机状态
podman machine list

# 如果未运行，启动虚拟机
podman machine start

# 如果需要更多资源（内存/CPU），可以创建新虚拟机
podman machine rm podman-machine-default
podman machine init --cpus 4 --memory 8192
podman machine start
```

## 故障排除

### 热重载不生效

1. 检查文件是否在 `src` 目录下
2. 查看浏览器控制台是否有 WebSocket 连接错误
3. 尝试刷新页面

### 端口冲突

如果 3000 或 5432 端口被占用，修改 `podman-compose.dev.yml` 中的端口映射：

```yaml
ports:
  - "3001:3000"  # 使用 3001 端口访问应用
```

### node_modules 问题

如果遇到模块找不到的错误，尝试重建容器：

```bash
podman-compose -f podman-compose.dev.yml down -v
podman-compose -f podman-compose.dev.yml up --build
```

### 数据库权限错误

如果遇到 `Permission denied` 错误或数据库无法启动：

```bash
# 停止容器
podman-compose -f podman-compose.dev.yml down

# 清理数据目录并重新创建
rm -rf ./data/postgres
mkdir -p ./data/postgres

# 重新启动
podman-compose -f podman-compose.dev.yml up -d db
```

### 数据库连接失败

如果应用无法连接到数据库，可能是数据库还未完全启动。Podman 的 `depends_on` 只会等待容器启动，不会等待数据库就绪。

解决方案：
1. 先单独启动数据库：`podman-compose -f podman-compose.dev.yml up -d db`
2. 等待 5-10 秒
3. 再启动应用：`podman-compose -f podman-compose.dev.yml up -d app`

## 生产环境部署

生产环境使用：

```bash
podman-compose -f podman-compose.yml up --build
```

这将使用多阶段构建的 `Dockerfile`，生成优化后的生产镜像。

## 常用 Podman 命令

```bash
# 查看运行中的容器
podman ps

# 查看所有容器（包括停止的）
podman ps -a

# 查看容器日志
podman logs <container-name>

# 进入容器
podman exec -it <container-name> sh

# 停止容器
podman stop <container-name>

# 删除容器
podman rm <container-name>

# 查看容器资源使用
podman stats
```

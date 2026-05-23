# Podman 开发环境配置

本文档说明如何使用 Podman 进行本地开发。

> **注意：** 在新的 monorepo 架构下，推荐**在本地运行后端和前端**，仅使用 Podman 运行 PostgreSQL 数据库。

## 前提条件

- [Podman](https://podman.io/getting-started/installation) 已安装
- [podman-compose](https://github.com/containers/podman-compose) 已安装 (`pip3 install podman-compose`)
- Node.js 20+

验证安装：

```bash
podman --version
podman-compose --version
node --version
```

## 快速开始

### 1. 启动数据库

```bash
npm run db:start
```

这会在 Podman 中启动 PostgreSQL：
- 数据库: localhost:5432
- 用户: postgres / postgres
- 数据库名: smartfiles

或者手动运行：

```bash
podman run -d --name smart-files-db \
  -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=smartfiles \
  -v smart-files-postgres:/var/lib/postgresql/data \
  --replace postgres:16-alpine
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp packages/backend/.env.example packages/backend/.env
# 编辑 packages/backend/.env，设置 JWT_SECRET 等
```

### 4. 执行数据库迁移

```bash
cd packages/shared
npx prisma migrate dev
```

### 5. 启动后端 API

```bash
cd packages/backend
npm run start:dev
```

- API: http://localhost:4000
- Swagger 文档: http://localhost:4000/api/docs

### 6. 启动 Web 前端

在另一个终端：

```bash
cd packages/web
npm run dev
```

- 前端: http://localhost:3000
- Vite 开发服务器会自动将 `/api` 请求代理到 `localhost:4000`

### 7. 启动 Mobile（可选）

```bash
cd packages/mobile
npm start
```

## 停止开发环境

```bash
# 停止并删除数据库容器
npm run db:stop

# 或者手动操作
podman stop smart-files-db
podman rm smart-files-db

# 停止后端和前端
# 在对应终端按 Ctrl+C
```

## 数据持久化

数据库和上传文件保存在项目根目录的 `./data/` 文件夹中：

```
./data/
├── postgres/          # 数据库文件（账号、文件记录等）
├── storage/           # 上传的文件
│   ├── files/         # 已上传的文件
│   └── tmp/           # 临时分块文件
└── backups/           # 自动备份文件
```

**这意味着：**
- 数据存储在宿主机上，删除容器不会丢失数据
- `./data/` 目录已添加到 `.gitignore`
- 后端和前端在本地运行时共用同一套数据

### 备份数据

```bash
# 备份
cp -r data data-backup-$(date +%Y%m%d)

# 或者压缩备份
tar czvf smartfiles-backup-$(date +%Y%m%d).tar.gz data/
```

### 完全重置数据

**警告：这将删除所有账号和上传的文件！**

```bash
npm run db:stop
rm -rf ./data
```

## 数据库操作

### Prisma 迁移

所有 Prisma 命令应从 `packages/shared` 目录执行，因为 `schema.prisma` 位于此处：

```bash
cd packages/shared

# 开发迁移（会创建新的 migration 文件）
npx prisma migrate dev

# 部署迁移（用于生产环境）
npx prisma migrate deploy

# 查看数据库
npx prisma studio
```

### 查看数据库

```bash
podman exec -it smart-files-db psql -U postgres -d smartfiles
```

## macOS 注意事项

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

**后端：** NestJS 自带文件监控，修改代码后会自动重启。  
**前端：** Vite 自带 HMR，修改代码后浏览器会自动刷新。

如果不起作用：
1. 检查文件是否在对应包的 `src` 目录下
2. 查看终端是否有编译错误
3. 尝试手动刷新页面

### 端口冲突

| 服务 | 默认端口 |
|------|---------|
| Web 前端 | 3000 |
| 后端 API | 4000 |
| PostgreSQL | 5432 |

如果端口被占用：
- **Web**: 修改 `packages/web/vite.config.ts` 中的 `port`
- **后端**: 在 `packages/backend/.env` 中修改 `PORT`
- **数据库**: 修改 `podman run` 命令中的 `-p` 端口映射

### node_modules 问题

如果遇到模块找不到的错误：

```bash
# 从根目录重新安装
rm -rf node_modules packages/*/node_modules
npm install
```

### 数据库权限错误

```bash
# 停止数据库
npm run db:stop

# 清理数据目录并重新创建
rm -rf ./data/postgres
mkdir -p ./data/postgres

# 重新启动
npm run db:start
```

### 数据库连接失败

确保后端 `.env` 中的 `DATABASE_URL` 正确：
- 使用 Podman 数据库时：`postgresql://postgres:postgres@localhost:5432/smartfiles?schema=public`
- 如果后端也在 Podman 中运行（未来支持）：使用 `db` 作为主机名

### CORS 错误

如果前端调用 API 时遇到 CORS 错误，检查 `packages/backend/.env` 中的 `CORS_ORIGIN` 是否包含前端地址（例如 `http://localhost:3000`）。

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

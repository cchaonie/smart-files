# Smart Files

Next.js file manager with per-user storage, chunked uploads (pause/resume), HTTP Range downloads, and Podman Compose deployment.

## Features

- Email + password registration and sign-in (Auth.js, JWT sessions).
- Uploads split into configurable chunks; **pause** and pick the **same file** again to **resume** (session id is stored in `sessionStorage`).
- Downloads support **`Range`** requests for resumable downloads.
- Metadata in **PostgreSQL** (Prisma); blobs on disk under `UPLOAD_ROOT`.

## Local development

### 方式一：本地 Node.js（推荐快速开发）

1. Copy environment and start Postgres:

   ```bash
   cp .env.example .env
   # Edit AUTH_SECRET and DATABASE_URL if needed
   ```

2. Install dependencies and apply migrations:

   ```bash
   npm install
   npx prisma migrate deploy
   # or during early schema iteration: npx prisma db push
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000), register an account, then open **Your files** at `/files`.

### 方式二：Podman 开发模式（推荐，数据可保留到生产）

使用 Podman Compose 启动开发环境，支持**热重载**（修改代码立即生效）：

```bash
npm run dev:podman
```

- 应用: http://localhost:3000
- 数据库: localhost:5432

**数据持久化特性：**
- 数据库和上传文件保存在 `./data/` 目录
- **在 dev 环境注册的账号和上传的文件，部署到生产环境时会完全保留**
- 支持随时在 dev 和生产环境之间切换，数据不会丢失

**从本地开发迁移到 Podman：**

如果你之前用 `npm run dev` 创建了账号和上传了文件，可以一键迁移：

```bash
# 先确保本地 PostgreSQL 在运行
npm run db:migrate-to-podman

# 然后启动 Podman 环境
npm run dev:podman
```

更多详情见 [PODMAN_DEV.md](./PODMAN_DEV.md)

## GitHub Container Registry 镜像（推荐快速部署）

预构建镜像已发布到 GitHub Container Registry，无需本地构建，拉取后直接启动：

```bash
# 1. 登录 GitHub Container Registry（首次需要）
echo $GITHUB_TOKEN | podman login ghcr.io -u $GITHUB_USERNAME --password-stdin
# 或使用 docker:
# echo $GITHUB_TOKEN | docker login ghcr.io -u $GITHUB_USERNAME --password-stdin

# 2. 设置环境变量并启动
export AUTH_SECRET="$(openssl rand -base64 32)"
podman-compose -f podman-compose.yml pull
podman-compose -f podman-compose.yml up
```

- 首次启动会自动执行数据库迁移 (`prisma migrate deploy`)，然后启动应用
- 数据（数据库和上传文件）保存在 `./data/` 目录，便于备份和迁移
- App: [http://localhost:3000](http://localhost:3000)

Override the public URL if you publish behind another host:

```bash
AUTH_URL=https://files.example.com podman-compose -f podman-compose.yml up
```

## Podman Compose (本地构建部署)

如果需要本地构建镜像（例如修改了代码）：

```bash
export AUTH_SECRET="$(openssl rand -base64 32)"
podman-compose -f podman-compose.yml up --build
```

- 同时指定了 `image` 和 `build` 时，`--build` 会优先本地构建并标记镜像
- 不带 `--build` 时，如果本地镜像已存在则直接使用，否则会尝试拉取远程镜像

## API summary

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/register` | Register `{ email, password, name? }` |
| POST | `/api/upload/session` | Start upload `{ fileName, totalSize, chunkSize? }` |
| GET | `/api/upload/session/[uploadId]` | Resume: list received chunk indexes |
| PUT | `/api/upload/session/[uploadId]/chunk?index=n` | Upload one chunk (raw body) |
| POST | `/api/upload/session/[uploadId]/complete` | Merge chunks, create file record |
| GET | `/api/files` | List current user's files |
| DELETE | `/api/files/[id]` | Delete file |
| GET | `/api/files/[id]/download` | Download (supports `Range`) |

## Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Secret for Auth.js (required in production) |
| `AUTH_URL` | Origin of the app (e.g. `http://localhost:3000`) |
| `UPLOAD_ROOT` | Directory for `tmp/` and `files/` (default `./data/storage`) |
| `MAX_FILE_SIZE_BYTES` | Max upload size (default 500 MiB) |
| `DEFAULT_CHUNK_SIZE_BYTES` | Server default chunk size (256 KiB–32 MiB) |
| `MAX_CHUNKS` | Safety cap on chunk count (default 50000) |

## Notes

- Horizontal scaling would require shared storage for `UPLOAD_ROOT` (or object storage) so all app instances see the same chunks and files.
- The default deployment is a single app replica with bind mounts, which matches `podman-compose.yml`.

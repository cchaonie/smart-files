# Smart Files

Monorepo file manager with a **NestJS** backend API, **Vite + React** web frontend, **Expo** mobile app, and **Prisma** shared schema. Features per-user storage, chunked uploads (pause/resume), HTTP Range downloads, and Podman Compose deployment.

## Architecture

```
packages/
  backend/    NestJS API (port 4000)
  web/        Vite React SPA (port 3000)
  mobile/     Expo React Native
  shared/     Prisma schema + shared TypeScript types
```

## Features

- Email + password registration and sign-in (JWT authentication).
- Uploads split into configurable chunks; **pause** and pick the **same file** again to **resume**.
- Downloads support **`Range`** requests for resumable downloads.
- Metadata in **PostgreSQL** (Prisma); blobs on disk under `UPLOAD_ROOT`.

## Local Development

### 1. Start PostgreSQL

```bash
# Copy the backend environment template
cp packages/backend/.env.example packages/backend/.env
# Edit DATABASE_URL, JWT_SECRET, etc. if needed

# Start the database in Podman
npm run db:start
```

### 2. Install dependencies

```bash
npm install
```

This installs dependencies for all workspace packages.

### 3. Set up the database schema

```bash
cd packages/shared
npx prisma migrate dev
# or during early schema iteration: npx prisma db push
```

### 4. Run the backend

```bash
cd packages/backend
npm run start:dev
```

The API will be available at http://localhost:4000  
Swagger docs: http://localhost:4000/api/docs

### 5. Run the web frontend

In a new terminal:

```bash
cd packages/web
npm run dev
```

Open http://localhost:3000. The Vite dev server proxies `/api` requests to the backend at `localhost:4000`.

### 6. Run the mobile app (optional)

```bash
cd packages/mobile
npm start
```

## Production Deployment

See [DEPLOY.md](./DEPLOY.md) for the target production architecture. Production Docker images and compose files are not yet implemented for the new monorepo structure.

## API Summary

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/register` | Register `{ email, password, name? }` |
| POST | `/api/upload/session` | Start upload `{ fileName, totalSize, chunkSize? }` |
| GET | `/api/upload/session/:uploadId` | Resume: list received chunk indexes |
| PUT | `/api/upload/session/:uploadId/chunk?index=n` | Upload one chunk (raw body) |
| POST | `/api/upload/session/:uploadId/complete` | Merge chunks, create file record |
| GET | `/api/files` | List current user's files |
| DELETE | `/api/files/:id` | Delete file |
| GET | `/api/files/:id/download` | Download (supports `Range`) |

## Environment Variables

### Backend (`packages/backend/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for JWT signing (min 32 chars) |
| `UPLOAD_ROOT` | Directory for `tmp/` and `files/` (default `./data/storage`) |
| `MAX_FILE_SIZE_BYTES` | Max upload size (default 10 GiB) |
| `PORT` | API server port (default `4000`) |
| `CORS_ORIGIN` | Comma-separated allowed origins (default `http://localhost:3000`) |

### Web (`packages/web/.env` — optional)

The Vite dev server is already configured to proxy `/api` to `http://localhost:4000`. You only need a `.env` file for Playwright E2E test credentials (see `packages/web/.env.example`).

## Deployment Files

Production deployment files (Dockerfile, podman-compose.yml, etc.) are not yet implemented for the new monorepo architecture. The current setup is local-dev only.

## Notes

- Horizontal scaling would require shared storage for `UPLOAD_ROOT` (or object storage) so all backend instances see the same chunks and files.
- The Prisma schema is the single source of truth in `packages/shared/prisma/schema.prisma`. Run all Prisma CLI commands from `packages/shared`.

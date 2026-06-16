# Smart Files — Agent Guide

Monorepo file manager: **NestJS** backend, **Vite + React** web, **Expo** mobile, **Prisma + PostgreSQL** shared schema.

## Quick commands

```bash
npm run db:start        # start PostgreSQL in Podman (port 5432)
npm run db:stop         # stop + remove container
npm run dev             # starts DB + backend + web in parallel (npm-run-all)
npm run prd:build       # builds web + backend for production (runs sequentially)
npm run pm2:start       # start backend via PM2 (production)
```

### Backend (packages/backend)
```bash
npm run start:dev       # nest start --watch (port 4000)
npm run build           # nest build
npm run lint            # eslint src/ --fix
npm run test            # jest (default config in package.json)
npm run test:cov        # jest --coverage
npm run test:e2e        # jest --config ./test/jest-e2e.json
npm run test:integration # jest --config ./test/jest-integration.json
npm run db:generate     # prisma generate
npm run db:migrate      # prisma migrate dev
```

### Web (packages/web)
```bash
npm run dev             # vite dev server (port 3000, proxies /api → localhost:4000)
npm run build           # tsc && vite build
```
No lint or test scripts exist for web yet.

### Shared (packages/shared) — always run from this directory
```bash
npm run db:migrate      # dotenv -e ../../.env -- prisma migrate dev --schema=./prisma/schema.prisma
npm run db:push         # dotenv -e ../../.env -- prisma db push --schema=./prisma/schema.prisma
npm run db:generate     # dotenv -e ../../.env -- prisma generate --schema=./prisma/schema.prisma
npm run db:deploy       # dotenv -e ../../.env -- prisma migrate deploy --schema=./prisma/schema.prisma
npm run db:studio       # dotenv -e ../../.env -- prisma studio --schema=./prisma/schema.prisma
```
Uses root `.env` (not backend `.env`). `dotenv-cli` is a devDependency of shared.

## Architecture gotchas

- **Global prefix**: `api` — all backend routes are under `/api/*`.
- **Swagger UI** at `http://localhost:4000/docs` (code logs `/api/docs` but setup ignores global prefix).
- **Body parser**: Custom (via `body-parser` lib), **50mb limit** on all parsers — required for chunked uploads. Not the NestJS built-in.
- **Auth**: `passport-jwt` + `@nestjs/jwt`. Guard at `common/guards/jwt.guard.ts` (`JwtAuthGuard`). `@CurrentUser` decorator at `common/decorators/current-user.decorator.ts`.
- **BullMQ**: Job queues for thumbnail generation and AI tagging. Requires **Redis** (`REDIS_URL=redis://localhost:6379`). Not started by default — no npm script for it.
- **Backend modules**: `auth`, `files`, `folders`, `upload`, `share`, `photos`, `albums`, `users`, `ai-tagging`, `redis`, `prisma`. No `static/` module. Guard is `JwtAuthGuard` (singular file).
- **Config**: `ConfigModule.forRoot({ isGlobal: true })` — loads `packages/backend/.env`. No ConfigService typing.

## Backend env (packages/backend/.env)

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smartfiles?schema=public
JWT_SECRET=your-jwt-secret-change-in-production
UPLOAD_ROOT=../../../data/storage      # relative from packages/backend CWD
MAX_FILE_SIZE_BYTES=10737418240         # 10 GiB
CORS_ORIGIN=http://localhost:3000,http://localhost:19006
PORT=4000
PHOTO_ROOT=/mnt/pool                    # mergerfs photo pool
REDIS_URL=redis://localhost:6379
```

Root `.env` holds `POSTGRES_PASSWORD` + `JWT_SECRET` (used by deployment), not by the backend directly.

## Web notes

- **Build pipeline**: `tsc && vite build` — typecheck runs before Vite bundle.
- **`@/*`** alias maps to `src/*`.
- **React Router 7** with `PrivateRoute`/`PublicRoute` wrappers in `App.tsx`.
- **Existing pages**: Home, Login, Register, Files, Photos, PhotoDetail, Albums, AlbumDetail, FamilyTimeline, Uploads, Settings, Share.
- **`AuthContext`** for JWT state, **`UploadContext`** for upload state.

## Shared package

- **Entry** `main` = `./types/index.ts` (raw TS, not compiled — workspace reference resolves it).
- **i18n**: `src/i18n/` — English + Chinese. React context provider (`useI18n()`).
- **Prisma** cli commands must run from `packages/shared` with `dotenv -e ../../.env`.

## Testing

- **Backend**: Jest (config in `packages/backend/package.json`). Test files are `*.spec.ts` co-located with source. `test:e2e` and `test:integration` scripts reference config files that don't exist yet.
- **Web**: No test framework configured. Playwright not installed.
- **Mobile**: No test framework configured.

## Storage layout

```
data/storage/
├── files/    # completed uploads (named by storageKey)
└── tmp/      # upload chunks (per-session subdirectories)
```

## Mobile

- `EXPO_PUBLIC_API_URL` for server URL config. Physical devices need LAN IP (not localhost).
- **Expo SDK 54** — 所有新增的 `expo-*` 依赖必须兼容 SDK 54（如 `expo-device` 用 `~8.x`，非 `56.x`）。使用 `npm view <pkg> versions` 确认版本后再安装。iOS simulator 使用 `localhost`，Android emulator 自动使用 `10.0.2.2`。

## Database

- **Schema**: `packages/shared/prisma/schema.prisma`. Models: User, Folder, File, Share, UploadSession, Photo, PhotoTag, Album, AlbumPhotoMember, SharedAlbum.
- **Soft delete**: File model uses `deletedAt` (nullable DateTime).
- **Migrations**: `packages/shared/prisma/migrations/`.

## Production deployment

```bash
podman build -t smart-files:latest .
podman-compose up -d
```

- Dockerfile builds NestJS + Prisma client in stage 1, production stage serves `dist/main`.
- Nginx config at root for reverse proxy + SPA fallback.
- PM2 ecosystem config at root for process management.
- Android APK release via GitHub Actions (tag `v*` triggers build).

## Conventions

- `@smart-files/shared` workspace import for shared types.
- ESLint: `no-explicit-any: off`, unused vars allowed with `_` prefix.
- Backend tsconfig: `strictNullChecks: false`, `noImplicitAny: false`.
- Web tsconfig: `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`.
- File naming: `kebab-case.ts` for modules, `PascalCase.tsx` for components.

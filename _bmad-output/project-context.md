---
project_name: 'smart-files'
user_name: 'Chris'
date: '2026-06-12'
sections_completed:
  ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 85
optimized_for_llm: true
existing_patterns_found: 12
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

### Core Frameworks

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Backend | NestJS + TypeScript | 11.x / 5.3.3 | commonjs module, `strictNullChecks: false` |
| Web | React + Vite + Tailwind CSS | 19.1 / 6.2 / 4.1 | `strict: true`, ES modules |
| Mobile | Expo + React Native | 54 / 0.81 | `strict: true` via expo/tsconfig.base |
| Database | PostgreSQL + Prisma | 16 / 6.19 | Prisma commands run from `packages/shared/` |
| Auth | passport + passport-jwt + bcryptjs | 0.7 / 4.0 / 3.0 | JWT-based, `@CurrentUser()` decorator |

### Key Dependencies

| Dependency | Version | Purpose |
|-----------|---------|---------|
| `@nestjs/bullmq` + `bullmq` | 11.0 / 5.78 | Async job queue (thumbnails, AI tagging) |
| `ioredis` | 5.11 | Redis client (BullMQ backend) |
| `sharp` | 0.35.1 | Image thumbnail generation (320px WebP + 1200px JPEG) |
| `class-validator` + `class-transformer` | 0.14 / 0.5 | DTO validation |
| `@nestjs/swagger` | 11.4 | API docs at `/api/docs` |
| `react-router-dom` | 7.5 | Web routing |
| `@react-navigation/native` + `bottom-tabs` | 7.x | Mobile navigation |
| `expo-media-library` | 18.2 | Camera roll access (Android) |
| `expo-notifications` | 0.32 | Upload completion notifications |
| `framer-motion` | 12.40 | Web animations |

### Infrastructure

| Service | Setup | Notes |
|---------|-------|-------|
| Node.js | nvm (v20.20.2) | Default alias set |
| Process mgmt | PM2 7.0 (fork mode) | Process name: `smart-files-backend` |
| Redis | `apt install redis-server` | systemd, port 6379, 127.0.0.1 only |
| Storage pool | mergerfs at `/mnt/pool` | USB pooling, `{user}/{YYYY}/{MM}/` folder structure |
| Reverse proxy | Nginx | `127.0.0.1:4000` → `/api`, Cloudflare Tunnel |
| Database (prod) | PostgreSQL 16 (Podman) | Local `localhost:5432` |

### TypeScript Configurations

```yaml
Backend (packages/backend/tsconfig.json):
  module: commonjs, target: ES2021
  strictNullChecks: false, noImplicitAny: false
  skipLibCheck: true, emitDecoratorMetadata: true
  experimentalDecorators: true

Mobile (packages/mobile/tsconfig.json):
  extends: expo/tsconfig.base
  strict: true

Web (packages/web/tsconfig.json):
  strict: true (Vite project default)
```

### NPM Workspace Monorepo

- Root `package.json` workspaces: `["packages/*"]`
- Dependencies hoisted to root `node_modules/`
- `npm install` from root only -- never `cd packages/backend && npm install`
- Shared types via `@smart-files/shared` workspace reference
- Prisma schema and migrations live in `packages/shared/prisma/`

### Language-Specific Rules

#### TypeScript Configuration

- **Backend (`packages/backend/tsconfig.json`):** `strictNullChecks: false`, `noImplicitAny: false`, `skipLibCheck: true`, `emitDecoratorMetadata: true`, `experimentalDecorators: true`, `target: ES2021`, `module: commonjs`
- **Mobile (`packages/mobile/tsconfig.json`):** `extends: expo/tsconfig.base`, `strict: true`
- **Web (`packages/web/tsconfig.json`):** `strict: true` (Vite project default)
- **Backend must compile with zero errors** before push: run `nest build` or `tsc --noEmit`
- Push first checks require successful TypeScript compilation

#### Import/Export Conventions

- **Backend:** Relative imports (`../prisma/prisma.service`), no path aliases
- **Web:** `@/` path alias maps to `src/*`
- **Mobile:** Relative imports
- **Shared:** Referenced via `@smart-files/shared` workspace reference
- **NestJS modules:** Decorator-based DI (`@Injectable()`, `@Module({ controllers, providers, exports })`)

#### Error Handling Patterns

- Use NestJS built-in exceptions: `HttpException`, `BadRequestException`, `NotFoundException`, `ForbiddenException`
- DTO validation via `class-validator` decorators: `@IsString()`, `@IsOptional()`, `@IsInt()`, `@Min()`
- All async methods use `async/await` — no bare `.then()` chains
- BullMQ workers: throwing an error triggers automatic retry (default 3 attempts), then moves to failed
- Exception filters at the controller layer catch and format errors as `{ message, statusCode, error }`

#### Prisma-Specific Rules

- **Always run Prisma commands from `packages/shared/`**
- Use `dotenv -e ../../.env` wrapper for env loading (available via scripts in shared/package.json)
- **Production migration: NEVER use `prisma migrate dev`** — use `prisma migrate deploy` instead
- Dev workflow: schema change → `prisma migrate dev` → commit schema + migration files to git
- Prod workflow: git pull → `prisma migrate deploy` → `prisma generate`
- Prisma Client is generated via `@prisma/client` (not custom generator)

#### Async/Await & Promise Patterns

- BullMQ job handlers must be `async` functions
- File system operations use `fs.promises` API (not callback-based `fs`)
- Worker errors bubble up naturally; BullMQ handles retry/backoff
- Queue job data must be JSON-serializable (avoid passing circular references or class instances)

### Framework-Specific Rules

#### NestJS Backend

- **Module structure:** `controller → service → module`. DTOs are either inline or in a `dto/` subdirectory within the module.
- **All controllers use `@UseGuards(JwtAuthGuard)`** — authentication is required by default.
- **Global prefix:** `/api` — all routes are prefixed automatically.
- **Current user injection:** `@CurrentUser()` decorator returns `{ id: string, name: string }` from JWT payload.
- **PrismaService** is a global singleton `@Injectable()` registered in the PrismaModule — inject via constructor.
- **BullMQ Workers** must be registered in `providers` array of the module (not `controllers`).
- **Queue registration:** Use `BullModule.registerQueue({ name: 'queue-name' })` in the module `imports`.
- **DTO Validation:** Use `class-validator` decorators (`@IsString()`, `@IsOptional()`, `@IsInt()`) on DTO classes, with `class-transformer` for serialization.
- **ConfigService:** Use `@nestjs/config` `ConfigService` to read env vars. Define defaults for all configurable values.

#### React Web (`packages/web/`)

- **Functional components + Hooks only** — no class components.
- **Global state:** React Context (`AuthContext` for JWT auth state, `I18nContext` for language).
- **Routing:** `react-router-dom` v7 with `<BrowserRouter>`, route components in `pages/` directory.
- **Styling:** Tailwind CSS 4 with `@apply` for reusable style classes. Cobalt blue (`#2563eb`) is the primary brand color.
- **API calls:** Axios instance with interceptor for JWT token injection. Base URL handled by Vite proxy (`/api` → `localhost:4000`).
- **Animations:** `framer-motion` for page transitions and component animations.

#### React Native / Expo Mobile

- **Expo managed workflow** — `expo start` to launch, `expo start --android` for device.
- **Navigation:** Hybrid architecture — bottom tab navigator (`@react-navigation/bottom-tabs`) + stack navigator (`@react-navigation/native-stack`).
- **Camera roll:** `expo-media-library` for photo detection and access.
- **Notifications:** `expo-notifications` for upload completion alerts.
- **Background tasks:** `expo-task-manager` + `expo-background-fetch` for periodic photo detection.
- **Icons:** Custom SVG icons via `react-native-svg` (22 icons in `components/icons.tsx`).
- **Animations:** `react-native-reanimated` for spring-based UI animations.
- **Storage:** `@react-native-async-storage/async-storage` for token and settings persistence.
- **Design system:** Matches Web UI — cobalt blue primary, zinc gray scale, glassmorphism effects.

#### API Design Patterns

- RESTful with NestJS decorators — endpoints follow existing conventions (`/api/files`, `/api/photos`, `/api/albums`).
- Photo upload response: `{ id, status: "processing" }` — async pipeline, client does not wait for thumbnails/tags.
- Error format: `{ message, statusCode, error }` — NestJS default exception format.
- Pagination: Query params `?skip=N&take=N` for list endpoints.
- File serving: Range request support for previews and downloads (`GET /api/files/:id/preview`).

### Testing Rules

#### Test Framework & Configuration

- **Framework:** Jest 29.7 + ts-jest
- **Config location:** `packages/backend/package.json` (jest section inline)
- **Test file pattern:** `*.spec.ts` — co-located with source files
- **Root dir:** `packages/backend/src/`
- **E2E tests:** `test/` directory at `packages/backend/test/`
- **Transformer:** `ts-jest` for `.ts` files
- **Coverage output:** `packages/backend/coverage/`

#### Unit Test Patterns

- Use `@nestjs/testing` `Test.createTestingModule()` to create a NestJS testing module
- Mock all external dependencies (PrismaService, Queue, ConfigService) with plain objects
- For BullMQ queues, provide `{ provide: getQueueToken('queue-name'), useValue: { add: jest.fn() } }`
- For PrismaService, mock all used methods (`findFirst`, `create`, `update`, `findUnique`, etc.)
- Test both success and error paths for each method
- Use `describe('methodName')` and `it('should ...')` naming convention

#### Mock Conventions

```typescript
// BullMQ queue mock
const mockQueue = { add: jest.fn().mockResolvedValue(undefined) };

// PrismaService mock
const mockPrisma = {
  photo: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
};

// Testing module
const module = await Test.createTestingModule({
  providers: [
    PhotosService,
    { provide: getQueueToken('photo-thumbnail'), useValue: mockQueue },
    { provide: PrismaService, useValue: mockPrisma },
    { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('/mnt/pool') } },
  ],
}).compile();
```

#### Integration / E2E Test Patterns

- Boot full NestJS app with `Test.createTestingModule({ imports: [AppModule] })`
- Use `supertest` for HTTP-level testing
- Test complete request/response flow including auth headers
- E2E tests in `packages/backend/test/` directory

### Code Quality & Style Rules

#### ESLint Configuration (Backend)

- `@typescript-eslint/no-explicit-any: off` — `any` type is permitted
- `@typescript-eslint/no-unused-vars: error` with `argsIgnorePattern: '^_'` — unused params must be prefixed with `_`
- Prettier available but no mandatory config file — use default formatting
- Lint command: `npm run lint` (runs from `packages/backend/`)

#### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Module files | `kebab-case.ts` | `photos.module.ts`, `photos.service.ts` |
| React components | `PascalCase.tsx` | `PhotoGrid.tsx`, `PhotoViewer.tsx` |
| Classes (NestJS) | `PascalCase` | `PhotosService`, `JwtAuthGuard` |
| Functions/methods | `camelCase` | `computeHash()`, `buildStoragePath()` |
| Constants (env vars) | `UPPER_SNAKE_CASE` | `PHOTO_ROOT`, `DATABASE_URL` |
| Constants (code) | `camelCase` | `photoRoot`, `thumbRoot` |
| Database models | `PascalCase` | `Photo`, `PhotoTag`, `Album` |
| DTO properties | `camelCase` | `originalName`, `mimeType` |

#### Directory Structure

```
packages/backend/src/          Functional grouping
  photos/                      Photos module
    photos.module.ts
    photos.controller.ts
    photos.service.ts
    thumbnail.service.ts       Thumbnail generation service
  albums/                      Albums module
  ai-tagging/                  AI tagging module (future)

packages/web/src/
  pages/                       Route-level components
  components/                  Reusable UI components
  context/                     React Context providers
  api/                         API client functions

packages/mobile/src/
  screens/                     Screen-level components
  components/                  Reusable UI components
  context/                     React Context providers
  api/                         API client functions

packages/shared/prisma/        Prisma schema + migrations
packages/shared/types/         Shared TypeScript interfaces
```

#### Documentation Patterns

- No JSDoc required for NestJS services — method names and TypeScript types are self-documenting
- Complex logic should have inline comments explaining the "why" (not the "what")
- DTOs don't need separate documentation — `class-validator` decorators serve as documentation
- API endpoints are documented via `@nestjs/swagger` decorators (visible at `/api/docs`)

### Development Workflow Rules

#### Git & Branching

- **Only `main` branch is permanent.** Feature branches (`feat/*`) are deleted locally and remotely after merge.
- **Pre-push check:** Must run `tsc --noEmit` from `packages/backend/` with zero errors before pushing.
- **Push command:** `source ~/.bashrc && proxy && git push` (sets `https_proxy=http://127.0.0.1:7897`).
- **Alternative push:** `proxychains4 git push` (SOCKS5 proxy at `127.0.0.1:23333`).
- **PR merge:** Squash merge into `main`. Delete branch after merge (both local and remote).
- **Commit style:** No rigid convention — concise but descriptive.

#### Build & Deploy

- Build backend: `cd packages/backend && npm run build` (runs `nest build`)
- Build web: `cd packages/web && npm run build` (runs `tsc && vite build`)
- PM2 process: `smart-files-backend`, fork mode, port 4000
- Nginx reverse proxy: `127.0.0.1:4000` → `/api`
- Cloudflare Tunnel provides HTTPS externally
- **Deploy script:** `scripts/deploy-api.sh` — pulls latest, rebuilds, restarts PM2

#### Production Database Migrations

- **NEVER run `prisma migrate dev` or `prisma db push` on production**
- Production deploy: `cd packages/shared && npm run db:deploy` → runs `prisma migrate deploy`
- After migration: Prisma Client is regenerated during backend build (`nest build`)
- All migration SQL files must be committed to git and pushed
- Dev workflow: `schema change → prisma migrate dev → git commit schema + migrations → push → production: git pull → prisma migrate deploy`

#### Proxy Configuration

- HTTP proxy: `http://127.0.0.1:7897` (for `npm install`, `git push`)
- SOCKS5: `socks5://127.0.0.1:7897` (for proxychains4)
- Proxy function in `~/.bashrc`: `export https_proxy=http://127.0.0.1:7897 http_proxy=http://127.0.0.1:7897 all_proxy=socks5://127.0.0.1:7897`
- Required for git push and npm operations (install, publish) behind network restrictions

### Critical Don't-Miss Rules

#### Anti-Patterns to Avoid

- **Do NOT run `npm install` from sub-package directories** — always from root. Monorepo hoists dependencies to root `node_modules/`.
- **Do NOT use `prisma migrate dev` or `prisma db push` on production** — only `prisma migrate deploy`.
- **Do NOT pass class instances or circular references in BullMQ job data** — must be JSON-serializable plain objects.
- **Do NOT use callback-based `fs` APIs** — use `fs.promises` throughout.
- **Do NOT use ES module syntax in backend** — backend uses CommonJS (`module: commonjs`).
- **Do NOT modify another user's photos or albums** — always filter by `userId` in Prisma queries.
- **Do NOT use TypeScript `strict: true` in backend** — `strictNullChecks: false` is intentional.
- **Do NOT make UI changes to only one platform** — any UI-related change must be applied to **both web and mobile** projects simultaneously, unless explicitly instructed to target only one platform.

#### Edge Cases Agents Must Handle

- **Photo hash dedup:** `Photo.hash` has `@unique` constraint — check `findFirst({ where: { userId, hash } })` before inserting
- **Thumbnail directory creation:** Worker must `fs.mkdir(thumbDir, { recursive: true })` before writing thumbnails
- **Sharp large file handling:** For 50MB+ RAW files, Sharp processes via streaming — the `.resize()` with `withoutEnlargement: true` prevents upscaling tiny images
- **AI tagging low confidence:** If all tag confidences are below threshold, no `PhotoTag` records are created — photo remains untagged with `READY` status
- **mergerfs non-transactional:** `/mnt/pool` is a FUSE pool — no atomic operations (no `rename` across drives, no `fsync` guarantees across the pool)
- **USB drive removal:** One drive failing in mergerfs pool doesn't affect others — but reads to files on the removed drive fail silently
- **Photo status chain:** `PROCESSING` → thumbnail succeeds → `READY` (or `FAILED` after 3 retries). AI tagging runs after thumbnail completes

#### Security Rules

- **All API endpoints require `@UseGuards(JwtAuthGuard)`** except auth (login/register)
- **Per-user data isolation:** Every Prisma query on photos/albums must filter by `userId` from `@CurrentUser()`
- **Personal libraries are strictly private** — invisible to other users unless explicitly shared via SharedAlbum
- **JWT secret:** Must be ≥ 32 characters — validated by `class-validator` in env config
- **`.env` files must never be committed** to git (already in `.gitignore`)
- **File upload paths:** Photo storage uses `{user}/{YYYY}/{MM}/` format — prevents cross-user path traversal
- **Storage pool permissions:** All files under `/mnt/pool/` are owned by the `chrisnie` user — enforce at OS level

#### Performance Gotchas

- **Sharp pipeline runs in BullMQ worker** — does NOT block the upload endpoint. Client immediately gets `{ id, status: "processing" }`
- **Grid thumbnails (320px WebP)** are for the timeline grid; **previews (1200px JPEG)** are for the photo viewer — these are separate files with separate purposes
- **mergerfs pool health:** Check available space with `df /mnt/pool` — individual drive failures don't show in pool stats
- **Prisma query performance:** Use `@@index` on frequently-filtered fields (`userId`, `capturedAt`, `status`, `tag`)
- **Expo MediaLibrary batch operations:** Limit concurrent access to camera roll (Android throttles at ~20 items/sec)
- **Redis memory:** BullMQ keeps jobs in memory until acknowledged — configure `removeOnComplete` / `removeOnFail` to prevent unbounded growth
- **Nginx buffer size:** For large photo uploads, ensure `client_max_body_size` is set appropriately in Nginx config

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code in the smart-files project
- Follow ALL rules exactly as documented — they capture project-specific conventions that generic AI knowledge may miss
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge during implementation

**For Humans:**

- Keep this file lean and focused on what AI agents need to know
- Update when technology stack or patterns evolve
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-06-12

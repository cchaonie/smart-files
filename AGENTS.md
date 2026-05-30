# Smart Files - Agent Guide

This document provides essential information for AI coding agents working on the Smart Files project.

## Project Overview

Smart Files is a monorepo file manager with:
- **NestJS** backend API (port 4000)
- **Vite + React** web frontend (port 3000)
- **Expo** mobile app (React Native)
- **Prisma** shared schema with PostgreSQL

Key features include per-user storage, chunked uploads with pause/resume, HTTP Range downloads, folder management, file sharing, and trash/recycle bin.

## Architecture

```
packages/
├── backend/     # NestJS API
├── web/         # Vite React SPA
├── mobile/      # Expo React Native
└── shared/      # Prisma schema + shared TypeScript types + i18n
```

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| Backend | NestJS 10+, Prisma 6+, PostgreSQL 16, JWT (passport-jwt), bcryptjs, class-validator |
| Web | React 19, Vite 6, React Router 7, Tailwind CSS 4, Axios |
| Mobile | Expo 54, React Native 0.81, React Navigation 7, AsyncStorage |
| Shared | Prisma Client, TypeScript 5.9 |

## Package Details

### Backend (`packages/backend`)

**Entry**: `src/main.ts`  
**Port**: 4000  
**Global Prefix**: `/api`

**Modules**:
- `auth/` - JWT authentication (login/register)
- `files/` - File CRUD, download, preview, trash, batch operations
- `folders/` - Folder management (hierarchical)
- `upload/` - Chunked upload sessions
- `share/` - Public file sharing with optional password
- `prisma/` - Database service
- `common/` - Guards (`JwtAuthGuard`), decorators (`@CurrentUser`)
- `static/` - Static file serving middleware

**Key Environment Variables**:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smartfiles?schema=public
JWT_SECRET=<min-32-chars>
UPLOAD_ROOT=./data/storage
MAX_FILE_SIZE_BYTES=10737418240  # 10 GiB
PORT=4000
CORS_ORIGIN=http://localhost:3000,http://localhost:19006
```

### Web (`packages/web`)

**Entry**: `src/main.tsx` → `src/App.tsx`  
**Port**: 3000 (Vite dev server)

**Structure**:
- `pages/` - Route components (LoginPage, RegisterPage, FilesPage, HomePage, SharePage)
- `components/` - Reusable UI (ShareModal, MoveFileModal, MediaPreview, etc.)
- `context/` - AuthContext for JWT state
- `api/` - API client functions

**Vite Proxy**: `/api` → `http://localhost:4000`

### Mobile (`packages/mobile`)

**Entry**: `App.tsx` (Expo)

**Structure**:
- `screens/` - LoginScreen, RegisterScreen, HomeScreen, ServerConfigScreen
- `components/` - UI components
- `context/` - AuthContext, ConfigContext (server URL configuration)
- `config/` - App configuration
- `api/` - API client with configurable base URL

**Features**: Configurable server URL for self-hosted backends

### Shared (`packages/shared`)

**Prisma Schema**: `prisma/schema.prisma`

**Models**:
- `User` - Authentication
- `File` - File metadata (soft delete via `deletedAt`)
- `Folder` - Hierarchical folder tree
- `Share` - Public share links with optional password
- `UploadSession` - Chunked upload state

**Types**: `types/index.ts` - Shared TypeScript interfaces

**i18n**: `src/i18n/` - Bilingual support (English + Chinese)
- `index.tsx` - React context provider
- `en.ts`, `zh-CN.ts` - Translation strings
- `types.ts` - Type definitions

## Development Workflow

### Prerequisites
- Node.js 20+
- Podman (for PostgreSQL)
- npm (workspaces enabled)

### Quick Start

```bash
# 1. Install dependencies (from root)
npm install

# 2. Start PostgreSQL
npm run db:start

# 3. Configure backend
cp packages/backend/.env.example packages/backend/.env
# Edit packages/backend/.env, set JWT_SECRET

# 4. Run migrations
cd packages/shared
npx prisma migrate dev

# 5. Start backend (terminal 1)
cd packages/backend
npm run start:dev

# 6. Start web (terminal 2)
cd packages/web
npm run dev

# 7. Start mobile (optional, terminal 3)
cd packages/mobile
npm start
```

### Available Scripts

**Root**:
| Script | Description |
|--------|-------------|
| `npm run db:start` | Start PostgreSQL in Podman |
| `npm run db:stop` | Stop and remove PostgreSQL container |
| `npm run dev` | Start DB + run backend + web in parallel |
| `npm run prd` | Production build + start |

**Backend**:
| Script | Description |
|--------|-------------|
| `npm run start:dev` | Development with watch mode |
| `npm run start:prod` | Production (requires `npm run build` first) |
| `npm run build` | Compile TypeScript |
| `npm run lint` | ESLint with auto-fix |
| `npm run test` | Jest tests |
| `npm run test:e2e` | E2E tests |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run migrations |

**Web**:
| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run test` | Playwright E2E tests |

**Mobile**:
| Script | Description |
|--------|-------------|
| `npm start` | Expo start |
| `npm run android` | Start on Android |
| `npm run ios` | Start on iOS |

**Shared**:
| Script | Description |
|--------|-------------|
| `npm run db:migrate` | Run migrations (uses root `.env`) |
| `npm run db:studio` | Prisma Studio GUI |
| `npm run db:push` | Push schema changes (dev only) |

## Code Style Guidelines

### TypeScript
- **Backend**: NestJS decorators, class-based, `strictNullChecks: false`
- **Web**: Functional components, hooks, `strict: true`
- **Mobile**: React Native style, functional components

### Linting
- **Backend ESLint**: `.eslintrc.cjs`
  - Extends: `eslint:recommended`, `@typescript-eslint/recommended`
  - Rules: `@typescript-eslint/no-explicit-any: off`, unused vars with `_` prefix allowed
  
- **Web ESLint**: `.eslintrc.cjs`
  - Same as backend + browser environment
  - Ignores: `dist/`, `node_modules/`

### Imports
- Use path aliases:
  - Web: `@/*` maps to `src/*`
  - Backend: No custom paths (relative imports)
- Shared package: `@smart-files/shared` (workspace reference)

### Naming Conventions
- Files: `kebab-case.ts` for modules, `PascalCase.tsx` for components
- Classes: `PascalCase` (NestJS services, controllers)
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE` for env vars, `camelCase` otherwise
- Database: Tables use PascalCase (Prisma convention)

### React Patterns
- Use functional components with hooks
- Context for global state (Auth, I18n)
- Props interface named with `Props` suffix or inline

## API Structure

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | No | Login |
| POST | `/api/auth/register` | No | Register |
| GET | `/api/files` | Yes | List files (optional `?folderId=`) |
| GET | `/api/files/search?q=` | Yes | Search files |
| GET | `/api/files/trash` | Yes | List trashed files |
| DELETE | `/api/files/:id` | Yes | Soft delete |
| DELETE | `/api/files/:id/permanent` | Yes | Permanent delete |
| POST | `/api/files/:id/restore` | Yes | Restore from trash |
| GET | `/api/files/:id/download` | Yes | Download (Range supported) |
| GET | `/api/files/:id/preview` | Yes | Preview with Range support |
| POST | `/api/upload/session` | Yes | Create upload session |
| GET | `/api/upload/session/:id` | Yes | Get session status |
| PUT | `/api/upload/session/:id/chunk?index=n` | Yes | Upload chunk (raw body) |
| POST | `/api/upload/session/:id/complete` | Yes | Complete upload |
| GET | `/share/:token` | No | Access shared file (may need password) |

**Swagger Docs**: `http://localhost:4000/api/docs`

## Database Operations

**Always run Prisma commands from `packages/shared/`**:

```bash
cd packages/shared

# Development migration (creates SQL files)
npx prisma migrate dev

# Production migration
npx prisma migrate deploy

# Schema push (prototype mode, no migration files)
npx prisma db push

# Generate client only
npx prisma generate

# Browse data
npx prisma studio
```

**Migrations Location**: `packages/shared/prisma/migrations/`

## Testing

### Backend Tests
Uses Jest. Test files co-located or in `test/` directory.

```bash
cd packages/backend
npm run test:unit      # Unit tests
npm run test:integration  # Integration tests
npm run test:e2e       # E2E tests
npm run test:cov       # Coverage
```

### Web E2E Tests
Uses Playwright. Configuration not yet created (placeholder).

### Test Data
Use `@faker-js/faker` for generating test data.

## Deployment

### Production Build

```bash
# Build unified image
podman build -t smart-files:latest .

# Deploy with compose
export JWT_SECRET="$(openssl rand -base64 32)"
export POSTGRES_PASSWORD="secure-password"
podman-compose up -d
```

### Architecture
- **Unified service**: NestJS serves API + static frontend files
- **Database**: PostgreSQL in Podman
- **Storage**: Bind mount `./data/storage`
- **Reverse proxy**: Nginx/Caddy recommended for HTTPS

### File Storage Layout
```
data/storage/
├── files/       # Completed uploads (named by storageKey)
└── tmp/         # Upload chunks (per-session subdirectories)
```

## Security Considerations

1. **JWT Secret**: Must be ≥32 characters, random in production
2. **Passwords**: Hashed with bcryptjs (backend)
3. **CORS**: Configure `CORS_ORIGIN` to specific origins in production
4. **File Access**: All file operations validate user ownership
5. **Share Links**: Optional password protection, expiration support
6. **Container Security**: Podman runs rootless by default

## Common Tasks

### Adding a New API Endpoint
1. Create/update controller in `packages/backend/src/<module>/`
2. Add service method if needed
3. Export from module
4. Update Swagger docs via decorators

### Adding a Database Field
1. Edit `packages/shared/prisma/schema.prisma`
2. Run `cd packages/shared && npx prisma migrate dev`
3. Update shared types in `packages/shared/types/index.ts`
4. Regenerate client: `npx prisma generate`

### Adding a Translatable String
1. Add to `packages/shared/src/i18n/en.ts`
2. Add to `packages/shared/src/i18n/zh-CN.ts`
3. Use via `const { t } = useI18n()` in components

### Adding a Web Page
1. Create component in `packages/web/src/pages/`
2. Add route in `packages/web/src/App.tsx`
3. Update `PrivateRoute`/`PublicRoute` as needed

### Adding a Mobile Screen
1. Create component in `packages/mobile/src/screens/`
2. Add to navigator in `packages/mobile/App.tsx`
3. Update navigation types if needed

## Troubleshooting

### Database Connection Failed
- Check PostgreSQL is running: `podman ps`
- Verify `DATABASE_URL` in `packages/backend/.env`
- For macOS: ensure Podman machine is running

### Prisma Client Not Found
```bash
cd packages/shared
npx prisma generate
```

### Port Already in Use
| Service | Default | Config Location |
|---------|---------|-----------------|
| Web | 3000 | `vite.config.ts` |
| Backend | 4000 | `.env` `PORT` |
| Database | 5432 | `podman run -p` |

### Module Resolution Issues
```bash
rm -rf node_modules packages/*/node_modules
npm install
```

## External Resources

- [NestJS Docs](https://docs.nestjs.com/)
- [Prisma Docs](https://www.prisma.io/docs/)
- [Vite Docs](https://vitejs.dev/guide/)
- [Expo Docs](https://docs.expo.dev/)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

*Last updated: Based on codebase exploration*

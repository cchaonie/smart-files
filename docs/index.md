# Smart Files Documentation Index

**Type:** Monorepo with 4 parts
**Primary Language:** TypeScript
**Architecture:** Layered API + SPA + Mobile + Async Workers
**Last Updated:** 2026-06-12

## Project Overview

Smart Files is a **family NAS photo management platform** that started as a file manager and evolved into a full photo hub. Users upload photos from Android phones via camera roll detection, which triggers async thumbnail generation (Sharp) and AI tagging (ONNX MobileNet). Photos are stored on pooled USB drives via mergerfs at `/mnt/pool`. The platform supports multi-user private libraries and album sharing with viewer/contributor roles.

## Project Structure

This project consists of **4** parts:

### 🖥️ Backend (`backend`)

- **Type:** Backend API Server
- **Location:** `packages/backend/`
- **Tech Stack:** NestJS 11 + TypeScript 5.3 + Prisma 6.19 + BullMQ 5.78 + Sharp 0.35
- **Entry Point:** `src/main.ts` (NestJS bootstrap)

### 🌐 Web (`web`)

- **Type:** Single Page Application
- **Location:** `packages/web/`
- **Tech Stack:** React 19.1 + Vite 6.2 + Tailwind CSS 4.1 + React Router 7.5
- **Entry Point:** `src/main.tsx`

### 📱 Mobile (`mobile`)

- **Type:** Mobile App (Android-first)
- **Location:** `packages/mobile/`
- **Tech Stack:** Expo 54 + React Native 0.81 + React Navigation 7.x
- **Entry Point:** `App.tsx`

### 📦 Shared (`shared`)

- **Type:** Shared Library
- **Location:** `packages/shared/`
- **Tech Stack:** Prisma 6.19 + TypeScript 5.9
- **Entry Point:** `prisma/schema.prisma`

## Cross-Part Integration

```
Mobile ──POST /api/photos──────▶ Backend ──BullMQ──▶ Worker (Sharp/ONNX)
                                  │
Web   ──GET /api/photos/timeline──▶ Backend ──Prisma──▶ PostgreSQL
                                  │
                                  └──filesystem──▶ /mnt/pool/
```

- Mobile app discovers and uploads photos via REST API
- Backend saves to mergerfs pool, enqueues BullMQ jobs
- Workers generate thumbnails (Sharp) and tags (ONNX) asynchronously
- Web and Mobile browse photos via API, served from pool storage

## Quick Reference

### Backend Quick Ref

- **Stack:** NestJS 11 / TypeScript 5.3 (commonjs) / Prisma 6.19 / BullMQ 5.78
- **Entry:** `src/main.ts` (port 4000, prefix `/api`)
- **Pattern:** Controller → Service → Prisma with BullMQ workers

### Web Quick Ref

- **Stack:** React 19.1 / Vite 6.2 / Tailwind 4.1 / Framer Motion 12.40
- **Entry:** `src/main.tsx` (port 3000)
- **Pattern:** Functional components + Context API + React Router

### Mobile Quick Ref

- **Stack:** Expo 54 / RN 0.81 / React Navigation 7.x
- **Entry:** `App.tsx` (Expo)
- **Pattern:** Tab+Stack navigation, Context API, custom hooks for photo ops

### Shared Quick Ref

- **Stack:** Prisma 6.19 / TypeScript 5.9
- **Entry:** `prisma/schema.prisma`
- **Pattern:** Prisma schema → migrations → shared types → i18n

## Generated Documentation

### Core Documentation

- [Project Overview](./project-overview.md) — Executive summary and high-level architecture
- [Source Tree Analysis](./source-tree-analysis.md) — Annotated directory structure

### Part-Specific Documentation

#### Backend

- [Development Guide](./DEV.md) — Local setup and development workflow
- [Project Context](../_bmad-output/project-context.md) — AI agent rules & patterns

#### Web

- [Architecture Overview](../_bmad-output/planning-artifacts/architecture.md) — Architecture decisions

### Integration

- [Architecture Decisions](../_bmad-output/planning-artifacts/architecture.md) — Core architectural decisions
- [Epic Breakdown](../_bmad-output/planning-artifacts/epics.md) — Story-level implementation plan

## Existing Documentation

| Document | Path | Description |
|----------|------|-------------|
| 📘 Development Guide | `docs/DEV.md` | Podman-based dev environment setup |
| 📗 Deployment Guide | `docs/DEPLOY.md` | Production deployment (legacy, Podman-based) |
| 📋 Feature Plans | `docs/plans/01-06` | Individual feature plans (file sharing, search, etc.) |
| 🎨 Design Specs | `docs/superpowers/` | Mobile web redesign specs |
| 📋 PRD | `_bmad-output/planning-artifacts/prds/.../prd.md` | Product Requirements Document |
| 🏛️ Architecture | `_bmad-output/planning-artifacts/architecture.md` | Architecture decisions |
| 📋 Epics | `_bmad-output/planning-artifacts/epics.md` | Epic breakdown (17 stories) |
| 🤖 AI Context | `_bmad-output/project-context.md` | AI agent implementation rules |

## Getting Started

### Setup (All Parts)

**Prerequisites:** Node.js 20+ (nvm), PostgreSQL 16 (Podman), Redis

```bash
# Install dependencies (from root)
npm install

# Start PostgreSQL
npm run db:start

# Configure backend
cp packages/backend/.env.example packages/backend/.env
# Edit JWT_SECRET

# Run migrations
cd packages/shared && npx prisma migrate dev
```

### Backend

```bash
cd packages/backend
npm run start:dev   # Dev with watch mode (port 4000)
npm run test        # Run tests
npm run build       # Production build
```

### Web

```bash
cd packages/web
npm run dev         # Dev server (port 3000, proxies /api to 4000)
npm run build       # Production build
```

### Mobile

```bash
cd packages/mobile
npx expo start              # Start Expo dev server
npx expo start --android    # Run on Android device
```

## For AI-Assisted Development

This documentation was generated specifically to enable AI agents to understand and extend this codebase.

### When Planning New Features:

**UI-only features (Web):**
→ Reference: `project-overview.md`, React component patterns in `packages/web/src/components/`

**Mobile features:**
→ Reference: `source-tree-analysis.md`, Expo hooks pattern in `packages/mobile/src/hooks/`

**API/Backend features:**
→ Reference: `project-overview.md`, `_bmad-output/planning-artifacts/architecture.md`, `_bmad-output/project-context.md`

**Full-stack features:**
→ Reference: All docs + `_bmad-output/planning-artifacts/epics.md` for story scope

**Infrastructure changes:**
→ Reference: `DEPLOY.md`, script logic in `scripts/deploy-api.sh`

---

_Documentation generated by BMAD Method `document-project` workflow_

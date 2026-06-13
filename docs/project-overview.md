# Smart Files - Project Overview

**Date:** 2026-06-12
**Type:** Monorepo (Backend + Web + Mobile)
**Architecture:** Modular Monorepo with Async Processing Pipeline

## Executive Summary

Smart Files is a **family NAS photo management platform** evolved from an original file manager. The project adds photo-specific features: Android camera roll detection & upload, AI auto-tagging via ONNX + MobileNet, thumbnail generation with Sharp, timeline browsing, and album sharing. The backend uses NestJS with BullMQ for async job queues, PostgreSQL via Prisma, and stores photos on pooled USB drives via mergerfs.

## Project Classification

- **Repository Type:** Monorepo (npm workspaces)
- **Project Type(s):** Backend API Server + Web SPA + Mobile App + Shared Library
- **Primary Language(s):** TypeScript (all packages)
- **Architecture Pattern:** Layered (Controller → Service → Prisma) with async worker queue (BullMQ + Redis)

## Multi-Part Structure

This project consists of **4** parts:

### 🖥️ Backend (`packages/backend/`)

- **Type:** Backend API Server
- **Location:** `packages/backend/`
- **Purpose:** REST API server — file management, photo upload, JWT auth, BullMQ job orchestration
- **Tech Stack:** NestJS 11, TypeScript 5.3, Prisma 6.19, BullMQ 5.78, Sharp 0.35, PostgreSQL 16

### 🌐 Web (`packages/web/`)

- **Type:** Single Page Application
- **Location:** `packages/web/`
- **Purpose:** Web UI — file browser, photo timeline, album management, admin panels
- **Tech Stack:** React 19.1, Vite 6.2, Tailwind CSS 4.1, React Router 7.5, Framer Motion 12.40

### 📱 Mobile (`packages/mobile/`)

- **Type:** Mobile App (Android-first)
- **Location:** `packages/mobile/`
- **Purpose:** Android camera roll photo detection & upload, photo timeline browsing
- **Tech Stack:** Expo 54, React Native 0.81, React Navigation 7.x

### 📦 Shared (`packages/shared/`)

- **Type:** Shared Library
- **Location:** `packages/shared/`
- **Purpose:** Prisma schema + migrations, shared TypeScript types, i18n (en/zh-CN)
- **Tech Stack:** Prisma 6.19, TypeScript 5.9

## How Parts Integrate

```
Mobile (Expo) ──POST /api/photos──▶ Backend (NestJS) ──BullMQ──▶ Worker (Sharp)
     │                                     │                       Worker (ONNX)
     │                                     │
     │                              Prisma ORM ──▶ PostgreSQL
     │                                     │
     │                              /mnt/pool/ ──▶ mergerfs USB pool
     │
Web (React) ──GET /api/photos─────▶ Backend (NestJS)
    (timeline)                      (serve thumbnails via proxy)
```

Mobile uploads → Backend saves to pool + enqueues async jobs → BullMQ workers generate thumbnails (Sharp) and tags (ONNX) → Web/Mobile browse via REST API.

## Technology Stack Summary

### 🖥️ Backend Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | NestJS | 11.x |
| Language | TypeScript | 5.3.3 |
| Database ORM | Prisma | 6.19.3 |
| Job Queue | BullMQ | 5.78.0 |
| Redis Client | ioredis | 5.11.1 |
| Image Processing | Sharp | 0.35.1 |
| Auth | passport-jwt + bcryptjs | 4.0 / 3.0 |
| Validation | class-validator + class-transformer | 0.14 / 0.5 |
| API Docs | @nestjs/swagger | 11.4 |

### 🌐 Web Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | React | 19.1 |
| Build Tool | Vite | 6.2 |
| Styling | Tailwind CSS | 4.1 |
| Routing | React Router | 7.5 |
| Animation | Framer Motion | 12.40 |
| HTTP | Axios | 1.8 |

### 📱 Mobile Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Platform | Expo | 54 |
| Runtime | React Native | 0.81 |
| Navigation | React Navigation | 7.x |
| Camera Roll | expo-media-library | 18.2 |
| Notifications | expo-notifications | 0.32 |
| Background Tasks | expo-task-manager | 14.0 |
| Storage | AsyncStorage | 2.2 |
| Icons | react-native-svg | 15.12 |

### 📦 Shared Stack

| Category | Technology | Version |
|----------|-----------|---------|
| ORM | Prisma | 6.19.3 |
| i18n | Custom React Context | — |

## Key Features

| Feature | FR | Epic | Status |
|---------|----|------|--------|
| 📸 Photo Detection & Upload | FR-1~FR-6 | Epic 1 | ✅ Complete |
| 🖼️ Thumbnail Generation | FR-11 | Epic 2 | 🔧 In Progress |
| 🤖 AI Auto-Tagging | FR-7~FR-9 | Epic 2 | 📋 Planned |
| 🕐 Timeline Browsing | FR-10~FR-12 | Epic 2 | 📋 Planned |
| 👨‍👩‍👧 Family Album Sharing | FR-13~FR-16 | Epic 3 | 📋 Planned |
| 🔗 Configurable Server URL | FR-17 | Epic 1 | ✅ Complete |
| 📁 File Manager (original) | — | — | ✅ Complete |

## Architecture Highlights

- **Async Processing Pipeline:** Upload → BullMQ queue → thumbnail gen (Sharp) → AI tagging (ONNX MobileNet) → status update. Non-blocking end-to-end.
- **Pooled USB Storage:** mergerfs at `/mnt/pool` — supports hot-swap USB drives, folder structure `{user}/{YYYY}/{MM}/`
- **Storage Pool:** mergerfs + ext4 USB drives at `/mnt/pool`
- **Deployment:** PM2 (fork mode) + Nginx reverse proxy + Cloudflare Tunnel
- **Multi-user Isolation:** Private personal libraries by default, album-level sharing with viewer/contributor roles
- **Deduplication:** SHA-256 hash prevents duplicate photo uploads per user

## Development Overview

### Prerequisites

- Node.js 20+ (via nvm)
- PostgreSQL 16 (via Podman container)
- Redis (via `apt install redis-server`)
- npm (npm workspaces)

### Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL
npm run db:start

# 3. Configure backend
cp packages/backend/.env.example packages/backend/.env
# Edit JWT_SECRET

# 4. Run migrations
cd packages/shared && npx prisma migrate dev

# 5. Start backend (terminal 1)
cd packages/backend && npm run start:dev

# 6. Start web (terminal 2)
cd packages/web && npm run dev
```

### Key Commands

#### Backend

- **Install:** `npm install` (from root)
- **Dev:** `npm run start:dev` (from `packages/backend/`)
- **Build:** `npm run build`
- **Test:** `npm run test`
- **Lint:** `npm run lint`

#### Web

- **Dev:** `npm run dev`
- **Build:** `npm run build`
- **Test:** E2E via Playwright

#### Mobile

- **Dev:** `npx expo start`
- **Android:** `npx expo start --android`

#### Shared

- **Migrate (dev):** `npm run db:migrate`
- **Migrate (prod):** `npm run db:deploy`
- **Studio:** `npm run db:studio`

## Repository Structure

```
smart-files/
├── packages/
│   ├── backend/          # NestJS API server (:4000)
│   │   └── src/
│   │       ├── auth/     # JWT authentication
│   │       ├── files/    # File CRUD
│   │       ├── photos/   # Photo upload & management
│   │       ├── albums/   # Album management (planned)
│   │       ├── upload/   # Chunked upload
│   │       ├── share/    # File sharing
│   │       └── common/   # Guards, decorators
│   ├── web/              # React SPA (:3000)
│   │   └── src/
│   │       ├── pages/    # Route components
│   │       ├── components/  # UI components
│   │       └── context/  # Auth, i18n
│   ├── mobile/           # Expo RN app
│   │   └── src/
│   │       ├── screens/  # Screen components
│   │       ├── components/  # UI components
│   │       └── context/  # Auth, config
│   └── shared/           # Prisma schema + types
│       ├── prisma/       # schema.prisma + migrations
│       └── types/        # Shared TS interfaces
├── scripts/              # Deploy scripts
├── _bmad-output/         # Planning artifacts (PRD, arch, epics)
└── docs/                 # Project documentation
```

## Documentation Map

For detailed information, see:

- [index.md](./index.md) — Master documentation index
- [project-context.md](../_bmad-output/project-context.md) — AI agent rules & context
- [-bmad-output/planning-artifacts/architecture.md](../_bmad-output/planning-artifacts/architecture.md) — Architecture decisions
- [DEV.md](./DEV.md) — Development environment setup
- [DEPLOY.md](./DEPLOY.md) — Deployment guide

---

_Generated using BMAD Method `document-project` workflow_

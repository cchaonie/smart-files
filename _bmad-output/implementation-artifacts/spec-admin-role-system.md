---
title: 'Admin Role & Permissions System'
type: 'feature'
created: '2026-06-13'
status: 'done'
baseline_commit: 'd3ebad6825c0b042477d5f65fe6a8bef36b8215c'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Smart Files has no role-based authorization. Every authenticated user has identical permissions. An admin account exists (admin@inkxel.fun, role=admin) but the system doesn't enforce role separation — no guarded endpoints, no admin API, no admin UI.

**Approach:** Build a complete admin permission layer: (a) propagate `role` through auth flow (JWT payload → backend guards → frontend context), (b) create a `RolesGuard` with `@Roles()` decorator, (c) implement admin API endpoints for user management (list, password reset, usage, role change), (d) add Web + Mobile admin UI sections visible only to admin users.

## Boundaries & Constraints

**Always:**
- `role` field on User model already exists (String, @default("user"))
- Auth response must include `role` in the returned user object
- JWT payload must include `role` so guards can check without DB query
- RolesGuard checks `request.user.role` from JWT payload — no extra DB hit per guard invocation
- Admin endpoints live under `/api/admin/` prefix
- All existing `JwtAuthGuard`-protected routes continue to work for non-admin users
- Least privilege: regular users must never access admin endpoints even by guessing URLs
- Both Web and Mobile must hide admin navigation from non-admin users
- TypeScript strict mode for all new files

**Ask First:**
- Web admin page layout: standalone page vs modal vs settings sub-page
- Mobile admin: add a tab in the bottom bar (for admins only) vs hide in settings screen
- Password reset: should it auto-generate a random password (returned once) or allow setting a specific one?

**Never:**
- Do not modify existing user-facing API responses to include admin-only data for non-admin users
- Do not expose user password hashes in any API response
- Do not add a public registration endpoint that allows setting role=admin
- Do not change existing auth DTO validation to break current login/register flow

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Admin lists all users | GET /api/admin/users (admin token) | Array of users with id, email, name, role, createdAt, photoCount, storageUsage | 401 if not authenticated, 403 if not admin |
| Admin resets user password | POST /api/admin/users/:id/reset-password (admin token) | `{ success: true, temporaryPassword: "..." }` | 404 if user not found, 403 if not admin, 400 if trying to reset own password via this endpoint |
| Admin changes user role | PATCH /api/admin/users/:id/role { role: "admin" \| "user" } (admin token) | Updated user object with new role | 404 if user not found, 403 if not admin, 400 if trying to demote last admin |
| Admin views user usage | GET /api/admin/users/:id/usage (admin token) | `{ fileCount, photoCount, totalSizeBytes, quotaBytes }` | 404 if user not found, 403 if not admin |
| Regular user calls admin endpoint | Any admin endpoint (regular user token) | 403 Forbidden | N/A |
| Unauthenticated calls admin endpoint | Any admin endpoint (no token) | 401 Unauthorized | N/A |
| Admin page on Web | Admin user navigates to /admin | User management table visible | Redirect to /files if non-admin |
| Admin page on Mobile | Admin user sees bottom tab | "管理" tab visible in bottom bar | Tab hidden for non-admin users |

</frozen-after-approval>

## Code Map

- `packages/backend/src/auth/auth.service.ts` — Add `role` to validateUser/login return + JWT payload
- `packages/backend/src/auth/jwt.strategy.ts` — Select `role` from DB in validate()
- `packages/backend/src/common/decorators/current-user.decorator.ts` — Add `role` to UserEntity interface
- `packages/backend/src/common/guards/roles.guard.ts` — NEW: RolesGuard (NestJS Injectable)
- `packages/backend/src/common/decorators/roles.decorator.ts` — NEW: @Roles('admin') decorator
- `packages/backend/src/admin/admin.module.ts` — NEW: AdminModule
- `packages/backend/src/admin/admin.controller.ts` — NEW: Admin API endpoints
- `packages/backend/src/admin/admin.service.ts` — NEW: Admin business logic
- `packages/backend/src/app.module.ts` — Register AdminModule + AdminController
- `packages/web/src/types/index.ts` — Add `role` to User interface
- `packages/web/src/context/AuthContext.tsx` — Update JWT parse to extract `role`
- `packages/web/src/pages/AdminPage.tsx` — NEW: Admin user management page
- `packages/web/src/App.tsx` — Add /admin route (private + admin-only)
- `packages/web/src/components/AppLayout.tsx` — NEW: Navigation link for admin (visible only to admin users)
- `packages/mobile/src/types/index.ts` — Add `role` to User interface
- `packages/mobile/src/context/AuthContext.tsx` — Update to include `role` from API response
- `packages/mobile/src/screens/AdminScreen.tsx` — NEW: Admin management screen
- `packages/mobile/src/components/BottomTabs.tsx` — Add "管理" tab (visible only to admin)
- `packages/mobile/App.tsx` — Register Admin tab
- `packages/shared/src/i18n/types.ts` — Add admin-related i18n keys
- `packages/shared/src/i18n/zh-CN.ts` — Add Chinese admin translations
- `packages/shared/src/i18n/en.ts` — Add English admin translations

## Tasks & Acceptance

**Execution:**
- [ ] `packages/backend/src/auth/auth.service.ts` — Add `role` field to validateUser() return (select role from DB), add role to login JWT payload and response user object
- [ ] `packages/backend/src/auth/jwt.strategy.ts` — Select `role` in validate() DB query (select: add role)
- [ ] `packages/backend/src/common/decorators/current-user.decorator.ts` — Add `role: string` to UserEntity interface
- [ ] `packages/backend/src/common/guards/roles.guard.ts` — NEW: Create RolesGuard that reads @Roles() metadata and checks request.user.role
- [ ] `packages/backend/src/common/decorators/roles.decorator.ts` — NEW: Create @Roles(...) decorator using SetMetadata
- [ ] `packages/backend/src/admin/` — NEW: AdminModule with controller + service (GET /api/admin/users, POST .../reset-password, PATCH .../role, GET .../usage)
- [ ] `packages/backend/src/app.module.ts` — Register AdminModule
- [ ] `packages/web/src/types/index.ts` — Add `role: string` to User interface
- [ ] `packages/web/src/context/AuthContext.tsx` — Update JWT parse + login/register to extract role
- [ ] `packages/web/src/pages/AdminPage.tsx` — NEW: User management table
- [ ] `packages/web/src/App.tsx` — Add admin route with role guard
- [ ] `packages/web/src/components/AppLayout.tsx` — Add admin nav link for admin users
- [ ] `packages/mobile/src/types/index.ts` — Add `role: string` to User interface
- [ ] `packages/mobile/src/context/AuthContext.tsx` — Update to store role from API response
- [ ] `packages/mobile/src/screens/AdminScreen.tsx` — NEW: Admin user management
- [ ] `packages/mobile/src/components/BottomTabs.tsx` — Add admin tab conditionally
- [ ] `packages/mobile/App.tsx` — Wire admin screen into navigation
- [ ] `packages/shared/src/i18n/` — Update all three files with admin keys

**Acceptance Criteria:**
- Given an admin user (role=admin), when they login, then the response includes `role: "admin"` in the user object
- Given an admin user, when they call GET /api/admin/users, they receive a list of all users with stats
- Given an admin user, when they reset another user's password, the user can login with the new temporary password
- Given an admin user, when they change another user's role to "user" or "admin", the change takes effect immediately
- Given a regular user (role=user), when they call any /api/admin/* endpoint, they receive 403 Forbidden
- Given an admin user on the Web, when they navigate to /admin, they see a user management table
- Given an admin user on the Mobile app, when they open the app, they see a "管理" tab
- Given a regular user, when they use the Web or Mobile app, they do NOT see any admin navigation

## Verification

**Commands:**
- `npm run build` (from packages/backend) — expected: tsc zero errors
- `npm run build` (from packages/web) — expected: tsc + vite zero errors
- `curl -X POST http://localhost:4000/api/auth/login -d '{"email":"admin@inkxel.fun","password":"admin123"}' -H 'Content-Type: application/json'` — expected: response includes `"role":"admin"` in user object
- `curl -s http://localhost:4000/api/admin/users -H 'Authorization: Bearer *** — expected: JSON array of users
- `curl -s http://localhost:4000/api/admin/users -H 'Authorization: Bearer <regul...n>'` — expected: 403

## Suggested Review Order

**Auth layer — role propagation**

- JWT payload now includes `role`, login response returns it, validator selects it from DB
  [`auth.service.ts:28`](../../packages/backend/src/auth/auth.service.ts#L28)
- JWT strategy selects `role` from DB and attaches to `request.user`
  [`jwt.strategy.ts:24`](../../packages/backend/src/auth/jwt.strategy.ts#L24)
- `CurrentUser` decorator interface includes `role`
  [`current-user.decorator.ts:14`](../../packages/backend/src/common/decorators/current-user.decorator.ts#L14)

**Guard layer — role enforcement**

- `@Roles()` decorator sets metadata, `RolesGuard` checks `user.role` against required roles
  [`roles.guard.ts:12`](../../packages/backend/src/common/guards/roles.guard.ts#L12)
- `@Roles('admin')` on controller class gates all admin endpoints
  [`admin.controller.ts:11`](../../packages/backend/src/admin/admin.controller.ts#L11)

**Admin API — user management endpoints**

- List all users with photo/file counts and storage usage
  [`admin.service.ts:14`](../../packages/backend/src/admin/admin.service.ts#L14)
- Password reset with self-reset protection and last-admin demotion guard
  [`admin.service.ts:57`](../../packages/backend/src/admin/admin.service.ts#L57)
- Role change with validation and last-admin demotion prevention
  [`admin.service.ts:78`](../../packages/backend/src/admin/admin.service.ts#L78)
- Module wiring and controller registration
  [`admin.controller.ts:17`](../../packages/backend/src/admin/admin.controller.ts#L17)

**Prisma schema — role field**

- `role String @default("user")` on User model
  [`schema.prisma:21`](../../packages/shared/prisma/schema.prisma#L21)

**Web frontend — admin UI**

- AdminPage: user table, reset password, promote/demote, non-admin redirect
  [`AdminPage.tsx:17`](../../packages/web/src/pages/AdminPage.tsx#L17)
- Route added under PrivateRoute
  [`App.tsx:85`](../../packages/web/src/App.tsx#L85)
- BottomTabs conditionally shows admin tab
  [`BottomTabs.tsx:15`](../../packages/web/src/components/BottomTabs.tsx#L15)
- AuthContext parses `role` from JWT payload on refresh
  [`AuthContext.tsx:34`](../../packages/web/src/context/AuthContext.tsx#L34)

**Mobile frontend — admin UI**

- AdminScreen: FlatList user management with modal actions
  [`AdminScreen.tsx:25`](../../packages/mobile/src/screens/AdminScreen.tsx#L25)
- BottomTabs conditionally adds admin tab with shield icon
  [`BottomTabs.tsx:29`](../../packages/mobile/src/components/BottomTabs.tsx#L29)
- App.tsx passes `isAdmin` and renders admin screen
  [`App.tsx:114`](../../packages/mobile/App.tsx#L114)

**i18n — admin translations**

- English and Chinese admin keys added
  [`en.ts:141`](../../packages/shared/src/i18n/en.ts#L141)
  [`zh-CN.ts:141`](../../packages/shared/src/i18n/zh-CN.ts#L141)

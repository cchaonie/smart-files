---
title: 'Change Password API + Mobile UI'
type: 'feature'
created: '2026-06-13'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** No backend endpoint for changing passwords exists — the Web `ChangePasswordModal` calls `POST /auth/change-password` but gets a 404. The Mobile app has no way to change password at all.

**Approach:** Add `POST /auth/change-password` backend endpoint with validation (current password verification, min 8 chars, old≠new), wire it in the mobile auth API, and add a change password modal to the Mobile `SettingsScreen`.

## Suggested Review Order

**Backend — new change-password endpoint**

- DTO with `currentPassword` (string) and `newPassword` (min 8 chars)
  [`change-password.dto.ts:1`](../../packages/backend/src/auth/dto/change-password.dto.ts#L1)
- Export added to DTO barrel
  [`index.ts:3`](../../packages/backend/src/auth/dto/index.ts#L3)
- Service method: verify current pw, reject identical passwords, hash + update
  [`auth.service.ts:65`](../../packages/backend/src/auth/auth.service.ts#L65)
- Controller route at `POST /auth/change-password`, JWT-guarded, delegates to service
  [`auth.controller.ts:35`](../../packages/backend/src/auth/auth.controller.ts#L35)

**Mobile — change password in Settings**

- `changePassword` method added to mobile auth API client
  [`auth.ts:47`](../../packages/mobile/src/api/auth.ts#L47)
- SettingsScreen: modal with current/new/confirm password fields, error display, i18n-aware strings
  [`SettingsScreen.tsx:21`](../../packages/mobile/src/screens/SettingsScreen.tsx#L21)

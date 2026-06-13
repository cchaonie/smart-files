---
title: 'Remember Password on Login'
type: 'feature'
created: '2026-06-13'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** Users must type their email and password each time they log in. There is no "Remember Me" option on either the Web or Mobile login page.

**Approach:** Add a "记住密码" checkbox/switch to both Web LoginPage and Mobile LoginScreen. When enabled, save credentials to localStorage (Web) or AsyncStorage (Mobile). On next visit, pre-fill the saved credentials. Clear saved data when the checkbox is unchecked.

## Suggested Review Order

**i18n — new key**

- `rememberPassword` added to types, zh-CN, en
  [`types.ts:108`](../../packages/shared/src/i18n/types.ts#L108)
  [`zh-CN.ts:154`](../../packages/shared/src/i18n/zh-CN.ts#L154)
  [`en.ts:154`](../../packages/shared/src/i18n/en.ts#L154)

**Web — remember password checkbox**

- State initialized from localStorage, saved on successful login
  [`LoginPage.tsx:27`](../../packages/web/src/pages/LoginPage.tsx#L27)
- Checkbox UI between password field and error message
  [`LoginPage.tsx:182`](../../packages/web/src/pages/LoginPage.tsx#L182)

**Mobile — remember password switch**

- AsyncStorage load on mount, save/clear on login
  [`LoginScreen.tsx:36`](../../packages/mobile/src/screens/LoginScreen.tsx#L36)
- Switch UI row between password and submit button
  [`LoginScreen.tsx:173`](../../packages/mobile/src/screens/LoginScreen.tsx#L173)

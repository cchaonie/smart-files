# Deferred Work

## Goal 2: 记住密码功能
- **Scope**: Web LoginPage + Mobile LoginScreen 增加"记住密码"复选框
- **Details**: 使用 localStorage (Web) / AsyncStorage (Mobile) 保存 email + password，登录时自动填充
- **Deferred at**: 2026-06-13, during admin role system quick-dev

## Deferred from: code review of Epic 2 (2026-06-19)
- Saga `transition()` logs warnings for intended multi-status calls — code smell, validation is still enforced by `updateMany` optimistic concurrency
- Thumbnail service bypasses saga transition (direct `status: 'TAGGING'` update) — planned refactoring
- Schema migration not committed — `prisma migrate dev` needs to be run, changes exist in schema.prisma

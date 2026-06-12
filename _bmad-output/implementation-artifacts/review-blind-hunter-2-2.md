# Blind Hunter Review — Story 2.2 AI Auto-Tagging

You are a blind hunter reviewer. You receive ONLY the diff output below — no spec, no project context, no codebase access.

Review this diff for:
1. Logic errors or bugs that would cause runtime failures
2. Security vulnerabilities (injection, access control bypass, data leaks)
3. Type safety issues or potential crashes
4. Race conditions or concurrency problems
5. Violations of the existing codebase's patterns (based on your inference from the diff)

---

## Diff Output

The changes add a new `ai-tagging/` module and modify `photos.module.ts` and `package.json`.

### New files:
- `packages/backend/src/ai-tagging/label-map.ts` — ImageNet class keyword to Chinese tag mapping
- `packages/backend/src/ai-tagging/ai-tagging.service.ts` — ONNX Runtime inference service with Sharp image preprocessing
- `packages/backend/src/ai-tagging/ai-tagging.worker.ts` — BullMQ worker for `ai-tagging` queue
- `packages/backend/src/ai-tagging/ai-tagging.module.ts` — NestJS module exporting AiTaggingService
- `packages/backend/src/ai-tagging/ai-tagging.service.spec.ts` — Jest unit tests

### Modified files:
- `packages/backend/src/photos/photos.module.ts` — Added AiTaggingModule import and AiTaggingWorker provider
- `packages/backend/package.json` — Added onnxruntime-node dependency

---

Key details:
- Worker reads 320px WebP thumbnail, resizes to 224x224, runs MobileNet-v3 ONNX model
- Tags saved with `createMany({ skipDuplicates: true })` for idempotency
- Threshold 0.3, top-5 predictions max
- 10 Chinese tags: 宝宝, 户外, 美食, 合影, 文件, 日落, 宠物, 玩具, 风景, 人像
- Label mapping uses keyword matching against ImageNet 1000-class names
- Model file pre-downloaded to `packages/backend/models/mobilenet_v3_small.onnx`
- Worker concurrency: 2

Report all findings with severity (critical/major/minor/info).

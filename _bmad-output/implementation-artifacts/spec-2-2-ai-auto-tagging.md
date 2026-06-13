---
title: 'Story 2.2: AI Auto-Tagging — ONNX Runtime + MobileNet'
type: 'feature'
created: '2026-06-12'
status: 'done'
baseline_commit: '565123a'
context:
  - '_bmad-output/project-context.md'
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Photos are uploaded and thumbnailed, but the `ai-tagging` BullMQ job has no worker. Users cannot search or filter photos by content since no tags are generated.

**Approach:** Create an `AiTaggingModule` with a MobileNet classifier (ONNX Runtime Node.js) and a BullMQ worker that reads the 320px WebP thumbnail, classifies it against a curated taxonomy, and persists Chinese tags to `PhotoTag` with idempotent upserts.

## Boundaries & Constraints

**Always:**
- Worker consumes the existing 320px WebP thumbnail (`{id}_grid.webp`) from `/.thumbnails/` — never reads the original full-res file
- Tags stored in Chinese (e.g., "宝宝", "户外") via a hardcoded ImageNet EN→ZH mapping for the defined taxonomy: baby(宝宝), outdoor(户外), food(美食), group(合影), document(文件), sunset(日落), pet(宠物), toy(玩具), scenery(风景), portrait(人像)
- Only tags with confidence ≥ 0.3 are saved; top-5 predictions max per photo
- `PhotoTag.@unique([photoId, tag])` prevents duplicates on re-processing — use `createMany({ skipDuplicates: true })`
- ONNX model file stored at `packages/backend/models/mobilenetv3-small.onnx` (~11MB), auto-downloaded via install script
- Worker lives in a new `ai-tagging/` module alongside `photos/` (not inside it), registered as a provider in `photos.module.ts`
- Worker uses the same `WorkerHost` pattern as `PhotoThumbnailWorker`
- Backend uses `strictNullChecks: false` — no type assertions needed for null fields
- On failure after 3 retries — Photo status set to `FAILED` (already handled by thumbnail worker; for tagging-only failures, the Photo stays `READY` but tags may be incomplete; log the error)

**Ask First:**
- (None — model pre-downloaded on this machine since it is the production server)

**Never:**
- No new Prisma migrations or schema changes (PhotoTag model already exists)
- No cloud APIs for classification
- No Python sidecar — entire stack stays TypeScript/Node.js
- No changes to the upload pipeline or existing worker enqueue logic
- No changes to the retry endpoint (existing retry in photos.service.ts re-enqueues thumbnail only — tagging runs again when thumbnail worker chains to it)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | Photo READY with valid thumbnail, one clear subject (e.g., dog) | Top-1 tag "宠物" saved with confidence 0.85 | N/A |
| No recognizable objects | Photo of blank wall, all confidence < 0.3 | No PhotoTag records created | N/A — just returns with empty result |
| Multiple objects | Photo with food on a table outdoors | Top-2 tags: "美食"(0.75), "户外"(0.55) saved | N/A |
| Thumbnail not found | Photo record exists but grid.webp deleted | Worker throws, BullMQ retries 3x, then job fails | Log error, no Photo status change |
| ONNX model not found | `models/mobilenetv3-small.onnx` missing | Worker init fails on first process attempt | Error logged; photo stays READY with no tags |
| Re-process (retry chain) | Tagging runs again on same photo | `createMany({ skipDuplicates: true })` — no duplicate records | N/A — idempotent by design |
| Low confidence all around | Noisy/abstract image, max confidence 0.15 | No tags saved | N/A |

</frozen-after-approval>

## Code Map

- `packages/backend/src/ai-tagging/ai-tagging.module.ts` — NEW: Module exporting AiTaggingService
- `packages/backend/src/ai-tagging/ai-tagging.service.ts` — NEW: ONNX inference + label mapping
- `packages/backend/src/ai-tagging/ai-tagging.worker.ts` — NEW: BullMQ worker for `ai-tagging` queue
- `packages/backend/src/ai-tagging/label-map.ts` — NEW: ImageNet class ID → Chinese label mapping
- `packages/backend/src/ai-tagging/ai-tagging.service.spec.ts` — NEW: Unit tests for edge cases
- `packages/backend/src/photos/photos.module.ts` — Import AiTaggingModule, register AiTaggingWorker
- `packages/backend/package.json` — Add `onnxruntime-node` dependency + `download-model` script

## Tasks & Acceptance

**Execution:**
- [x] `packages/backend/src/ai-tagging/label-map.ts` — NEW: ~50–100 ImageNet class IDs mapped to 10 Chinese tags; includes a `labelMap: Map<number, string>` and `imageNetLabels: string[]`
- [x] `packages/backend/src/ai-tagging/ai-tagging.service.ts` — NEW: ONNX inference + label mapping; loads ONNX session lazily; preprocesses image (decode WebP → 224x224 → RGB float tensor); sorts top-5 above 0.3 threshold
- [x] `packages/backend/src/ai-tagging/ai-tagging.worker.ts` — NEW: BullMQ worker for `ai-tagging` queue; reads photo → reads thumbnail path → calls AiTaggingService.classify() → bulk creates PhotoTag records
- [x] `packages/backend/src/ai-tagging/ai-tagging.module.ts` — NEW: NestJS module declaring AiTaggingService as a provider (exported for PhotosModule)
- [x] `packages/backend/src/ai-tagging/ai-tagging.service.spec.ts` — NEW: Unit tests for edge cases
- [x] `packages/backend/src/photos/photos.module.ts` — Import AiTaggingModule, add AiTaggingWorker to providers
- [x] `packages/backend/package.json` — Add `onnxruntime-node` dependency

**Acceptance Criteria:**
- Given a photo with READY status and valid thumbnail, when the `ai-tagging` worker runs, then 0–5 PhotoTag records are created in Chinese with confidence scores
- Given a photo with no recognizable content, when all predictions are below 0.3, then no PhotoTag records are created
- Given a photo re-processed by the `ai-tagging` job, when tags already exist, then no duplicate PhotoTag records are created (idempotent)
- Given TypeScript compilation, when running `tsc --noEmit` from packages/backend/, then zero errors
- Given backend tests, when running `npm run test`, then all tests pass

## Design Notes

**AiTaggingService.classify(thumbnailPath) — preprocessing flow:**
1. `sharp(thumbnailPath).resize(224, 224).raw().toBuffer()` → RGB pixel data
- Convert uint8 raw pixels to normalized float32 tensor: `(pixel / 255.0 - mean) / std` where mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225] (ImageNet stats)
- Create ONNX Tensor with shape `[1, 3, 224, 224]` — NCHW format (MobileNet expects channel-first)
- Run: `session.run({ 'input': inputTensor })`
- Softmax the output logits, find top-5 indices above threshold 0.3
- Map indices through label-map → return `{ tag, confidence }[]`

**Model file:**
- Pre-downloaded to `packages/backend/models/mobilenetv3-small.onnx` (~11MB)
- ONNX Model Zoo source: MobileNet-v3 Small (100% width, Opset 11)
- Session is loaded lazily on first `classify()` call and cached in memory

## Verification

**Commands:**
- `cd /home/chrisnie/Code/smart-files/packages/backend && npx tsc --noEmit` — expected: zero errors
- `cd /home/chrisnie/Code/smart-files/packages/backend && npm run test` — expected: all tests pass (including new ai-tagging service spec)

## Suggested Review Order

**ONNX inference core**

- Entry point — classify pipeline: decode, normalize, inference, softmax, label mapping
  [`ai-tagging.service.ts:95`](../../packages/backend/src/ai-tagging/ai-tagging.service.ts#L95)

- Input normalization — ImageNet mean/std, NCHW float32 tensor construction
  [`ai-tagging.service.ts:59`](../../packages/backend/src/ai-tagging/ai-tagging.service.ts#L59)

- Label keyword mapping — 10 Chinese tags with comprehensive ImageNet class coverage
  [`label-map.ts:8`](../../packages/backend/src/ai-tagging/label-map.ts#L8)

**BullMQ worker wiring**

- Worker entry — reads photo + thumbnail, runs classify, saves tags via skipDuplicates
  [`ai-tagging.worker.ts:27`](../../packages/backend/src/ai-tagging/ai-tagging.worker.ts#L27)

- Failure handler — logging only, photo stays READY (tagging is non-blocking)
  [`ai-tagging.worker.ts:74`](../../packages/backend/src/ai-tagging/ai-tagging.worker.ts#L74)

- Module registration — AiTaggingModule + AiTaggingWorker in PhotosModule
  [`photos.module.ts:16`](../../packages/backend/src/photos/photos.module.ts#L16)

**Tests**

- Edge-case coverage — saveTags idempotency, normalizeImage shape, softmax sum, matchTag lookups
  [`ai-tagging.service.spec.ts:61`](../../packages/backend/src/ai-tagging/ai-tagging.service.spec.ts#L61)

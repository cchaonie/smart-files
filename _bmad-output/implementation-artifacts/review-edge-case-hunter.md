# Edge Case Hunter Review — Story 2.1: Photo Thumbnail Pipeline

Use the `bmad-review-edge-case-hunter` skill approach: walk every branching path and boundary condition. You have the diff below and full read access to the project at `/home/chrisnie/Code/smart-files`.

## Diff Summary

See `review-blind-hunter.md` for the diff. Additionally, review these specific edge case concerns:

### ThumbnailService.generate()
1. What happens when `sharp(sourcePath).metadata()` returns `{ width: undefined, height: undefined }`?
2. What if `storageKey` contains path traversal characters (e.g., `../../etc/passwd`)?
3. What if the source file is locked by another process?
4. What if `fs.mkdir(thumbDir, { recursive: true })` fails (disk full, permission denied)?
5. What if `sharp` is not installed (require fails)? — Currently uses bare `require('sharp')` with no try/catch
6. What if the thumbnail job completes but `prisma.photo.update` fails (database connection lost)?
7. What if `aiTaggingQueue.add()` fails after DB update? — Photo is already READY, ai-tagging never fires
8. What if `photoId` is an empty string? — Prisma `findUnique({ where: { id: '' } })` returns null, throws "Photo not found"
9. What if the same photo is retried while another job is still running? — Race condition: both could process simultaneously
10. What if `sharp.resize()` runs out of memory on a 100MB+ photo?

### PhotoThumbnailWorker
11. What if `@OnWorkerEvent('failed')` fires but `job.data.photoId` is missing?
12. What if BullMQ retries the job but the first attempt already set status to FAILED? — Worker.cleanup tries to cleanup already-cleaned files
13. Concurrency=2: two jobs for the same photoId run in parallel — race condition on status update

### retry endpoint
14. What if `retry` is called on a photo that another user owns? — Currently no userId check!
15. What if `retry` is called with an invalid UUID format? — Prisma handles gracefully
16. What if photo is in PROCESSING status but processing is stuck due to a dead worker? — No timeout mechanism

### General
17. Logging: error messages include `photoId` but not `userId` — hard to attribute failures
18. No health check or monitoring for worker queue depth

Read the relevant source files to verify your concerns. Report findings as categorized markdown.
---
title: 'Story 2.4: Tag Search & Filter API + Web UI'
type: 'feature'
created: '2026-06-13'
status: 'done'
baseline_commit: '3250b0f'
context:
  - '_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Photos are auto-tagged by AI, but users cannot yet search or filter by tag. They must scroll through the entire timeline or remember when a photo was taken, which is impractical for large collections.

**Approach:** Add a `tag` query filter to the existing `GET /api/photos` endpoint; a new `GET /api/photos/tags` endpoint returning all tags with photo counts; a tag search autocomplete endpoint; and a web UI with a search bar + tag browser panel on the existing PhotosPage.

## Boundaries & Constraints

**Always:**
- GET `/api/photos` gains optional `@Query('tag') tag?: string` — filters results to photos whose tags include the given tag. Filtered results still use cursor pagination with the same sort order and response shape.
- GET `/api/photos/tags` — returns `{ tags: { tag: string, count: number }[] }` sorted by count DESC, all tags across the current user's photos. Efficient via `prisma.photoTag.groupBy()` or aggregation.
- Tag autocomplete: GET `/api/photos/tags?q=宝宝` — returns matching tags with counts (`{ tag, count }`), matched via `tag: { contains: q }` (case-insensitive in PostgreSQL). Limit 10 results.
- Web search bar at the top of PhotosPage: text input that shows autocomplete dropdown as user types (debounced 200ms). Dropdown shows matching tags with counts (e.g., "宝宝 (42)").
- Selecting a tag from autocomplete OR tag browser triggers filter: `loadMore(true)` with `tag` param, resetting the timeline to show only matching photos.
- Tag browser: floating button (tag icon) next to the date picker button → opens a slide-up overlay listing ALL tags with counts, sorted by count DESC. Tapping a tag applies the filter.
- Active filter displayed as a pill/badge below the search bar (e.g., "筛选: 宝宝 ✕"). Tapping ✕ clears filter and reloads the full timeline.
- Empty filtered state: "没有匹配的照片" with option to clear filter.
- All changes are backward-compatible — existing `GET /api/photos` without `tag` param behaves identically to before.
- Backend uses `strictNullChecks: false`.
- No new Prisma models or migrations.
- All i18n keys added to both zh-CN.ts and en.ts + I18nStrings type.

**Ask First:**
- (None — all patterns match existing code.)

**Never:**
- No changes to upload, thumbnail, or AI tagging pipelines.
- No changes to PhotoDetailPage (it already shows tags).
- No changes to BottomTabs navigation.
- No changes to Expo mobile app.
- No server-side rendering.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Filter by existing tag | GET /api/photos?tag=宝宝 | Photos with "宝宝" tag returned, paginated normally | N/A |
| Filter by non-existent tag | GET /api/photos?tag=nonexistent | Empty photos array, nextCursor null, total 0 | N/A |
| Tag browser | GET /api/photos/tags | All user's tags with counts, sorted DESC | N/A |
| Empty tag collection | User has untagged photos only | Empty tags array | N/A |
| Autocomplete partial match | GET /api/photos/tags?q=宝 | Tags matching "宝": ["宝宝 (42)", "珠宝 (3)"] — at most 10 | N/A |
| Autocomplete no match | GET /api/photos/tags?q=zzz | Empty tags array | N/A |
| Filter + cursor pagination | GET /api/photos?tag=宝宝&cursor=... | Cursor pagination works within filtered set | N/A |
| Search bar typing | User types "宝" | Debounced autocomplete shows dropdown after 200ms | N/A |
| Select tag from autocomplete | User clicks "宝宝 (42)" | Timeline resets, shows only "宝宝" photos | On network error, show error + retry |
| Clear active filter | User clicks ✕ on filter pill | Timeline resets, shows all photos | N/A |
| No results for filter | Filter returns 0 photos | "没有匹配的照片" with "清除筛选" button | N/A |

</frozen-after-approval>

## Code Map

- `packages/backend/src/photos/photos.controller.ts` — ADD `@Query('tag')` to `list()` handler; ADD `GET /photos/tags` endpoint
- `packages/backend/src/photos/photos.service.ts` — ADD `tag` param to `list()` method; ADD `getTags(userId, q?)` method for tag browser + autocomplete
- `packages/web/src/types/index.ts` — ADD `TagWithCount` interface
- `packages/web/src/api/photos.ts` — ADD `tag` param to `list()`; ADD `getTags(q?)` method; ADD `searchTags(q?)` method (aliased)
- `packages/web/src/pages/PhotosPage.tsx` — ADD search bar with autocomplete dropdown; ADD tag browser overlay; ADD active filter state + pill display; MODIFY `loadMore` to pass `tag` param; ADD empty filtered state
- `packages/web/src/components/icons.tsx` — ADD `TagIcon` SVG component
- `packages/shared/src/i18n/types.ts` — ADD tag search/filter i18n keys
- `packages/shared/src/i18n/zh-CN.ts` — ADD Chinese translations
- `packages/shared/src/i18n/en.ts` — ADD English translations

## Tasks & Acceptance

**Execution:**
- [x] `packages/backend/src/photos/photos.controller.ts` — ADD `@Query('tag') tag?: string` to `list()`; ADD `GET /photos/tags` with optional `@Query('q') q?: string`
- [x] `packages/backend/src/photos/photos.service.ts` — ADD `tag` filter to `list()` via `tags: { some: { tag } }`; ADD `getTags(userId, q?)` using `prisma.photoTag.groupBy()` or `findMany()` + aggregation
- [x] `packages/web/src/types/index.ts` — ADD `TagWithCount { tag: string; count: number }` interface
- [x] `packages/web/src/api/photos.ts` — ADD `tag` param to `list()`; ADD `getTags(q?)` method
- [x] `packages/web/src/components/icons.tsx` — ADD `TagIcon` SVG (price tag shape)
- [x] `packages/web/src/pages/PhotosPage.tsx` — ADD search bar + autocomplete dropdown; ADD tag browser overlay with counts; ADD active filter state (tag string); MODIFY `loadMore` to pass `tag` to API; ADD filter pill display; ADD empty filtered state
- [x] `packages/shared/src/i18n/types.ts` — ADD tag search keys
- [x] `packages/shared/src/i18n/zh-CN.ts` — ADD Chinese translations
- [x] `packages/shared/src/i18n/en.ts` — ADD English translations

**Acceptance Criteria:**
- Given a photo with tag "宝宝", when GET /api/photos?tag=宝宝, then only photos with that tag are returned
- Given a user with tags, when GET /api/photos/tags, then all tags with counts sorted by count descending are returned
- Given the user types in the search bar, when debounce fires, then matching tags appear in the autocomplete dropdown with counts
- Given a filter is active, when the user selects a tag from autocomplete or tag browser, then the timeline resets showing only filtered photos
- Given a filter is active, when the user clicks ✕ on the filter pill, then the filter clears and all photos are shown
- Given no photos match the filter, when results are empty, then "没有匹配的照片" is shown with a clear button
- Given TypeScript compilation, when running tsc --noEmit from both packages, then zero errors

## Spec Change Log


## Design Notes

**Tag filter implementation (backend):**
The existing `list()` method builds a `where: any = { userId }` clause. Adding tag filtering is:
```typescript
if (tag) {
  where.tags = { some: { tag } };
}
```
This leverages the `@@index([tag])` on PhotoTag and the existing `include: { tags: true }`.

**Tag list endpoint (backend):**
```typescript
async getTags(userId: string, q?: string) {
  const where: any = { photo: { userId } };
  if (q) where.tag = { contains: q, mode: 'insensitive' }; // PostgreSQL case-insensitive
  const tags = await this.prisma.photoTag.groupBy({
    by: ['tag'],
    where,
    _count: { tag: true },
    orderBy: { _count: { tag: 'desc' } },
    take: q ? 10 : undefined, // limit autocomplete results
  });
  return tags.map(t => ({ tag: t.tag, count: t._count.tag }));
}
```

**PhotosPage modifications:**
- New state: `activeTag: string | null`, `tagSuggestions: TagWithCount[]`, `tagBrowserOpen: boolean`
- Search bar renders below the page header, before the timeline grid
- Autocomplete dropdown positioned absolutely below the search bar
- Tag browser overlay reuses the same slide-up pattern as DatePickerOverlay
- Filter pill appears when `activeTag` is non-null, between search bar and timeline
- `loadMore` passes `tag` to `photosApi.list(tag, cursor, limit)` when activeTag is set

## Verification

**Commands:**
- `cd /home/chrisnie/Code/smart-files/packages/backend && npx tsc --noEmit` — expected: zero errors
- `cd /home/chrisnie/Code/smart-files/packages/web && npx tsc --noEmit` — expected: zero errors

**Manual checks:**
- Start backend, GET `/api/photos/tags` — verify tag list with counts
- GET `/api/photos?tag=宝宝` — verify filtered results
- Start web, navigate to `/photos` — verify search bar renders, autocomplete works, tag browser opens

## Suggested Review Order

**Tag filter API**

- Tag filter added to existing list() — `tags: { some: { tag } }` via optional param
  [`photos.service.ts:157`](../../../packages/backend/src/photos/photos.service.ts#L157)

- Tag browser + autocomplete endpoint — groupBy with tag index
  [`photos.service.ts:221`](../../../packages/backend/src/photos/photos.service.ts#L221)

- Route wiring — GET /photos/tags before /photos/:id to avoid route capture
  [`photos.controller.ts:57`](../../../packages/backend/src/photos/photos.controller.ts#L57)

**Timeline filter UI**

- Tag search bar + debounced autocomplete + click-outside + filter handlers
  [`PhotosPage.tsx:195`](../../../packages/web/src/pages/PhotosPage.tsx#L195)

- Tag browser overlay + floating action buttons (tag + calendar)
  [`PhotosPage.tsx:128`](../../../packages/web/src/pages/PhotosPage.tsx#L128)

- Active filter pill + empty filtered state
  [`PhotosPage.tsx:373`](../../../packages/web/src/pages/PhotosPage.tsx#L373)

**Supporting changes**

- API client: list() accepts tag param; getTags() for browser/autocomplete
  [`photos.ts:4`](../../../packages/web/src/api/photos.ts#L4)

- TagWithCount type + TagIcon SVG + i18n keys (EN/ZH)
  [`index.ts:100`](../../../packages/web/src/types/index.ts#L100)

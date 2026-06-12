---
title: Smart Files → Home NAS (Photo Hub)
created: 2026-06-11
updated: 2026-06-11
status: final
---

# PRD: Smart Files → Home NAS (Photo Hub)
*Working title — confirm.*

## 0. Document Purpose

This PRD is for Chris, the builder and primary user of this system. It defines the scope, features, and design of transforming the existing Smart Files application into a home NAS photo hub for family photo backup and management. It is structured with Glossary-anchored vocabulary, feature groups with nested functional requirements, and assumptions tagged inline. This PRD feeds downstream into `bmad-create-architecture` for the system design and `bmad-create-epics-and-stories` for implementation planning.

## 1. Vision

Chris takes photos of his baby throughout the day. His phone fills up. He opens the app — new photos are detected, he taps Upload, and they transfer to the family NAS in the background. Once complete, he clears local copies and gets his phone storage back. Later, when he wants to find "that cute baby photo from last month," a simple tag search brings it up in seconds. His spouse has her own account too — she uploads from her phone, creates a shared album "Family BBQ," and both of their photos blend into one shared family timeline. The system lives at home on pooled USB drives, accessible from anywhere via Cloudflare Tunnel. AI tags every photo automatically so finding anything is fast, without manual organization.

## 2. Target User

### 2.1 Jobs To Be Done

- **Free up phone storage** — I can offload photos to the NAS and confidently delete local copies.
- **Find any family photo fast** — I can locate the photo I'm thinking of by searching tags, even with thousands of photos.
- **Share family moments** — My family can see photos from family events in a unified shared timeline.

### 2.2 Non-Users (v1)

- Extended family members who don't have an account (external sharing via link deferred to post-MVP).
- Users of other platforms (iOS, desktop) — v1 focuses on Android.

### 2.3 Key User Journeys

#### UJ-1: Chris clears phone storage

- **Persona + context:** Chris, dad of a baby, Android user. Phone storage filling up with baby photos.
- **Entry state:** App installed, logged in, NAS reachable via Cloudflare Tunnel.
- **Path:**
  1. Takes photos throughout the day.
  2. Opens the app (or receives a notification).
  3. Sees a prompt: "5 new photos found. Upload to NAS?"
  4. Taps **Upload**.
  5. Photos transfer in background.
  6. Upload complete notification: "5 photos uploaded safely."
  7. Prompt: "Delete local copies to free space?"
  8. Taps **Yes** — phone storage is freed.
- **Climax:** Phone shows "1.2 GB freed." Photos are already viewable and tagged in the timeline.
- **Resolution:** Chris has more phone space. Photos are organized with AI tags applied.

#### UJ-2: Finding baby's photos fast

- **Persona + context:** Chris wants to find a cute photo of the baby from last month to look back on.
- **Entry state:** On the home screen, thousands of photos in the timeline.
- **Path:**
  1. Taps the search bar.
  2. Types "baby" — AI tags auto-suggest.
  3. Selects the **Baby** tag.
  4. All baby photos shown, grouped by month.
  5. Scrolls to last month via quick-scroll date picker.
  6. Finds the photo in seconds.
- **Climax:** The perfect photo found in seconds, not minutes.
- **Resolution:** Satisfied, Chris closes the app.

#### UJ-3: Family multi-user flow

- **Persona + context:** Chris's spouse also takes photos of the baby and family events on her own Android phone.
- **Entry state:** She has her own account with her own private personal library.
- **Path:**
  1. She takes photos at a family gathering.
  2. Opens the app → prompted to upload → confirms.
  3. Photos upload to her personal library.
  4. She creates a new album "Family BBQ" and shares it with Chris.
  5. Chris opens his app — "Family BBQ" appears in the family timeline.
  6. Both of their photos from the event appear together.
- **Climax:** A single timeline showing photos from both family members — no duplicates, no manual re-sharing.
- **Resolution:** The baby's full story is captured from both parents' perspectives.

## 3. Glossary

| Term | Definition |
|------|-----------|
| **NAS** | The home server running the application |
| **Family Photo Hub** | The central photo library all family members contribute to and access |
| **Sync** | One-way upload from mobile device → NAS |
| **Upload Prompt** | A notification asking the user to confirm uploading newly detected photos |
| **Local Cleanup** | Deleting original photos from the phone after successful upload to NAS |
| **AI Tag** | An auto-generated label applied to a photo based on visual content (e.g., "baby", "food", "sunset") |
| **Personal Library** | A user's private photo space, invisible to others by default |
| **Shared Album** | An album whose owner can invite other family members to view or contribute |
| **Remote Access** | Ability to use the app outside the home network via Cloudflare Tunnel |

## 4. Features

### 4.1 Mobile Photo Upload
*Realizes UJ-1. The Android app detects new photos, prompts the user, uploads in the background, and offers local cleanup.*

**FR-1: New Photo Detection**
The Android app scans for untracked photos in the device gallery on launch. Periodic background checks are also supported.

**Consequences (testable):**
- App detects newly added photos since last successful sync.
- App does not re-upload previously synced photos.
- App handles 1–1000 new photos in a single detection pass.

**FR-2: Upload Prompt**
When new photos are detected, a non-intrusive in-app prompt shows: "N new photos found. Upload to NAS?" with **Upload** / **Later** options.

**Consequences (testable):**
- Prompt appears within 2 seconds of app launch if new photos exist.
- "Later" dismisses the prompt and does not re-prompt during this session.
- Prompt is not shown if zero new photos.

**FR-3: Background Upload**
Once confirmed, photos upload to the NAS in the background without blocking the user from browsing existing photos.

**Consequences (testable):**
- Upload continues when user navigates to other screens in the app.
- Upload survives app being sent to background (Android foreground service).
- Network interruption triggers automatic retry with exponential backoff; no progress lost.

**FR-4: Upload Progress & Completion**
Upload progress is visible in-app. On completion, a notification offers to **Delete local copies**.

**Consequences (testable):**
- Per-photo and total progress shown (e.g., "3 of 5 uploaded").
- Completion notification appears as a system notification and in-app toast.
- "Delete local copies" action is offered on completion.

**FR-5: Local Cleanup**
User can delete originals from the device after successful upload. Only photos confirmed persisted on the NAS are eligible.

**Consequences (testable):**
- Only photos confirmed stored on the NAS are offered for deletion.
- Deleted photos are sent to the device's trash/recycle bin where supported.
- If deletion fails for any photo, the user is informed which photos could not be deleted.

**FR-6: Upload Resilience**
Failed or interrupted uploads automatically retry. Photos are tracked by hash to prevent duplicates.

**Consequences (testable):**
- Retry with exponential backoff on network failure.
- Photos already uploaded (by file hash) are skipped on re-sync.
- Upload state is persisted locally so restarting the app resumes tracking.

### 4.2 AI Classification
*Realizes UJ-2. New photos automatically receive AI tags based on visual content.*

**FR-7: Auto-Tagging**
On upload, the server runs image classification and assigns relevant tags. The minimum tag taxonomy includes: "baby", "outdoor", "food", "group", "document", "sunset", "pet", "toy", "selfie", "screenshot".

**Consequences (testable):**
- Tagging runs as an async job and completes within 30 seconds per photo on the target NAS hardware.
- At least one tag from the taxonomy is assigned per photo; a photo may receive multiple tags.
- Tags persist in the database and are returned with photo metadata on API responses.
- Tagging accuracy is ≥ 80% for the defined taxonomy on a representative family photo sample (to be measured in dev).
- Rerunning tagging on an already-tagged photo appends new tags without duplicating existing ones.

**FR-8: Tag Search**
Users can search photos by tag name, with auto-suggest as they type.

**Consequences (testable):**
- Typing partial tag name shows matching suggestions in a dropdown.
- Selecting a tag filters the timeline to show only photos with that tag.
- Results load within 1 second for up to 10,000 tagged photos.

**FR-9: Tag Filtering**
A tag browser/filter UI shows available tags with photo counts for one-tap filtering.

**Consequences (testable):**
- Tag list shows "tag (count)" format, sorted by count descending.
- Tapping a tag applies the filter immediately.
- Active filters can be cleared with a single "Clear" action.

### 4.3 Timeline & Browsing
*Realizes UJ-2. The main home screen shows photos chronologically.*

**FR-10: Timeline View**
Photos arranged by date (newest first), grouped by day/month for easy navigation. Realizes UJ-2.

**Consequences (testable):**
- Photos display in reverse chronological order by capture date (EXIF date preferred, fallback to upload date).
- Day and month group headers are visible between groups; collapsed months show the month header only.
- Dates use the system locale format (Chinese/English support from existing i18n).
- The timeline renders at least 500 photos in a single view without pagination controls.
- Empty dates (no photos) show no group header for that period.

**FR-11: Responsive Thumbnail Grid**
Thumbnail grid loads quickly and scrolls smoothly, even with 10,000+ photos.

**Consequences (testable):**
- Initial grid load renders within 2 seconds.
- Scrolling maintains 60fps with lazy-loaded thumbnails.
- Thumbnails are generated asynchronously server-side and cached.

**FR-12: Quick Scroll**
A date picker or scroll bar allows jumping to a specific month/year.

**Consequences (testable):**
- Date picker shows years and months.
- Selecting a year/month jumps the timeline directly to that period.
- [ASSUMPTION: Implementation as a sticky sidebar or pinch-to-zoom gesture — to be decided in architecture.]

### 4.4 Multi-User & Family Sharing
*Realizes UJ-3. Each family member has their own account and personal library, but can share albums.*

**FR-13: User Accounts**
Admin can invite family members to create accounts via a shareable registration link or email-based invitation. Realizes UJ-3.

**Consequences (testable):**
- Admin generates an invitation link from the app settings; the link expires in 7 days.
- A new user clicking the link lands on a simplified registration form (username + password only, no email required).
- After registration, the new user lands on an empty personal library.
- Existing Smart Files user model is extended rather than replaced — current login flow remains unchanged.

**FR-14: Personal Library**
Each user's uploaded photos go to their private library by default. No other user can see them.

**Consequences (testable):**
- User A's photos are invisible to User B unless explicitly shared.
- Personal library shows only that user's uploads.
- [ASSUMPTION: Reuses existing Smart Files user isolation pattern, with new "Photo" domain model.]

**FR-15: Album Sharing**
Album owner can invite specific users as viewer (read-only) or contributor (can add their own photos) to that album.

**Consequences (testable):**
- Album owner can select users to share with via a user picker.
- Viewer role: can see album photos, cannot add/remove.
- Contributor role: can add their own photos to the album.
- Album owner can revoke sharing at any time.

**FR-16: Family Timeline**
A shared view that aggregates photos from all shared albums into a single unified timeline, cross-user.

**Consequences (testable):**
- Only photos from albums the current user has access to appear.
- Photos are de-duplicated by file hash where the same photo appears in multiple users' libraries.
- The timeline is sorted by capture date regardless of uploader.

### 4.5 Remote Access
*Realizes all journeys. Already handled by Cloudflare Tunnel.*

**FR-17: Configurable Server URL**
The Android app allows setting a custom server URL pointing to the Cloudflare Tunnel domain.

**Consequences (testable):**
- Setting is in app settings, accepts a full URL (e.g., `https://photos.example.com`).
- App connects to the configured URL for all API calls.
- Connection works over mobile data and external Wi-Fi.

## 5. Non-Goals (Explicit)

- v1 does **not** include public share links for non-users.
- v1 does **not** include facial recognition or automated person tagging.
- v1 does **not** include video transcoding or streaming.
- v1 does **not** include iOS support.
- v1 does **not** include a desktop sync client.
- v1 does **not** include SMB/CIFS or WebDAV protocol support.
- v1 does **not** include semantic (CLIP) search — tag-based search only.

## 6. MVP Scope

### 6.1 In Scope

- Mobile photo upload (detection → prompt → background upload → local cleanup) — Android
- AI auto-tagging of uploaded photos
- Tag-based search and filtering
- Chronological timeline browsing with date grouping
- Multi-user accounts (registration, login)
- Personal libraries (private per user)
- Album creation and cross-user sharing (viewer + contributor roles)
- Family timeline (aggregated shared content)
- Configurable server URL for remote access (Cloudflare Tunnel)
- Storage on pooled external USB drives with folder structure `{user}/{date}`

### 6.2 Out of Scope for MVP

| Item | Reason |
|------|--------|
| Public share links | Deferred per user's explicit decision |
| Face recognition / person tagging | Manual albums sufficient for v1 |
| Video transcoding & streaming | Photo backup is the starting need |
| iOS support | Focus on Android; most family members use Android |
| Desktop sync client | Mobile-first usage pattern |
| SMB/CIFS support | Pure file manager feature, not photo-focused |
| Semantic/CLIP search | Tag-based search covers initial needs |

## 7. Cross-Cutting NFRs

### 7.1 Security & Privacy

- **NFR-1: HTTPS only** — All traffic goes through Cloudflare Tunnel (already set up, no additional config needed).
- **NFR-2: Password strength** — Reasonable password requirements for family accounts (min 8 chars, no complexity rules since these are family accounts).
- **NFR-3: Photo privacy** — Personal library is strictly private by default. No admin can see another user's photos without explicit sharing.

### 7.2 Performance

- **NFR-4: Upload throughput** — Should saturate home internet upload bandwidth for photo transfers. No artificial throttling.
- **NFR-5: Thumbnail load** — Grid browsing feels instant: thumbnails are generated asynchronously on upload, cached, and lazy-loaded on scroll.

### 7.3 Storage Architecture

- **NFR-6: Original files preserved** — NAS stores original photo files as the source of truth. Thumbnails are derived artifacts, never the sole copy.
- **NFR-7: Pooled external storage** — Photos are stored on pooled external USB drives. The pool is managed via a filesystem-level tool (e.g., mergerfs, or equivalent). Drives can be added without data migration.
- **NFR-8: Folder structure** — Photos stored on disk as `{username}/{YYYY}/{MM}/` (e.g., `/pool/chris/2026/06/IMG_0001.jpg`).
- **NFR-9: Storage visibility** — Users can see remaining available space on the NAS from the app or settings.
- **NFR-10: Per-user quota (optional)** — No hard quota for v1, but the architecture should support adding quotas later without refactoring.

### 7.4 Reliability

- **NFR-11: Upload resilience** — Failed/interrupted uploads retry with exponential backoff. No progress lost on network interruption. (Reuses Smart Files chunked upload infrastructure.)
- **NFR-12: Pool resilience** — If a single USB drive in the pool fails, photos on other drives remain accessible. The failed drive's content is unavailable but the system continues operating for the rest.

## 8. Constraints and Guardrails

### 8.1 Privacy

- Photo data never leaves the NAS except when the user explicitly shares via album sharing (which remains within the family).
- AI classification runs on-device or on the NAS (no cloud APIs).

### 8.2 Cost

- No external services or subscriptions. The only costs are electricity, USB drives, and domain.
- Cloudflare Tunnel is free tier.
- [ASSUMPTION: AI classification via an open-source model that runs on the NAS hardware (CPU-only or CPU-lightable). To be evaluated in architecture phase.]

## 9. Open Questions

1. **AI model selection** — What open-source image classification model best runs on a home server CPU without GPU? (e.g., MobileNet, EfficientNet-Lite, CLIP small variant). To be answered in architecture phase.
2. **Thumbnail generation** — What thumbnail sizes and formats? (e.g., 256px WebP grid thumbnails + 1024px JPEG preview). To be answered in architecture phase.
3. **Pooling tool** — mergerfs vs. other options for pooling USB drives. Technical decision in architecture phase.

## 11. Reuse Assessment — Smart Files Codebase

The following existing Smart Files infrastructure carries over directly:

| Component | Status | Notes |
|-----------|--------|-------|
| **User auth (JWT)** | ✅ Direct reuse | Existing login/register, JwtAuthGuard, @CurrentUser decorator all carry over |
| **PostgreSQL + Prisma** | ✅ Extend | Add new models (Photo, Album, PhotoTag, SharedAlbum) alongside existing File/Folder/User models |
| **Chunked upload** | ✅ Extend | Existing UploadSession model and chunk endpoints can be adapted for photo uploads (smaller default chunks, hash-based dedup on the server side) |
| **NestJS backend** | ✅ New modules | Photo module, Album module, AITag module — existing module structure is the template |
| **React web frontend** | ✅ New pages | Photo timeline page, album management, tag browser — reuse Tailwind + Vite setup, AuthContext, i18n |
| **Expo mobile app** | 🔄 Adapt as Android app | Current Expo app is file-manager focused; needs a new photo-centric Android experience. Shared auth/config code carries over |
| **i18n (Chinese + English)** | ✅ Extend | Add new photo-related translation strings |
| **Nginx + Cloudflare Tunnel** | ✅ Direct reuse | Already configured and working |
| **Podman/container deploy** | ✅ Direct reuse | Existing compose setup needs a new photo processing worker container added

## 10. Assumptions Index

| Section | Assumption |
|---------|-----------|
| 4.1 | Smart Files chunked upload infrastructure can be extended for photos |
| 4.3 | Quick scroll can be implemented as a sticky sidebar or gesture control |
| 4.4 | Existing Smart Files user isolation pattern can be extended with a new "Photo" domain model |
| 7.4 | A simple pooling tool (mergerfs) handles external USB drives without data loss |
| 8.2 | An open-source image classification model runs acceptably on CPU without a GPU |

# Smart Files Web UI - Mobile-First Redesign Design Spec

**Date:** 2026-06-06
**Scope:** Authenticated web app UI (packages/web/src/)
**Approach:** Route-based bottom tabs with global upload context

---

## 1. Overview

Redesign the authenticated web frontend from a single monolithic desktop-first page into a mobile-friendly, tab-based application with three bottom tabs: **Files**, **Uploads**, and **Settings**. The design uses card-based layouts on all screen sizes, preserves the existing cobalt-blue accent and glassmorphism aesthetic from the auth pages, and lifts upload state into a global context for cross-tab persistence.

### Design Read
Reading this as: file manager app for everyday users, with a clean/native-app language, leaning toward Tailwind v4 utilities + system fonts + motion/react micro-interactions.

### Dials
- **DESIGN_VARIANCE: 4** — Functional app UI, not experimental. Cards have consistent structure, but whitespace and layout are optimized for thumbs.
- **MOTION_INTENSITY: 4** — Smooth transitions between tabs, staggered card entry, hover/tap feedback. No scroll hijacks or parallax.
- **VISUAL_DENSITY: 6** — Information-dense file manager, but breathable with proper spacing and clear hierarchy.

---

## 2. App Shell & Navigation

### Route Structure
```
/files      → Files tab (default authenticated landing)
/uploads    → Uploads tab
/settings   → Settings tab
/login      → LoginPage (unchanged UI)
/register   → RegisterPage (unchanged UI)
/share/:token → SharePage (unchanged)
/           → HomePage (redirects to /files if logged in)
```

### AppLayout Component
A new layout component wraps all authenticated routes (`/files`, `/uploads`, `/settings`):

- **`main`** content area with `pb-24` (or `pb-[calc(4rem+env(safe-area-inset-bottom))]`) to clear the bottom tab bar
- Bottom tab bar fixed to viewport bottom
- Handles safe-area-inset-bottom for iOS notches
- Renders `<Outlet />` or children for page content

### Bottom Tab Bar
- **3 tabs:** Files (folder icon), Uploads (cloud-arrow-up icon), Settings (gear icon)
- **Active state:** Filled icon + cobalt blue text (`#2563eb`) + subtle 2px top border indicator in accent color
- **Inactive state:** Outline icon + zinc-400 text
- **Tap target:** Full tab width, min-height 56px
- **Background:** `bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md` with `border-t border-zinc-200 dark:border-zinc-800`
- **Desktop behavior:** Tab bar stays at the bottom for an app-like feel. Content gets `max-w-3xl mx-auto` constraint.

### Auth Flow Integration
- `PrivateRoute` guards all tab routes. Unauthenticated users redirect to `/login`.
- `/login` and `/register` keep their existing UI (no changes).
- After successful login/register, redirect to `/files`.
- `/` (HomePage) continues to redirect to `/files` if the user is logged in.

---

## 3. Files Tab (`/files`)

Replaces the monolithic `FilesPage.tsx`. This is the primary file browser.

### Header Area
- **Breadcrumb path:** Horizontal scrollable breadcrumb (Root / Folder / Subfolder). Each segment is a tap target to navigate up.
- **Search:** A search icon in the header expands into a full-width search input on tap. Debounced 300ms. Search results replace the file list.
- **Multi-select toggle:** A "Select" button activates multi-select mode, showing checkboxes on each card and a batch actions bar.
- No sign-out button in this tab (moved to Settings).

### File Listing — Card-Based Everywhere
- Each item renders as a horizontal card:
  - Left: preview thumbnail (48x48) or folder/file icon
  - Center: file/folder name (truncated), size + date on second line
  - Right: `⋯` action menu button (or checkbox in multi-select mode)
- Cards separated by `divide-y border-zinc-200 dark:border-zinc-800`
- Tap card: open folder (if folder) or preview file (if previewable file)
- Tap `⋯`: opens a **bottom action sheet** with actions: Preview, Share, Move, Download, Rename, Delete
- **Long-press** on a card also opens the action sheet (mobile gesture)

### Upload FAB (Floating Action Button)
- Circular button, fixed bottom-right, positioned above the tab bar (`bottom-24 right-4`)
- Icon: plus or cloud-arrow-up
- Background: cobalt blue (`#2563eb`), white icon, shadow
- Tap: opens native file picker (`<input type="file" multiple>`)
- Selected files upload to the **current folder**
- Subtle inline toast appears: "3 files uploading — View in Uploads"
- Motion: `whileHover={{ scale: 1.05 }}`, `whileTap={{ scale: 0.95 }}`

### Batch Actions Bar
- Appears fixed above the tab bar when items are selected
- Shows: "3 selected" count
- Actions:
  - **Move** — Opens the folder picker modal. Selected files/folders are moved to the chosen destination in a single batch operation.
  - **Delete** — Opens a confirmation dialog: "Move 3 items to trash?" — confirms and bulk-deletes.
  - **Cancel Selection** — Clears selection and hides the bar
- Dismisses when selection is cleared or user navigates

### Batch Move Flow
- User taps "Select" → checks multiple files/folders → taps "Move" in the batch bar
- `MoveFileModal` opens (reused from single-file move). Modal title shows: "Move 3 items"
- User picks destination folder from the breadcrumb-navigable folder tree
- On confirm: API called for each selected item sequentially (or in parallel if backend supports batch move). Progress shown via loading state on the modal button.
- On success: modal closes, selection clears, file list refreshes, toast: "3 items moved"
- On error: modal shows inline error, failed items remain selected

### Batch Delete Flow
- User selects items → taps "Delete" in batch bar
- Confirmation dialog: "Move 3 items to trash? They can be restored from Trash."
- On confirm: bulk soft-delete API calls. Success: toast "3 items moved to trash", list refreshes, selection clears.

### Empty State
- Centered illustration/icon + "This folder is empty"
- Subtext: "Upload your first file to get started"
- CTA button triggers the FAB action

### Pull-to-Refresh
- Pull down on the file list to refresh folder contents
- On desktop, an explicit refresh button in the header

### Trash View
- A toggle in the header switches between "Files" and "Trash"
- Trash cards show: name, deleted date, and action sheet with Restore / Delete Permanently
- Empty trash state: "Trash is empty"

---

## 4. Uploads Tab (`/uploads`)

Dedicated upload monitor. Upload state lives in a global context, so this tab shows live progress regardless of where uploads were initiated.

### Header
- Title: "Uploads"
- "Add Files" button (secondary style) that opens file picker + folder chooser modal. Uploads started here require the user to pick a target folder first.

### Upload Queue List — Card-Based
- Each upload card shows:
  - File name (truncated)
  - File size
  - Destination folder name
  - Status badge: `Queued` (zinc), `Uploading` (blue), `Paused` (amber), `Completed` (green), `Error` (red)
  - Progress bar (blue fill, animated width transition) for active uploads
- Controls per card (in action sheet or inline):
  - Pause / Resume
  - Retry (visible only on error)
  - Cancel

### Global Controls Toolbar
- Appears below the header when there are active or paused uploads
- Parallel uploads count with +/- stepper buttons
- Pause All / Resume All
- Cancel All

### Upload History Section
- Completed uploads accumulate in an "History" section below active uploads
- Each history item shows: file name, file size, destination folder, completion time (relative: "2 min ago")
- History persists across page refreshes via `localStorage` (key: `sf_upload_history`, max 50 items)
- History items are read-only — no pause/resume/retry controls
- **Clear History** action: a "Clear History" button in the History section header removes all history items from the list and localStorage
- Individual history items can be swiped away or removed via `⋯` menu → "Remove from history"

### Empty State
- If no active uploads AND no history: Icon + "No uploads yet" + subtext "Upload files from the Files tab or tap Add Files" + CTA button
- If no active uploads but history exists: show only the History section with "Clear History" option

---

## 5. Settings Tab (`/settings`)

User profile and app settings.

### User Profile Card (Top)
- Avatar placeholder: colored circle with user initials (e.g., "JD")
- User name and email from `AuthContext`
- Background: subtle zinc-50 card with border

### Settings List
- Vertical list of tappable rows, each with an icon, label, and chevron-right
- Rows:
  - **Language** — globe icon, shows current language (English / 中文), opens language picker
  - **Change Password** — lock icon, opens change password modal
  - **Sign Out** — red text, logout icon, at the bottom of the list

### Language Picker
- Bottom sheet or inline expandable radio group
- Options: English, 中文 (Chinese)
- Updates `I18nContext` immediately on selection
- Closes picker automatically

### Change Password Modal
- Fields: Current Password, New Password, Confirm New Password
- Validation:
  - New password minimum 8 characters
  - Confirm password must match new password
- Submit button disabled until valid
- Success: modal closes, toast "Password updated"
- Error: inline error message

### Sign Out
- Tapping "Sign Out" shows a confirmation dialog: "Sign out of Smart Files?"
- On confirm: calls `logout()` from `AuthContext`, clears token, redirects to `/login`

---

## 6. Data Flow & State Architecture

### UploadContext (New)
Lifts all upload logic out of `FilesPage`. Global provider wrapping the authenticated app.

```typescript
interface UploadContextType {
  uploads: UploadItem[];           // Active + paused + error uploads
  history: UploadHistoryItem[];    // Completed uploads (persisted to localStorage)
  startUpload: (files: File[], folderId?: string) => void;
  pauseUpload: (id: string) => void;
  resumeUpload: (id: string) => void;
  cancelUpload: (id: string) => void;
  retryUpload: (id: string) => void;
  pauseAll: () => void;
  resumeAll: () => void;
  cancelAll: () => void;
  clearHistory: () => void;
  removeFromHistory: (id: string) => void;
  maxParallel: number;
  setMaxParallel: (n: number) => void;
}
```

- **Active uploads** (`uploads`) persist in React state only. If the user refreshes, active HTTP requests may continue in the background but UI state resets.
- **Upload history** (`history`) persists to `localStorage` (key: `sf_upload_history`, max 50 items). Survives page refreshes.
- When an upload completes successfully, it is moved from `uploads` to `history` with a `completedAt` timestamp.
- Uses the existing chunked upload API (`/api/upload/session/*`)
- Progress tracked via XMLHttpRequest `onprogress` events
- Uses the existing chunked upload API (`/api/upload/session/*`)
- Progress tracked via XMLHttpRequest `onprogress` events

### AuthContext (Existing — No Changes)
Already exposes `user`, `login`, `register`, `logout`. Used by:
- Settings tab for profile display
- PrivateRoute for auth gating
- Logout flow

### I18nContext (Existing — Minor Integration)
- `LangSwitcher` component exists but is unused. Integrate it into the Settings tab language picker.
- No structural changes needed.

### API Layer (Existing — No Changes)
All backend endpoints remain unchanged. The frontend reorganizes how and when it calls them.

---

## 7. Component Architecture

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `AppLayout` | `components/AppLayout.tsx` | Shared layout with bottom tab bar for authenticated routes |
| `BottomTabs` | `components/BottomTabs.tsx` | Fixed bottom navigation bar with 3 tabs |
| `BottomSheet` | `components/BottomSheet.tsx` | Slide-up action sheet for file actions |
| `FileCard` | `components/FileCard.tsx` | Card-based file/folder list item |
| `UploadCard` | `components/UploadCard.tsx` | Card-based upload queue item |
| `UploadFAB` | `components/UploadFAB.tsx` | Floating action button for initiating uploads |
| `BatchActionsBar` | `components/BatchActionsBar.tsx` | Fixed bar for multi-select bulk actions |
| `EmptyState` | `components/EmptyState.tsx` | Reusable empty state illustration + text |
| `FolderPickerModal` | `components/FolderPickerModal.tsx` | Modal for choosing target folder when uploading from Uploads tab |
| `ChangePasswordModal` | `components/ChangePasswordModal.tsx` | Modal for changing password |
| `LanguagePicker` | `components/LanguagePicker.tsx` | Bottom sheet for selecting language |
| `ProfileCard` | `components/ProfileCard.tsx` | User profile display card |

### New Pages

| Page | Location | Purpose |
|------|----------|---------|
| `FilesPage` | `pages/FilesPage.tsx` | Refactored — file browser only |
| `UploadsPage` | `pages/UploadsPage.tsx` | New — upload monitor |
| `SettingsPage` | `pages/SettingsPage.tsx` | New — profile and settings |

### Refactored Components

| Component | Change |
|-----------|--------|
| `FilesPage` | Strip out upload logic and settings UI. Keep file browsing, breadcrumbs, search, folder creation, trash toggle, and file actions. Reduce from ~1020 lines to ~300-400 lines. |
| `ShareModal` | Reuse as-is (no changes needed) |
| `MoveFileModal` | Extend to support batch moves. Accept `items: FileItem[]` instead of single `fileId`. Show item count in title (e.g., "Move 3 items"). Move each item sequentially on confirm. |
| `MediaPreview` | Reuse as-is (no changes needed) |

### New Context

| Context | Location | Purpose |
|---------|----------|---------|
| `UploadContext` | `context/UploadContext.tsx` | Global upload queue state and controls |

### Icons
The project currently uses hand-rolled SVG icons in `components/icons.tsx`. For the new tabs and components, add the following icons to that file (or adopt an icon library if preferred):
- Folder (filled + outline)
- CloudArrowUp (filled + outline)
- Gear (filled + outline)
- Plus
- Home
- Trash
- MagnifyingGlass
- CheckCircle
- XCircle
- Pause, Play
- ChevronRight
- EllipsisVertical (⋯)
- Globe
- Lock
- ArrowPath (retry)

**Decision:** Continue using the hand-rolled SVG pattern for consistency, adding the new icons to `components/icons.tsx`.

---

## 8. Visual Design System

### Color Palette
| Token | Light | Dark |
|-------|-------|------|
| Background | `zinc-50` | `zinc-950` |
| Surface / Card | `white` | `zinc-900` |
| Border | `zinc-200` | `zinc-800` |
| Primary Text | `zinc-900` | `zinc-100` |
| Secondary Text | `zinc-500` | `zinc-400` |
| Accent | `#2563eb` | `#3b82f6` |
| Success | `green-500` | `green-400` |
| Warning | `amber-500` | `amber-400` |
| Error | `red-500` | `red-400` |

### Typography
- Font family: system-ui stack (existing) — `font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- Body: `text-sm` to `text-base`
- Headlines: `text-xl` to `text-2xl`
- Labels / badges: `text-xs`, `font-medium`
- No serif fonts

### Cards
- Border: `1px solid` using border color token (or `divide-y` for lists)
- Background: surface token
- Border radius: `rounded-xl` (16px) for standalone cards
- Padding: `p-4`
- Tap feedback: `active:scale-[0.98] transition-transform duration-150` on all tappable cards and buttons

### Motion (via `motion/react`)
- **Page transitions:** Subtle fade (`opacity: 0 → 1`, 200ms) when switching tabs
- **Card entry:** Staggered fade-in + translateY on list load (`staggerChildren: 0.03`)
- **FAB:** `whileHover={{ scale: 1.05 }}`, `whileTap={{ scale: 0.95 }}`
- **Bottom sheet:** `y: 100% → 0` slide-up with `backdrop-filter: blur(4px)` overlay fade
- **Progress bars:** `transition: width 300ms ease-out`
- **Toast:** Slide down from top, auto-dismiss after 3s

### Dark Mode
- Full support via Tailwind `dark:` variants
- Tab bar: `dark:bg-zinc-900/80 dark:border-t-zinc-800`
- Cards: `dark:bg-zinc-900 dark:border-zinc-800`
- Respect `prefers-color-scheme` by default

### Responsive
- **Mobile first:** Full-width cards, `px-4` padding
- **Desktop:** Content constrained to `max-w-3xl mx-auto`, tab bar stays bottom
- **Breakpoints:** Standard Tailwind (`sm: 640px`, `md: 768px`, `lg: 1024px`)

---

## 9. Error Handling

| Scenario | Behavior |
|----------|----------|
| Upload fails (network) | Card shows Error status with Retry button. Toast: "Upload failed — tap to retry" |
| Upload fails (server) | Same as above, with server error message in tooltip/action sheet |
| Folder fetch fails | Inline error card in list with "Retry" button |
| Search fails | Toast: "Search failed. Please try again." |
| Change password fails | Inline error in modal (e.g., "Current password is incorrect") |
| Auth token expires | Redirect to `/login` on next API call |

---

## 10. Accessibility

- All interactive elements have `min-h-11` (44px) tap targets
- Focus rings visible on all buttons and inputs (`focus:ring-2 focus:ring-blue-500`)
- Bottom sheet traps focus while open, closes on Escape key or backdrop tap
- Modal dialogs use `role="dialog"` with `aria-labelledby`
- Progress bars use `role="progressbar"` with `aria-valuenow`
- Tab bar uses `role="tablist"` with `aria-selected`

---

## 11. Out of Scope (Future Versions)

- Drag-and-drop file upload (desktop-only enhancement)
- Keyboard shortcuts
- Storage usage visualization / quota meter
- Theme toggle (manual light/dark switch)
- Offline support / localStorage persistence for upload queue
- Bulk upload folder picker from Files tab FAB
- File type filtering / sorting options
- Grid view toggle (currently only card list view)

---

## 12. File Changes Summary

### New Files
```
packages/web/src/components/AppLayout.tsx
packages/web/src/components/BottomTabs.tsx
packages/web/src/components/BottomSheet.tsx
packages/web/src/components/FileCard.tsx
packages/web/src/components/UploadCard.tsx
packages/web/src/components/UploadFAB.tsx
packages/web/src/components/BatchActionsBar.tsx
packages/web/src/components/EmptyState.tsx
packages/web/src/components/FolderPickerModal.tsx
packages/web/src/components/ChangePasswordModal.tsx
packages/web/src/components/LanguagePicker.tsx
packages/web/src/components/ProfileCard.tsx
packages/web/src/pages/UploadsPage.tsx
packages/web/src/pages/SettingsPage.tsx
packages/web/src/context/UploadContext.tsx
```

### Modified Files
```
packages/web/src/App.tsx              — Update routing for tab routes + layout
packages/web/src/pages/FilesPage.tsx  — Strip upload/settings, keep file browsing
packages/web/src/components/icons.tsx — Add new tab and action icons
```

### Unchanged Files
```
packages/web/src/pages/HomePage.tsx
packages/web/src/pages/LoginPage.tsx
packages/web/src/pages/RegisterPage.tsx
packages/web/src/pages/SharePage.tsx
packages/web/src/components/ShareModal.tsx
packages/web/src/components/MoveFileModal.tsx
packages/web/src/components/MediaPreview.tsx
packages/web/src/components/PreviewThumb.tsx
packages/web/src/context/AuthContext.tsx
packages/web/src/context/I18nContext.tsx
packages/web/src/api/*
```

# Spec: Photo Tab Long-Press Selection

## Summary

Add long-press selection to the Photos tab (PhotoTimelineScreen), allowing users to select multiple photos for batch operations.

## Acceptance Criteria

**AC1: Long-press enters selection mode**
Given a photo grid on the Photos tab
When the user long-presses a photo
Then the photo enters selection mode (shows selected overlay)
And a bottom batch action bar appears with delete button
And the header shows selection count + cancel button

**AC2: Tap to select/deselect in selection mode**
Given the selection mode is active
When the user taps an unselected photo
Then that photo becomes selected
When the user taps a selected photo
Then that photo becomes deselected
When all photos are deselected
Then selection mode exits automatically

**AC3: Cancel exits selection mode**
Given the selection mode is active
When the user taps the cancel button in the header
Then all selections are cleared and selection mode exits

**AC4: Batch delete**
Given one or more photos are selected
When the user taps the delete button in the batch bar
Then a confirmation dialog appears
When confirmed
Then the selected photos are deleted via `POST /photos/batch/delete`
And the photo grid refreshes
And selection mode exits

**AC5: Single tap still opens photo detail**
Given selection mode is NOT active
When the user taps a photo
Then the photo detail screen opens (existing behavior preserved)

## Implementation Plan

1. **Backend**: Add `POST /photos/batch/delete` endpoint (controller + service)
2. **Mobile API**: Add `batchDelete` to `photosApi`
3. **Mobile UI**: Add selection state, overlay, batch bar to `PhotoTimelineScreen`

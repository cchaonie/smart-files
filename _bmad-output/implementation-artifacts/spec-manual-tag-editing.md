# Spec: Manual Photo Tag Editing

## Summary

Allow users to manually add, delete, and modify tags on their photos. Newly added tags are saved to the PhotoTag table and become available in the tag cloud / autocomplete for future filtering and AI-tagging context.

## Acceptance Criteria

**AC1: Add tag**
Given the user is viewing a photo detail
When they type a tag name and press add
Then a new PhotoTag record is created with `{ photoId, tag, confidence: null }`
And the tag appears immediately in the tag cloud

**AC2: Delete tag**
Given a photo has tags
When the user taps the X on a tag pill
Then the PhotoTag record is deleted
And the tag disappears from view

**AC3: Duplicate prevention**
Given a photo already has tag "food"
When the user tries to add "food" again
Then the API returns 409 Conflict and the duplicate is rejected
The UI shows a brief error message

**AC4: New tags appear in autocomplete**
Given the user has manually added tag "vacation" to a photo
When another photo's detail is opened and the user starts typing "va"
Then "vacation" appears in the autocomplete suggestions

## Implementation Plan

1. Backend: `POST /photos/:id/tags` + `DELETE /photos/:id/tags/:tag`
2. Mobile API: `addTag`, `removeTag` in `photosApi`
3. Mobile UI: Tag editing UI in `PhotoDetailScreen` (input + autocomplete + delete buttons)

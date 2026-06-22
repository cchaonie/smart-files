---
stepsCompleted:
  - "requirements-extracted"
  - "epic-created"
inputDocuments:
  - "design-discussion: photoprism-integration"
  - "source: packages/backend/src/ai-tagging/"
  - "source: packages/backend/src/photos/"
  - "source: packages/shared/prisma/schema.prisma"
  - "source: /opt/photoprism/docker-compose.yml"
date: "2026-06-19"
---

# smart-files - Epic Breakdown

## Overview

This epic decomposes the work required to replace the current ONNX MobileNet V3-based AI tagging pipeline with PhotoPrism's superior classification engine, enhancing photo label accuracy and richness.

**Problem:** Current ONNX MobileNet V3 model only supports 1000 ImageNet classes mapped to ~10 Chinese tag categories (宝宝、美食、宠物、人像、风景 etc.). Tags are too coarse, model file is missing (`mobilenet_v3_small.data` not found), effectively making tagging non-functional.

**Solution:** Integrate PhotoPrism (localhost:2342) as the classification backend. PhotoPrism uses TensorFlow-based models with hundreds of fine-grained labels, face detection, NSFW detection, and better overall accuracy. PhotoPrism already has docker-compose at `/opt/photoprism/docker-compose.yml`.

## Requirements Inventory

### Functional Requirements

FR1: Deploy PhotoPrism with shared photo storage from `/mnt/pool`
FR2: NestJS PhotoPrismService shall authenticate with PhotoPrism API via session token
FR3: PhotoPrismService shall submit new photos to PhotoPrism for indexing/classification
FR4: PhotoPrismService shall fetch classification labels from PhotoPrism API
FR5: A TagMapper layer shall convert PhotoPrism labels (English/structured) into appropriate tag format for PhotoTag table
FR6: The AiTaggingWorker shall call PhotoPrismService instead of ONNX classify() for AI tagging
FR7: The photo processing state machine (UPLOADED → THUMBNAILING → TAGGING → COMPLETED) shall remain unchanged
FR8: Existing frontend APIs (`GET /api/photos`, `GET /api/photos/:id`, `GET /api/photos/tags`) shall remain backward-compatible
FR9: Tags from PhotoPrism shall be saved to the existing PhotoTag table with confidence scores

### Non-Functional Requirements

NFR1: PhotoPrism container must run as a non-root user after initialization
NFR2: PhotoPrism must not modify original files on `/mnt/pool` (read-only mode or careful volume mounts)
NFR3: Tagging latency should not significantly exceed current ONNX pipeline (< 30s per photo acceptable)
NFR4: PhotoPrism MariaDB data must persist across container restarts
NFR5: Fallback behavior: if PhotoPrism is unreachable, photo should still progress to COMPLETED status (tagging is nice-to-have)

### Additional Requirements

- PhotoPrism docker-compose must be updated to mount `/mnt/pool` as originals volume
- PhotoPrism MariaDB must use a persistent volume for `/var/lib/mysql`
- A new config entry `PHOTOPRISM_URL` (default `http://localhost:2342`) in backend .env
- A new config entry `PHOTOPRISM_USER` / `PHOTOPRISM_PASSWORD` for API auth
- PhotoTag table schema may need a `source` field to distinguish opencode vs photoprism tags (optional)
- Existing ONNX AiTaggingModule/AiTaggingService files should be deprecated and removed after migration

### FR Coverage Map

| FR | Epic | Story |
|----|------|-------|
| FR1 | 1 | 1.1 |
| FR2 | 1 | 1.2 |
| FR3 | 1 | 1.3 |
| FR4 | 1 | 1.3 |
| FR5 | 1 | 1.2 |
| FR6 | 1 | 1.4 |
| FR7 | 1 | 1.4 |
| FR8 | 1 | 1.5 |
| FR9 | 1 | 1.3 |

## Epic List

  - Epic 1: PhotoPrism Integration — Replace ONNX Tagging Engine

---

## Epic 1: PhotoPrism Integration — Replace ONNX Tagging Engine

**Goal:** Deploy PhotoPrism as a Docker service alongside the existing NestJS backend, create a PhotoPrismService to replace the broken ONNX MobileNet V3 tagging pipeline, and ensure seamless tag delivery to the existing PhotoTag table and frontend APIs.

### Story 1.1: Deploy PhotoPrism with Shared Storage

As a system administrator,
I want to deploy PhotoPrism with MariaDB and shared `/mnt/pool` storage,
So that the classification engine is available and can access the same photos as the NestJS backend.

**Acceptance Criteria:**

**Given** the docker-compose.yml at `/opt/photoprism/docker-compose.yml`
**When** I update the volumes section to mount `/mnt/pool` as `/photoprism/originals`
**Then** the MariaDB `database` directory shall use a persistent host volume
**And** the PhotoPrism service shall start without errors via `podman-compose up -d`

**Given** PhotoPrism is running
**When** I access `http://localhost:2342`
**Then** the PhotoPrism web UI shall be accessible
**And** initial admin login (admin/insecure) shall succeed

**Given** PhotoPrism is running
**When** I check the container logs
**Then** there shall be no TensorFlow initialization errors
**And** the classification and face detection features shall be enabled

### Story 1.2: Create PhotoPrism NestJS Module

As a NestJS backend developer,
I want a PhotoPrismModule with PhotoPrismService and TagMapper,
So that the backend can authenticate and interact with the PhotoPrism REST API.

**Acceptance Criteria:**

**Given** the new `packages/backend/src/photoprism/` module
**When** `PhotoPrismService.login()` is called
**Then** it shall POST to `/api/v1/session` with configured credentials
**And** return a valid session token

**Given** a session token exists
**When** `PhotoPrismService.indexFile(absolutePath)` is called
**Then** it shall submit the file to PhotoPrism for classification

**Given** a PhotoPrism classification result
**When** `TagMapper.map(photoPrismLabels)` is called
**Then** it shall return an array of `{ tag: string, confidence: number }` compatible with PhotoTag table
**And** confidence values shall be normalized to 0-1 scale

**Given** the `TagMapper` is loaded
**When** it encounters an unknown label
**Then** it shall pass through the original English label as-is instead of dropping it

**Given** the PhotoPrismService healthCheck() method
**When** called
**Then** it shall return `true` if PhotoPrism responds, `false` otherwise

### Story 1.3: Implement PhotoPrism Label Retrieval

As the AiTaggingWorker,
I want to retrieve classification labels for a given photo from PhotoPrism,
So that I can replace the ONNX inference call.

**Acceptance Criteria:**

**Given** a photo has been uploaded and stored on `/mnt/pool`
**When** `PhotoPrismService.getLabels(storageKey)` is called
**Then** it shall search PhotoPrism for the matching file
**And** return all classification labels with confidence scores

**Given** labels are returned from PhotoPrism
**When** confidence is below the configurable threshold (default 0.3)
**Then** the label shall be filtered out

**Given** PhotoPrism is unreachable or returns an error
**When** `getLabels()` fails
**Then** the method shall throw a catchable error
**And** the worker shall fall back to marking the photo as COMPLETED without tags

### Story 1.4: Replace ONNX Tagging in Worker Pipeline

As the photo processing pipeline,
I want the AiTaggingWorker to call PhotoPrismService instead of AiTaggingService.classify(),
So that photos are tagged with PhotoPrism's superior labels.

**Acceptance Criteria:**

**Given** a photo enters the TAGGING state
**When** the AiTaggingWorker processes it
**Then** it shall call `PhotoPrismService.indexFile()` then `PhotoPrismService.getLabels()`
**And** NOT call `AiTaggingService.classify()`
**And** save the returned tags to PhotoTag table

**Given** tagging succeeds
**When** tags are saved
**Then** the photo status shall transition from TAGGING to COMPLETED
**And** the photo shall be accessible via the existing `GET /api/photos` endpoint with tags

**Given** tagging fails (PhotoPrism down)
**When** the worker catches the error
**Then** the photo shall transition to COMPLETED status without tags
**And** the error shall be logged

### Story 1.5: Verify API Backward Compatibility

As a frontend user,
I want the existing photo listing and tag endpoints to continue working identically,
So that no mobile or web UI changes are needed.

**Acceptance Criteria:**

**Given** photos exist with PhotoPrism-sourced tags
**When** `GET /api/photos` is called
**Then** each photo shall include a `tags` array with `{ tag, confidence }` format (unchanged from before)

**Given** `GET /api/photos/tags?q=cat` is called
**When** PhotoPrism-sourced tags exist
**Then** the autocomplete endpoint shall return matching tags (unchanged behavior)

**Given** `GET /api/photos/:id` is called
**When** the photo has PhotoPrism tags
**Then** the full tag list shall be returned (unchanged format)

### Story 1.6: Clean Up Legacy ONNX Code

As a developer,
I want to remove the deprecated ONNX MobileNet V3 code,
So that the codebase stays clean and maintainable.

**Acceptance Criteria:**

**Given** PhotoPrism integration is verified in production
**When** I inspect the codebase
**Then** `packages/backend/src/ai-tagging/ai-tagging.service.ts` shall be removed
**And** `packages/backend/src/ai-tagging/label-map.ts` shall be removed
**And** the `models/` directory containing ONNX files shall be removed
**And** the `AiTaggingModule` shall be removed from `PhotosModule` imports
**And** the `AiTaggingWorker` shall be updated to depend only on `PhotoPrismService`

---
phase: 01-foundation
plan: 02
subsystem: canvas
tags: [canvas-adapter, obsidian-typings, canvas-events, file-fallback, internal-api]

# Dependency graph
requires:
  - "Plugin scaffold with build toolchain (01-01)"
  - "obsidian-typings for CanvasView type access (01-01)"
provides:
  - "CanvasAdapter class wrapping all undocumented canvas internal API access"
  - "File-based JSON fallback for canvas reading via vault.read()"
  - "CanvasNodeInfo normalized interface for plugin-wide canvas node data"
  - "CanvasSnapshot interface for file-based canvas snapshots"
  - "CANVAS_EVENT_TYPES constants for monkey-patch event names"
  - "CanvasEvent interface for event payloads"
  - "getCanvasPrototype() for patcher to obtain canvas prototype"
affects: [01-04, 01-05, 02-01, 02-02]

# Tech tracking
tech-stack:
  added: []
  patterns: [adapter-pattern-for-unstable-api, dual-path-internal-api-plus-file-fallback, defensive-normalization-with-try-catch, read-only-adapter-to-avoid-requestSave-race]

key-files:
  created: [src/types/canvas.ts, src/canvas/canvas-events.ts, src/canvas/canvas-adapter.ts]
  modified: []

key-decisions:
  - "CanvasAdapter returns 'any' for canvas objects to keep adapter boundary clean -- callers do not need internal types"
  - "Read-only adapter in Phase 1 -- no vault.modify() exposed to avoid requestSave 2-second debounce race condition (FOUN-13)"
  - "resolveContentFromData uses switch on nodeData.type for type-safe content extraction from CanvasData JSON"
  - "normalizeNode is defensive with fallback values since internal API shape may vary across Obsidian versions"

metrics:
  duration: 3min
  completed: "2026-04-03T02:28:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 0
---

# Phase 01 Plan 02: Canvas Adapter Layer Summary

Canvas adapter wrapping undocumented internal canvas API behind stable interface with file-based JSON fallback via vault.read()

## What Was Built

### Task 1: Canvas Event Types and Node Info Interface
- Created `src/types/canvas.ts` with `CanvasNodeInfo` (normalized node data: id, type, x, y, width, height, content, color) and `CanvasSnapshot` (nodes + filePath) interfaces
- Created `src/canvas/canvas-events.ts` with `CANVAS_EVENT_TYPES` constants namespaced with `canvas-ai:` prefix (NODE_CREATED, NODE_REMOVED, NODE_MOVED, CANVAS_CHANGED), `CanvasEventType` union type, and `CanvasEvent` interface

### Task 2: CanvasAdapter Implementation
- Created `src/canvas/canvas-adapter.ts` -- the single point of contact between the plugin and Obsidian's undocumented canvas internals (FOUN-02)
- **Primary path:** `getActiveCanvas()`, `getNodesFromCanvas()`, `getCanvasPrototype()` access internal canvas API typed via obsidian-typings
- **Fallback path:** `readCanvasFile()` parses standard CanvasData JSON from .canvas files via `vault.read()` (FOUN-03)
- **Safety:** No `vault.modify()` exposed anywhere -- adapter is read-only in Phase 1 to avoid the requestSave 2-second debounce race condition (FOUN-13)
- Defensive normalization in `normalizeNode()` handles missing properties with fallback values since internal API shape can vary across Obsidian versions

## Architecture Decisions

1. **Adapter pattern for unstable API**: All obsidian-typings canvas type imports are confined to `canvas-adapter.ts`. If Obsidian updates break canvas internals, only this file needs updating.
2. **`any` return type for canvas**: `getActiveCanvas()` returns `any` so callers never need to import internal types. The adapter normalizes data into stable `CanvasNodeInfo` objects.
3. **Dual content resolution**: Internal nodes use `resolveContent()` (tries properties then `getData()`), file nodes use `resolveContentFromData()` (type-safe switch on `nodeData.type`).

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- Build (`npm run build`): PASS
- TypeScript compilation (`tsc --noEmit`): PASS (0 errors in our files; pre-existing node_modules errors unrelated)
- CanvasAdapter exports CanvasAdapter class: PASS
- CANVAS_EVENT_TYPES and CanvasEvent exported: PASS
- CanvasNodeInfo and CanvasSnapshot exported: PASS
- No obsidian-typings imports outside canvas-adapter.ts: PASS
- No vault.modify() code usage in canvas adapter: PASS

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 8b194da | feat(01-02): define canvas event types and node info interface |
| 2 | 3b72906 | feat(01-02): implement CanvasAdapter with internal API and file fallback |

## Known Stubs

None -- all interfaces are fully implemented with real logic (normalization, type resolution, content extraction).

## Self-Check: PASSED

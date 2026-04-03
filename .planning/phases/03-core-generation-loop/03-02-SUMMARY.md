---
phase: 03-core-generation-loop
plan: 02
subsystem: ai
tags: [anthropic-sdk, streaming, prompt-caching, error-handling, watchdog, node-boundary]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: CanvasAISettings interface, plugin lifecycle
  - phase: 02-spatial-intelligence
    provides: SpatialContext with narrative for prompt building
  - phase: 03-core-generation-loop
    plan: 01
    provides: CanvasAISettings with token budget fields, BUFFER_INTERVAL_MS, taste profile module
provides:
  - Claude client wrapper for Electron (createClaudeClient, classifyApiError, getRetryDelay, getMaxRetries)
  - Prompt builder with 2-block cached system prompt (buildSystemPrompt, buildUserMessage, GENERATION_INSTRUCTIONS)
  - Stream handler with buffered updates, watchdog, and node boundary detection (streamIntoNode, parseNodeContent)
  - Anthropic SDK mock for unit tests (MockStream, MockAnthropicClient, createMockClientWithStream)
affects: [03-03 canvas-node-creation, 03-04 pipeline-wiring, 03-05 settings-ui, 04-multi-medium]

# Tech tracking
tech-stack:
  added: []
  patterns: ["2-block system prompt with cache_control ephemeral on static block", "Tag-aware stream buffering with partial tag holdback", "Mock stream with emitText/simulateStream for testing async streaming"]

key-files:
  created:
    - src/ai/claude-client.ts
    - src/ai/prompt-builder.ts
    - src/ai/stream-handler.ts
    - tests/__mocks__/anthropic.ts
    - tests/ai/claude-client.test.ts
    - tests/ai/prompt-builder.test.ts
    - tests/ai/stream-handler.test.ts
  modified: []

key-decisions:
  - "Mock Anthropic SDK constructor via jest.mock to verify client init params without instantiating real SDK"
  - "2-block system prompt: block 1 (instructions+taste) cached with ephemeral, block 2 (spatial narrative) dynamic"
  - "Tag-aware stream accumulation: extractCurrentNodeVisibleText parses raw text by node index to provide clean visible text"
  - "Buffer flush via setTimeout scheduled on each delta, not setInterval, to naturally align with delta arrival"

patterns-established:
  - "MockStream pattern: emitText() for synchronous delta simulation in tests with jest.useFakeTimers()"
  - "System prompt as typed array of SystemPromptBlock with optional cache_control"
  - "processTagBoundaries() for counting open/close tags in accumulated raw text to detect node transitions"

requirements-completed: [GENP-01, GENP-02, GENP-06, GENP-07, GENP-08, GENP-11, GENP-12, MMED-01]

# Metrics
duration: 4min
completed: 2026-04-03
---

# Phase 3 Plan 2: Claude Client, Prompt Builder, and Stream Handler Summary

**Anthropic SDK wrapper for Electron, 2-block cached system prompt with spatial+taste, and streaming handler with 250ms buffered updates, 30s watchdog, and mid-stream node boundary detection**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-03T16:05:01Z
- **Completed:** 2026-04-03T16:09:42Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Claude client initializes SDK with dangerouslyAllowBrowser, maxRetries 2, timeout 60s for Electron
- Error classification handles 401 (auth/no retry), 429 (rate_limit/Retry-After), 500+ (server/exponential backoff), network errors
- System prompt composed as 2-block array: cached instructions+taste with ephemeral cache_control, dynamic spatial narrative
- Stream handler buffers at 250ms, fires watchdog at 30s, detects </node> boundaries mid-stream with onNodeBoundary callback
- 43 tests across 3 new test suites all passing (51 total across all AI suites)
- Reusable Anthropic SDK mock with MockStream and MockAnthropicClient

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Claude client wrapper and Anthropic SDK mock** - `54f7850` (feat)
2. **Task 2: Create prompt builder with spatial context, taste profile, and caching** - `b584c2b` (feat)
3. **Task 3: Create stream handler with buffered updates, watchdog, and node boundary detection** - `ab2e280` (feat)

_All tasks followed TDD: RED (failing tests) -> GREEN (implementation) -> verify_

## Files Created/Modified
- `src/ai/claude-client.ts` - Anthropic SDK wrapper for Electron with error classification and retry delay computation
- `src/ai/prompt-builder.ts` - System prompt composition with 2-block caching strategy and generation instructions
- `src/ai/stream-handler.ts` - Streaming orchestration with buffered text delivery, watchdog, abort safety, and node boundary detection
- `tests/__mocks__/anthropic.ts` - Mock Anthropic SDK with MockStream (emitText, simulateStream, finalMessage)
- `tests/ai/claude-client.test.ts` - 20 tests: client init params, error classification, retry delays, max retries
- `tests/ai/prompt-builder.test.ts` - 10 tests: system prompt structure, caching, content inclusion, user message
- `tests/ai/stream-handler.test.ts` - 13 tests: buffering, first token, watchdog, abort, node boundaries, tag stripping

## Decisions Made
- Mock Anthropic SDK constructor via jest.mock rather than importing the real SDK -- verifies constructor params without network dependencies
- 2-block system prompt composition: block 1 (GENERATION_INSTRUCTIONS + taste profile) marked with cache_control ephemeral for Opus caching; block 2 (spatial narrative) changes every trigger and is NOT cached
- Tag-aware stream accumulation: extractCurrentNodeVisibleText walks the raw accumulated text by node index to provide clean visible content for onTextUpdate, stripping all <node>/<\/node> tags
- Buffer flush uses setTimeout scheduled on each delta rather than setInterval -- naturally throttles to BUFFER_INTERVAL_MS without lingering interval timers
- processTagBoundaries counts open/close tags in accumulated text to detect node transitions rather than tracking character-by-character state machine -- simpler and handles edge cases of tags split across deltas

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all modules are fully implemented with real logic.

## Next Phase Readiness
- Claude client ready for pipeline wiring (Plan 04/05) -- createClaudeClient(apiKey) returns configured Anthropic instance
- Prompt builder ready for generation orchestrator -- buildSystemPrompt(taste, spatial) returns cached system prompt array
- Stream handler ready for canvas node streaming -- streamIntoNode(client, system, user, signal, callbacks) returns StreamResult
- onNodeBoundary callback enables sequential multi-node streaming in Plan 04 (canvas-node-creation)
- Anthropic SDK mock ready for integration tests in future plans

## Self-Check: PASSED

- All 7 created files exist on disk
- All 3 task commits verified in git log (54f7850, b584c2b, ab2e280)
- SUMMARY.md exists at expected path
- 43 new tests pass across 3 new test suites (51 total across all AI suites)

---
*Phase: 03-core-generation-loop*
*Completed: 2026-04-03*

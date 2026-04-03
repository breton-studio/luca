---
phase: 3
slug: core-generation-loop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29 with ts-jest |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npm test -- --bail` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --bail`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | GENP-01 | unit | `npm test -- tests/ai/claude-client.test.ts -t "creates client"` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | GENP-03 | unit | `npm test -- tests/ai/stream-handler.test.ts -t "accumulates text"` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | GENP-04 | unit | `npm test -- tests/ai/stream-handler.test.ts -t "buffers"` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | GENP-06 | unit | `npm test -- tests/ai/prompt-builder.test.ts -t "includes"` | ❌ W0 | ⬜ pending |
| 03-01-05 | 01 | 1 | GENP-08 | unit | `npm test -- tests/ai/prompt-builder.test.ts -t "cache_control"` | ❌ W0 | ⬜ pending |
| 03-01-06 | 01 | 1 | GENP-09 | unit | `npm test -- tests/ai/token-budget.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-07 | 01 | 1 | GENP-10 | unit | `npm test -- tests/ai/token-budget.test.ts -t "exceeded"` | ❌ W0 | ⬜ pending |
| 03-01-08 | 01 | 1 | GENP-11 | unit | `npm test -- tests/ai/stream-handler.test.ts -t "watchdog"` | ❌ W0 | ⬜ pending |
| 03-01-09 | 01 | 1 | GENP-12 | unit | `npm test -- tests/ai/claude-client.test.ts -t "error"` | ❌ W0 | ⬜ pending |
| 03-01-10 | 01 | 1 | MMED-01 | unit | `npm test -- tests/ai/prompt-builder.test.ts -t "markdown"` | ❌ W0 | ⬜ pending |
| 03-01-11 | 01 | 1 | TAST-01 | unit | `npm test -- tests/taste/taste-profile.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-12 | 01 | 1 | TAST-02 | unit | `npm test -- tests/taste/taste-profile.test.ts -t "frontmatter"` | ❌ W0 | ⬜ pending |
| 03-01-13 | 01 | 1 | TAST-03 | unit | `npm test -- tests/ai/prompt-builder.test.ts -t "taste"` | ❌ W0 | ⬜ pending |
| 03-01-14 | 01 | 1 | MMED-09 | unit | Covered by stream-handler tests | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `tests/ai/claude-client.test.ts` — SDK initialization, error handling stubs
- [ ] `tests/ai/stream-handler.test.ts` — Buffer accumulation, flush timing, watchdog timeout, abort handling stubs
- [ ] `tests/ai/prompt-builder.test.ts` — System prompt composition, cache_control presence, taste injection stubs
- [ ] `tests/ai/token-budget.test.ts` — Budget tracking, daily reset, exceeded detection, override stubs
- [ ] `tests/taste/taste-profile.test.ts` — File read/write, seed content, frontmatter parsing stubs
- [ ] `tests/__mocks__/anthropic.ts` — Mock Anthropic SDK for unit tests (stream simulation)
- [ ] Framework install: `npm install --save-dev jest ts-jest @types/jest` if not already present

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Node.js fetch in Electron | GENP-02 | Requires live Electron environment | Load plugin in Obsidian, trigger generation, verify no CORS errors in console |
| Pre-allocated node dimensions | GENP-05 | Requires live canvas rendering | Trigger generation, verify node appears at correct position with correct size before content arrives |
| Opus model selection | GENP-07 | Requires live API call + canvas | Trigger generation, check API request payload in network tab for model: "claude-opus-4-6-20250414" |
| AI node color | MMED-10 | Requires live canvas DOM | Create AI node, inspect canvas node for color attribute "6" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

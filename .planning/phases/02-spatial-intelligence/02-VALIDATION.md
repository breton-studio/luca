---
phase: 2
slug: spatial-intelligence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29 + ts-jest 29 |
| **Config file** | jest.config.js |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | SPAT-01 | unit | `npx jest tests/spatial/proximity.test.ts -t "reads nodes" -x` | No -- Wave 0 | ⬜ pending |
| 02-01-02 | 01 | 0 | SPAT-02 | unit | `npx jest tests/spatial/proximity.test.ts -t "distance" -x` | No -- Wave 0 | ⬜ pending |
| 02-01-03 | 01 | 0 | SPAT-03 | unit | `npx jest tests/spatial/proximity.test.ts -t "relevance" -x` | No -- Wave 0 | ⬜ pending |
| 02-01-04 | 01 | 0 | SPAT-04 | unit | `npx jest tests/spatial/proximity.test.ts -t "relevance" -x` | No -- Wave 0 | ⬜ pending |
| 02-02-01 | 02 | 0 | SPAT-05 | unit | `npx jest tests/spatial/clustering.test.ts -x` | No -- Wave 0 | ⬜ pending |
| 02-03-01 | 03 | 0 | SPAT-06 | unit | `npx jest tests/spatial/context-builder.test.ts -x` | No -- Wave 0 | ⬜ pending |
| 02-03-02 | 03 | 0 | SPAT-07 | unit | `npx jest tests/spatial/context-builder.test.ts -t "filter" -x` | No -- Wave 0 | ⬜ pending |
| 02-04-01 | 04 | 0 | SPAT-08 | unit | `npx jest tests/spatial/placement.test.ts -t "orbital" -x` | No -- Wave 0 | ⬜ pending |
| 02-04-02 | 04 | 0 | SPAT-09 | unit | `npx jest tests/spatial/placement.test.ts -t "collision" -x` | No -- Wave 0 | ⬜ pending |
| 02-04-03 | 04 | 0 | SPAT-10 | unit | `npx jest tests/spatial/placement.test.ts -t "viewport" -x` | No -- Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/spatial/proximity.test.ts` — stubs for SPAT-01, SPAT-02, SPAT-03, SPAT-04
- [ ] `tests/spatial/clustering.test.ts` — stubs for SPAT-05
- [ ] `tests/spatial/placement.test.ts` — stubs for SPAT-08, SPAT-09, SPAT-10
- [ ] `tests/spatial/context-builder.test.ts` — stubs for SPAT-06, SPAT-07
- [ ] Test fixtures: reusable CanvasNodeInfo[] factory for common canvas layouts (sparse, dense, clustered, single node, empty)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Viewport zoom/pan visual accuracy | SPAT-10 | Requires live Obsidian canvas with zoom/pan interaction | 1. Open canvas with nodes 2. Zoom to 50%, trigger generation 3. Verify placement accounts for viewport offset 4. Pan away, trigger again, verify correct placement |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

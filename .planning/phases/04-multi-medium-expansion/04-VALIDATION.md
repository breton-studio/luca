---
phase: 4
slug: multi-medium-expansion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | jest.config.js |
| **Quick run command** | `npm test -- --bail` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

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
| 04-01-01 | 01 | 1 | MMED-02 | unit | `npm test -- stream-handler` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | MMED-03 | unit | `npm test -- stream-handler` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | MMED-04 | unit | `npm test -- stream-handler` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | MMED-05 | unit | `npm test -- runware` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | MMED-06 | unit | `npm test -- runware` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 1 | MMED-07 | unit | `npm test -- runware` | ❌ W0 | ⬜ pending |
| 04-02-04 | 02 | 1 | MMED-08 | unit | `npm test -- runware` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/stream-handler.test.ts` — tests for typed node tag parsing, mermaid buffering, code streaming
- [ ] `src/__tests__/runware-client.test.ts` — tests for image generation, file saving, placeholder swap

*Existing test infrastructure (jest.config.js, tsconfig) covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mermaid renders as diagram in canvas node | MMED-03 | Obsidian renderer not available in test env | Create text node with ```mermaid block, verify visual diagram in canvas |
| Image file node displays on canvas | MMED-07 | Canvas file node creation requires live Obsidian | Generate image, verify file node appears at correct position |
| Placeholder pulsing animation | MMED-08 | CSS animation requires browser rendering | Trigger image gen, verify pulsing border + "generating..." text |
| Claude medium selection quality | MMED-02/03/05 | Requires real Claude API + spatial context | Test with varied canvas contexts, verify appropriate medium choices |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

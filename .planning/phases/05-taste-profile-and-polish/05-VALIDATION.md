---
phase: 5
slug: taste-profile-and-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29 + ts-jest |
| **Config file** | `jest.config.cjs` |
| **Quick run command** | `npx jest --bail` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --bail`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | TAST-06 | unit | `npx jest tests/taste/taste-profile.test.ts -x` | Exists (needs update) | ⬜ pending |
| 05-01-02 | 01 | 1 | TAST-06 | unit | `npx jest tests/taste/taste-profile.test.ts -x` | Exists (needs update) | ⬜ pending |
| 05-01-03 | 01 | 1 | TAST-06 | unit | `npx jest tests/taste/taste-profile.test.ts -x` | Exists (needs update) | ⬜ pending |
| 05-02-01 | 02 | 1 | TAST-07 | unit | `npx jest tests/ai/prompt-builder.test.ts -x` | Exists (needs update) | ⬜ pending |
| 05-02-02 | 02 | 1 | TAST-07 | unit | `npx jest tests/ai/prompt-builder.test.ts -x` | Exists (needs update) | ⬜ pending |
| 05-03-01 | 03 | 1 | TAST-05 | manual-only | N/A (requires Obsidian runtime) | N/A | ⬜ pending |
| 05-04-01 | 04 | 2 | D-09/D-10 | unit | `npx jest tests/spatial/placement.test.ts -x` | Exists (needs rewrite) | ⬜ pending |
| 05-04-02 | 04 | 2 | D-11 | unit | `npx jest tests/spatial/placement.test.ts -x` | Exists (needs rewrite) | ⬜ pending |
| 05-05-01 | 05 | 2 | D-12 | unit | `npx jest tests/canvas/companion-node.test.ts -x` | Wave 0 | ⬜ pending |
| 05-05-02 | 05 | 2 | D-13 | unit | `npx jest tests/canvas/companion-node.test.ts -x` | Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/canvas/companion-node.test.ts` — stubs for D-12, D-13 (companion node content detection, HTML handling)
- [ ] Update `tests/taste/taste-profile.test.ts` — covers TAST-06 (nested YAML parsing, backward compat, new formatTasteForPrompt)
- [ ] Update `tests/ai/prompt-builder.test.ts` — covers TAST-07 (counter-sycophancy block presence, four behaviors)
- [ ] Update `tests/spatial/placement.test.ts` — covers D-09, D-10, D-11 (edge-aligned placement replacing orbital)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Settings UI button opens profile file | TAST-05 | Requires Obsidian runtime and workspace API | 1. Open plugin settings 2. Click "Open taste profile" button 3. Verify markdown file opens in new editor tab |
| Companion node renders interactive HTML | D-13 | Requires live DOM and iframe execution | 1. Generate code node with HTML content 2. Verify companion node appears with iframe 3. Verify interactive elements respond to clicks |
| Companion node renders Mermaid | D-13 | Requires Obsidian's built-in Mermaid renderer | 1. Generate Mermaid code node 2. Verify companion renders diagram via Obsidian renderer |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

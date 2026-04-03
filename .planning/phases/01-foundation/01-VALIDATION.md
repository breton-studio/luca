---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (ts-jest for TypeScript) |
| **Config file** | jest.config.js (Wave 0 installs) |
| **Quick run command** | `npx jest --bail` |
| **Full suite command** | `npx jest --coverage` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --bail`
- **After every plan wave:** Run `npx jest --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | FOUN-01 | integration | `npx jest --bail` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | FOUN-02, FOUN-03 | unit | `npx jest --bail` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | FOUN-04, FOUN-05 | unit | `npx jest --bail` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `jest.config.js` — Jest configuration with ts-jest transform
- [ ] `tests/` directory — test file structure
- [ ] `jest` + `ts-jest` + `@types/jest` — dev dependencies if no framework detected

*Planner will refine Wave 0 tasks based on actual plan structure.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Plugin loads in Obsidian | FOUN-01 | Requires Obsidian runtime | Load plugin in dev vault, check console for errors |
| Status bar renders correctly | FOUN-07 | DOM rendering in Obsidian | Visual check in running Obsidian |
| Canvas event detection | FOUN-04 | Requires real canvas interaction | Create/move/edit nodes, check console logs in debug mode |
| Settings tab renders | FOUN-02 | Obsidian Settings UI rendering | Open settings, verify tab appears with correct fields |
| Right-click context menu | FOUN-09 | Canvas context menu integration | Right-click canvas, verify toggle option appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

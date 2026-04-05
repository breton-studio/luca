## 05-04 deferred items

Pre-existing TypeScript errors observed during `npx tsc --noEmit` at end of plan 05-04 execution (2026-04-05). Both pre-date this plan (confirmed via `git stash` — errors present even with plan 05-04 changes reverted). Both are outside the 05-04 file boundary as it pertains to placement wiring. Not fixed by 05-04:

- `src/types/canvas.ts(25,10)`: Cannot find name 'CanvasEdgeInfo'. — Root cause: line 17 uses `export type { CanvasEdgeInfo } from '../spatial/types';` which does not bring `CanvasEdgeInfo` into the local type scope in this tsconfig. Line 25's `CanvasSnapshot.edges: CanvasEdgeInfo[]` then cannot resolve the type. Fix: change line 17 to `import type { CanvasEdgeInfo } from '../spatial/types'; export type { CanvasEdgeInfo };`. Not in plan 05-04 scope (file not in 05-04 boundary; error last touched in Phase 02).
- `src/main.ts(457,30)`: Property 'type' does not exist on type 'never'. — Cascading consequence of the `CanvasEdgeInfo` failure above; TypeScript's cross-file inference degrades `activeNodeMeta` narrowing inside `streamWithRetry`'s finalization block. Resolving canvas.ts(25) should eliminate this error.

Plan 05-04 verified its own file boundary (`src/spatial/placement.ts`, `src/spatial/context-builder.ts`, `src/spatial/index.ts`, `tests/spatial/placement.test.ts`) is type-clean via filtered tsc output and `npx jest` is 234/234 green. `npm run build` (esbuild production) succeeds cleanly.

## 05-03 deferred items

Pre-existing TypeScript errors observed during `npx tsc --noEmit` at start of plan 05-03 execution (2026-04-05). All are outside the 05-03 file boundary (src/settings.ts only) and belong to other parallel plans. Not fixed by 05-03:

- `src/main.ts(457,30)`: Property 'type' does not exist on type 'never'. — belongs to 05-04 (edge-aligned placement) / main.ts work.
- `src/taste/taste-profile.ts(102,8)`: TasteProfileFields → Record<string,string> cast mismatch. — belongs to 05-01 (taste profile structure).
- `src/types/canvas.ts(25,10)`: Cannot find name 'CanvasEdgeInfo'. — belongs to 05-04 (edge-aligned placement) / canvas types.

Plan 05-03 verified `src/settings.ts` is type-clean via filtered tsc output. Other plans should resolve these in their respective file boundaries.

## 05-01 deferred items

Pre-existing / parallel-agent TypeScript errors observed during `npx tsc --noEmit` at end of plan 05-01 execution (2026-04-05). All are outside the 05-01 file boundary (src/taste/taste-profile.ts, tests/taste/taste-profile.test.ts) and belong to other parallel plans. Not fixed by 05-01:

- `src/main.ts(457,30)`: Property 'type' does not exist on type 'never'. — belongs to 05-04 (edge-aligned placement) / main.ts work.
- `src/types/canvas.ts(25,10)`: Cannot find name 'CanvasEdgeInfo'. — belongs to 05-04 (edge-aligned placement) / canvas types.
- `src/spatial/context-builder.ts(23,10)` and `src/spatial/index.ts(26,45)`: Module './placement' has no exported member 'computeOrbitalPlacements'. — caused by a parallel agent's in-progress rename in `src/spatial/placement.ts`. Belongs to that plan's file boundary (spatial/*).

Taste profile test failures observed in full jest suite are all in `tests/spatial/*` and stem from the same parallel `src/spatial/placement.ts` rewrite. Not in 05-01 scope. Resolved `src/taste/taste-profile.ts(102,8)` `Record<string,string>` cast error by replacing the flat parser with the nested-aware implementation.

Plan 05-01 verified `src/taste/taste-profile.ts` and `tests/taste/taste-profile.test.ts` are type-clean via filtered tsc output, and `npx jest tests/taste/taste-profile.test.ts` is 27/27 green.

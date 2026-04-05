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

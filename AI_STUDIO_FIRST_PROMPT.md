# FIRST PROMPT FOR GOOGLE AI STUDIO

You are working on PROJECT VECTOR, a deterministic mobile predictive-strategy puzzle game.

Before changing code, read these files in this order:
1. `docs/LOCKS_AND_EDITABLE_AREAS.md`
2. `docs/PROJECT_VECTOR_MASTER_SPEC_v1.0.md`
3. `docs/DESIGN_REFERENCE_BRICKS_BREAKER_QUEST.md`
4. `docs/ARCHITECTURE.md`
5. `docs/ACCEPTANCE_CHECKLIST.md`
6. `docs/MIGRATION_NOTES.md`

## Core product rule
The game's differentiator is NOT simply aiming balls at bricks.
The player can inspect the predicted consequence of an angle before launching and compare possible futures.

Mental model:
**Drag = explore a future. Release = choose which future becomes real.**

The player should see predicted trajectory and projected consequences on the board itself. Do not turn the game into an analytics dashboard and do not surface one automatic “best answer” as the primary experience.

## Hard technical rule
`src/physics/simulation.js` owns the authoritative `simulateTurn()` contract.
Gameplay, prediction, solver, replay, and tests must all use that same simulation path. Never create separate approximate gameplay/solver/preview physics.

## Case-study rule
Use Bricks Breaker Quest only as a structural mobile UX case study:
- portrait playfield dominance;
- shallow permanent HUD;
- dense readable bricks;
- launch point near lower field;
- direct one-finger aim;
- minimal obstruction of the board.

Do NOT copy its branding, assets, exact art, proprietary level layouts, or visual identity.

## First assignment
Do NOT add features yet.

1. Run the existing tests and report the result.
2. Open the app at mobile portrait sizes 360×800, 390×844, and 412×915.
3. Audit the current screen against `DESIGN_REFERENCE_BRICKS_BREAKER_QUEST.md` and `ACCEPTANCE_CHECKLIST.md`.
4. Make only the smallest UI/rendering changes needed to improve playfield dominance, direct aiming clarity, and diegetic future preview.
5. Do not change physics rules, state schema, solver semantics, angle range, or `simulateTurn()` unless a test proves a defect and you explicitly explain it first.
6. After edits, rerun tests and provide a concise diff grouped into: UI, rendering, physics (should be none unless justified), tests.

Success means PROJECT VECTOR feels like a clean native mobile brick-angle game at first glance, while its unique pre-shot “visible futures” mechanic is immediately understandable through the board itself.

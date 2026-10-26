# Migration Notes — v1

## What this package fixes
The previous prototype accumulated concept, physics, solver, future preview, rendering, mobile UI, and case-study experiments in one HTML file. That made it too easy for a visual iteration to accidentally alter gameplay assumptions.

This migration separates those responsibilities and introduces a literal `simulateTurn()` public contract.

## Canonical player aim domain: full upward hemisphere (1°–179°)
The canonical player aim domain is officially established as the full upward hemisphere (1°–179°), allowing direct mobile exploration of both rightward (1°–89°) and leftward (91°–179°) trajectories as well as vertical shots (90°). The earlier 1°–89° restriction is formally superseded.

## Return-point-dependent launcher position
The first ball to exit through the bottom determines the horizontal launcher origin for the next turn. Next-turn launcher Y remains fixed at the baseline. This rule is authoritative game state owned by `Simulation.result()` and transitioned via `applyTurnResult()`, serialized and reproducible across gameplay, Future Preview, solver, and tests.

## Board Progression / Row Descent v1 (schemaVersion 1.1)
Each committed volley advances the game state deterministically:
1. Volley shot consequences resolve; destroyed blocks do not descend and are removed.
2. The first bottom exit determines next-turn launcher X.
3. All surviving active blocks descend by exactly one row-step (`ROW_STEP = 68`).
4. A deterministic top row is generated at canonical `rowOriginY` with stable IDs (`gen_r{nextRowIndex}_c{col}`) and deterministic HP.
5. Danger line evaluation: If any active block's bottom reaches or crosses `DANGER_LINE_Y = 1060` (`block.y + block.height >= 1060`), the authoritative status becomes terminal (`isGameOver: true`), blocking further shots.
6. The full authoritative future of a shot includes the next board state (`nextGameState`, `isGameOver`), derived by `FuturePreview` and `Solver` using the identical `applyTurnResult()` pipeline.
7. Presentation visually interpolates block descent and top row entrance over 220ms, while authoritative state is updated immediately.

## Strategic Core Pass 01 — Ball Economy and HUD Cleanup
**Ball count is a persistent strategic resource. Deterministic +1 Ball pickups can increase the next-turn volley size.**
1. **Semantic HUD Cleanup**: HITS, numeric ANGLE, STABILITY %, and raw SCORE were removed from standard gameplay. Immediate consequence displays DAMAGE and DESTROYED; contextual summary displays +BALL only when acquired.
2. **Deterministic Pickups**: Generated in empty column corridors of newly spawned rows based purely on GameState at configurable cadence.
3. **Collision & Acquisition**: Live balls pass through pickups without deflection or absorbing damage. Collected at most once per volley.
4. **Persistent Effect**: Each collected pickup increments `GameState.balls.available` starting on the subsequent turn.
5. **Exact Parity**: Gameplay, Future Preview, Solver, replay, and serialization are 100% identical.

## Playfield Geometry and Ball Scale Pass 01 (Parts A & B)
1. **Canonical Edge-Sealed Playfield Geometry**:
   - Single source of truth `BOARD_GEOMETRY` in `src/config.js` (`playableLeft = 8`, `playableRight = 712`, `columnCount = 8`, `interColumnGap = 12`, `blockWidth = 77.5`, `blockHeight = 56`).
   - `columnX(col)` helper shared by level fixtures (`src/levels/levels.js`) and generated top rows (`src/domain/progression.js`).
   - Occupied edge columns seal against playable left/right walls with an 8-unit clearance (< 12-unit ball diameter), eliminating accidental wall-scrape passage for standard balls ($r=6$).
   - Intentionally empty edge columns leave open corridors of 97.5 units ($97.5 \gg 12$), fully traversable.
2. **Launcher-Baseline Return / Exit Line**:
   - Downward-moving balls (`vy > 0`) exit when their center reaches/crosses `launcher.y = 1180` (rather than canvas bottom 1280).
   - Upward-moving balls at spawn (`vy < 0`) do not self-exit.
   - The first downward crossing sets `firstExitX` and next-turn launcher position.
   - Balls never remain active below the baseline.
3. **Variable Ball Scale (Part C)**:
   - Preserved as future candidate design; no variable-ball-size system implemented in this pass.

## Finite-Wave Campaign Stage Architecture (schemaVersion 1.2)
1. **Model**: Implements Model D (Finite Wave / Row Campaign Stage) from `docs/STAGE_ARCHITECTURE_DECISION_01.md`. Infinite procedural generation is disabled for campaign stages.
2. **Stage State Fields**:
   - `stageStatus`: `'active' | 'won' | 'failed'`
   - `waveIndex`: number of waves introduced so far (starts at 0)
   - `totalWaves`: finite wave sequence length (validation stage L01 has `totalWaves: 3`)
   - `isGameOver`: convenience boolean (`stageStatus !== 'active'`)
3. **Wave Progression**:
   - Exactly one wave advances per completed volley while `waveIndex < totalWaves`.
   - After `waveIndex >= totalWaves`, no further rows or top-row pickups are generated.
4. **Win & Fail Conditions**:
   - Emptying the board while waves remain does NOT trigger a win (`stageStatus` remains `'active'`).
   - Stage is WON when all waves have entered (`waveIndex >= totalWaves`) AND all active blocks on the board are cleared.
   - Danger-line breach (`block.y + block.height >= 1060`) produces FAILED immediately.
   - Terminal states (WON and FAILED) cannot advance further.
5. **Parity**:
   - Live Gameplay, Future Preview, Solver, replay, and serialization are 100% deterministic and agree on `stageStatus`, `waveIndex`, and `totalWaves`.

## Case-study status
The dense level arrangements in `src/levels/levels.js` are migration fixtures inspired by the mobile screen-density lesson from Bricks Breaker Quest. They are not claimed as final level design and should be replaced/validated later.

## Legacy files
`legacy/` preserves the original prototype and the latest pre-migration Future Engine prototype for traceability. Do not continue feature work directly in those files.


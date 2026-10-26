# PROJECT VECTOR — Locked vs Editable Systems

## LOCKED — do not change without an explicit decision record
- Deterministic rule: same GameState + same input = same result.
- One authoritative simulation contract: `simulateTurn()`.
- One authoritative turn progression pipeline: `applyTurnResult()`.
- Finite-Wave Campaign Stage State Machine: Each stage owns a finite wave count (`totalWaves`), advancing at most one wave per completed volley until exhausted. Rows cease generating once all waves have entered.
- Stage status model: Single authoritative enum `stageStatus: 'active' | 'won' | 'failed'`.
- Win rule: Stage is WON only when all waves have entered (`waveIndex >= totalWaves`) AND no active blocks remain on the board.
- Failure rule: Danger line breach (`block.y + block.height >= 1060`) produces FAILED immediately.
- Terminal states (WON and FAILED) cannot advance further.
- The full authoritative future of a shot includes the next board state (`nextGameState`, `stageStatus`, `isGameOver`), not only immediate collision results.
- Danger line failure rule: `block.y + block.height >= DANGER_LINE_Y (1060)` for any active block with `value > 0`.
- Preview, gameplay, solver, replay, and validation must call the same physics implementation and progression pipeline.
- Fixed-step simulation.
- Swept circle-vs-AABB collision with corner handling.
- Bottom boundary is EXIT at launcher baseline (`y = launcher.y = 1180`), not canvasHeight. Downward-moving balls exit when their center reaches/crosses launcher.y; upward-moving balls at spawn do not self-exit. The first ball to exit at the baseline determines the horizontal launcher origin for the next turn. Balls never remain active below the baseline.
- Canonical Edge-Sealed Geometry (`BOARD_GEOMETRY`, `columnX(col)`): full 8-column rows seal against side walls (8-unit gap < 12-unit ball diameter), eliminating accidental wall-scrape channels while preserving deliberate empty-column corridors (97.5-unit width).
- State carries independent `schemaVersion` (v1.2), `gameVersion`, and `physicsVersion`.
- Canonical player aim domain = full upward hemisphere, 1°–179° (superseding earlier 1°–89° restriction).
- The player must be able to inspect consequences before launch. Prediction is the product's core differentiator.
- Ball count is a persistent strategic resource. Deterministic +1 Ball pickups can increase the next-turn volley size. Acquisition happens at most once per pickup without deflection.
- HUD Semantics: HITS, numeric ANGLE readout, STABILITY %, and raw SCORE are removed from standard gameplay. Default HUD displays DAMAGE, DESTROYED, and contextual +BALL only when acquired.

## EDITABLE — expected iteration surface
- Board descent visual transition duration (~180–260ms) and interpolation easing.
- Mobile screen composition and HUD hierarchy.
- Visual identity, color, typography, effects.
- How prediction is visually encoded on trajectory/blocks.
- Level geometry and content fixtures.
- Gesture ergonomics, provided the final input angle is explicit and deterministic.
- Progression, modes, audio, polish.

## TOOLING-ONLY — do not expose as default player UI
- Solver sweeps.
- Angle laboratory charts and numeric angle readout.
- State fingerprints.
- raw event streams.
- collision/debug overlays.
- objective scoring internals and STABILITY % / robustness calculations.

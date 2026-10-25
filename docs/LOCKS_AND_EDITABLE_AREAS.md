# PROJECT VECTOR — Locked vs Editable Systems

## LOCKED — do not change without an explicit decision record
- Deterministic rule: same GameState + same input = same result.
- One authoritative simulation contract: `simulateTurn()`.
- One authoritative turn progression pipeline: `applyTurnResult()`.
- Every completed volley advances the board by one row (`ROW_STEP = 68`) and produces a deterministic new top row (`TOP_ROW_Y = 220`).
- The full authoritative future of a shot includes the next board state (`nextGameState`, `isGameOver`), not only immediate collision results.
- Danger line failure rule: `block.y + block.height >= DANGER_LINE_Y (1060)` for any active block with `value > 0`.
- Preview, gameplay, solver, replay, and validation must call the same physics implementation and progression pipeline.
- Fixed-step simulation.
- Swept circle-vs-AABB collision with corner handling.
- Bottom boundary is EXIT, not reflect. The first ball to exit through the bottom determines the horizontal launcher origin for the next turn.
- State carries independent `schemaVersion` (v1.1), `gameVersion`, and `physicsVersion`.
- Canonical player aim domain = full upward hemisphere, 1°–179° (superseding earlier 1°–89° restriction).
- The player must be able to inspect consequences before launch. Prediction is the product's core differentiator.

## EDITABLE — expected iteration surface
- Board descent visual transition duration (~180–260ms) and interpolation easing.
- Mobile screen composition and HUD hierarchy.
- Visual identity, color, typography, effects.
- How prediction is visually encoded on trajectory/blocks.
- Level geometry and content fixtures.
- Gesture ergonomics, provided the final input angle is explicit and deterministic.
- Which consequence metrics are player-facing.
- Progression, modes, audio, polish.

## TOOLING-ONLY — do not expose as default player UI
- Solver sweeps.
- Angle laboratory charts.
- State fingerprints.
- raw event streams.
- collision/debug overlays.
- objective scoring internals.

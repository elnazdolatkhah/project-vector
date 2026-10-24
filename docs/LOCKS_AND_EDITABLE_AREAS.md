# PROJECT VECTOR — Locked vs Editable Systems

## LOCKED — do not change without an explicit decision record
- Deterministic rule: same GameState + same input = same result.
- One authoritative simulation contract: `simulateTurn()`.
- Preview, gameplay, solver, replay, and validation must call the same physics implementation.
- Fixed-step simulation.
- Swept circle-vs-AABB collision with corner handling.
- Bottom boundary is EXIT, not reflect.
- No hidden randomness in core physics.
- State carries independent `schemaVersion`, `gameVersion`, and `physicsVersion`.
- Canonical player aim domain = full upward hemisphere, 1°–179° (superseding earlier 1°–89° restriction).
- The player must be able to inspect consequences before launch. Prediction is the product's core differentiator.

## EDITABLE — expected iteration surface
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

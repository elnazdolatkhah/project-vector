# Acceptance Checklist for AI Studio Iterations

A change is accepted only if all applicable checks pass.

## A — Physics / Determinism
- `npm test` passes.
- Same state + angle produces identical final blocks, stats, and event stream.
- No-tunneling regression remains green.
- Bottom remains an exit.
- Physics constants are not duplicated in UI files.

## B — Prediction Contract
- Preview for angle X and live play for angle X use `simulateTurn()`.
- Preview stats equal actual post-shot stats for the same state/input.
- Solver replay equals gameplay result for its chosen angle.
- No UI-only approximation is presented as authoritative.

## C — Mobile UX / Case-study structure
- Tested at 360×800, 390×844, and 412×915 CSS pixels.
- No horizontal scrolling.
- Playfield visually dominates the screen.
- Permanent top/bottom chrome stays shallow.
- No central analytics dashboard obscures the board.
- Aim is direct on the playfield.
- Prediction is spatial: trajectory + affected bricks.
- Primary play is feasible with one hand.

## D — PROJECT VECTOR identity
- The UI does not simply reveal one “correct answer.”
- The player can explore different futures before release.
- Trade-offs remain inspectable rather than collapsed into one visible score.
- Failure/result remains understandable and deterministic.

## E — Scope guard
Before adding new modes, progression, final art, narrative systems, or procedural generation, Gates A–D in the project audit must be demonstrably satisfied.

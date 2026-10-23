# PROJECT VECTOR — Master Build Spec v1.0 (Migration Baseline)

**Status:** Canonical for the AI Studio migration baseline unless superseded by an explicit accepted decision.

## 1. Product thesis

PROJECT VECTOR is a deterministic mobile predictive-strategy puzzle.

The player does not merely aim and discover the outcome after launch. The player can inspect possible outcomes before commitment, compare them, and choose which predicted future becomes real.

Core interaction:

**Drag = explore a future → Release = choose that future.**

Design principle:

**The game should make futures visible without making the decision for the player.**

The challenge should come from comparing visible or inspectable trade-offs, not from hidden or random physics.

## 2. Core philosophy

PROJECT VECTOR is about possibility, consequence, choice, trade-off, and sacrifice.

A mechanically stronger immediate result does not always have to be the best strategic future. Future iterations may compare damage, destruction, robustness, next-turn potential, target priority, or other explicit consequences.

Do not collapse the player-facing experience into one automatic “BEST” answer.

## 3. Determinism contract

The fundamental rule is:

**Same GameState + same input = same result.**

Core physics contains no hidden randomness.

Gameplay, preview, solver, replay, and validation must all use the same authoritative simulation implementation.

The canonical public contract is:

`simulateTurn(gameState, angleDeg, options)`

Separate approximate physics for UI preview or solver is forbidden.

## 4. Coordinate and input contract

Reference world:
- width: 720
- height: 1280
- origin: top-left
- +X: right
- +Y: down

Canonical launch angle range for this baseline:
- 1°–89°
- 0° points right
- 90° points up

Velocity:
- `vx = speed * cos(theta)`
- `vy = -speed * sin(theta)`

A later prototype widened the range to 1°–179° without an accepted decision. This migration restores 1°–89°. Any widening requires a new decision record.

## 5. Physics reference

Canonical configuration:
- ball radius: 6
- ball speed: 10
- gravity: 0
- fixed timestep: 1/60
- spawn interval: 0.08 s
- max simulation time: 30 s
- collision epsilon: 0.0001
- max collisions per step: 8

Boundary behavior:
- left: reflect
- right: reflect
- top: reflect
- bottom: EXIT

Ball-to-ball collision is disabled in the MVP.

Block hit:
- valid collision reduces block value by exactly 1
- when value <= 0, block becomes inactive immediately

Collision requirements:
- swept collision / continuous collision detection
- deterministic corner normals
- move to exact impact point
- apply damage
- reflect
- epsilon separation
- continue remaining timestep
- bounded multiple collisions in one step

## 6. State model

GameState must carry enough information to reproduce the same simulation result.

Required version fields:
- schemaVersion
- gameVersion
- physicsVersion

Game state includes:
- levelId
- turn
- score
- available ball count
- launcher
- block state

Serialization and deserialization must preserve the next-turn result.

## 7. Solver contract

The solver does not own physics.

It generates candidate angles and calls `simulateTurn()` for each candidate on an isolated copy of GameState.

Initial objectives may include:
- damage
- destruction

Internal solver metrics may include robustness and solution density.

Solver metadata and tie-breaking must remain deterministic.

Tooling such as solver sweeps and angle laboratory charts must not become the default player-facing UI.

## 8. Future Engine

The Future Engine is a player-facing interpretation of the same authoritative simulation.

It may expose:
- predicted trajectory
- projected hit blocks
- projected destroyed blocks
- damage
- destroyed count
- robustness/stability
- later, future-state potential

Prediction must be spatially integrated into the board wherever possible.

Avoid large analytics panels covering the playfield.

## 9. Mobile UX reference

Bricks Breaker Quest is a structural case study, not a copying target.

Learn from:
- portrait playfield dominance
- shallow permanent HUD
- dense readable bricks
- launch origin near the lower field
- direct one-finger aiming
- minimal obstruction of play space

Do not copy its branding, art, exact level layouts, or proprietary visual identity.

PROJECT VECTOR must differ through pre-shot visible futures.

## 10. Five concept-test levels

The initial five-level sequence remains:
1. L01 — Direct
2. L02 — Reflection
3. L03 — Double Reflection
4. L04 — Multiple Solutions
5. L05 — Precision

Current dense layouts in `src/levels/levels.js` are migration fixtures, not final production levels.

## 11. MVP success criteria

The MVP must prove:
- player can choose an angle and launch
- reference physics is obeyed
- wall reflection is correct
- no tunneling through blocks
- hits change block state
- same state + angle repeats exactly
- multiple angles can be tested through the same physics
- preview result matches committed gameplay result
- solver result replays identically through gameplay simulation
- the player can understand and compare possible futures before commitment

## 12. Locked architecture

Dependency direction:

```text
UI / Renderer
      ↓
Future Engine / Solver
      ↓
simulateTurn()
      ↓
Physics + GameState
```

Renderer must never decide collision or mutate authoritative physics state.

## 13. Deferred until core validation

Do not prioritize these before prediction/determinism/mobile UX are proven:
- final art
- narrative systems
- progression economy
- accounts
- multiplayer
- ads/monetization
- procedural generation
- power-ups
- complex moving obstacles
- gravity/spin/friction
- ball-to-ball collision

## 14. Validation gates

Gate A — Physics and determinism
- regression harness
- wall/corner/grazing/no-tunneling/multi-collision fixtures
- repeated identical event stream
- preview/gameplay/solver identity

Gate B — Canonical GameState
- validation
- serialization equivalence
- version handling
- state fingerprint

Gate C — Solver as design instrument
- explicit tie-break
- robustness
- solution density
- solvability checks

Gate D — Game idea validation
- five-level vertical slice
- mobile playtest
- verify that visible futures are understandable and meaningful
- distinguish confusion caused by UI from actual strategic difficulty

## 15. Current migration rule

Visual/UI iteration is encouraged.

Physics rules, state schema, solver semantics, angle domain, and the `simulateTurn()` contract are locked unless a failing test proves a defect or an explicit design decision supersedes them.

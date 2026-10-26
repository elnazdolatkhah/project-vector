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

Canonical player aim domain = full upward hemisphere, 1°–179°:
- 1°–179°
- 0° points right
- 90° points up
- 180° points left

Velocity:
- `vx = speed * cos(theta)`
- `vy = -speed * sin(theta)`

The earlier 1°–89° restriction is superseded by this intentional design correction to allow exploring the complete upward hemisphere.

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
- left: reflect (x = 0; visual court wall at 8)
- right: reflect (x = 720; visual court wall at 712)
- top: reflect (y = 0; visual court wall at 8)
- bottom: EXIT at launcher baseline (`y = launcher.y = 1180`). Downward-moving balls (`vy > 0`) exit when their center reaches/crosses the launcher baseline. Upward-moving balls at spawn (`vy < 0`) do not self-exit. The first ball to reach the baseline determines next-turn launcher X (`nextLauncher.x`, clamped to `[ballRadius, canvasWidth - ballRadius]`). Balls never remain active below the launcher baseline.

Playfield geometry (Canonical Edge-Sealed Geometry):
- `playableLeft`: 8
- `playableRight`: 712
- `columnCount`: 8
- `interColumnGap`: 12
- `blockWidth`: 77.5
- `blockHeight`: 56
- `columnX(col) = playableLeft + col * (blockWidth + interColumnGap)`
- An occupied edge column (col 0 or col 7) leaves only an 8-unit gap to the outer boundary, which is strictly less than the standard ball diameter (12 units), sealing the route against wall-scraping. An intentionally empty edge column provides a 97.5-unit corridor, freely traversable.

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

GameState must carry enough information to reproduce the same simulation result and turn-to-turn progression.

Required version fields:
- schemaVersion (v1.1)
- gameVersion
- physicsVersion

Game state includes:
- levelId
- turn
- score
- available ball count
- launcher (x, y)
- block state (id, x, y, width, height, value, active)
- seed (deterministic progression seed)
- nextRowIndex (deterministic row step counter)
- isGameOver (authoritative terminal status)

Serialization and deserialization must preserve the next-turn result and future row generation.

## 6.1 Board progression & Finite-Wave Campaign Stage State Machine (schemaVersion 1.2)

Authoritative stage architecture:
- Each stage has a finite deterministic wave count (`totalWaves`, e.g. 3 for validation stage L01).
- Single explicit stage status enum: `stageStatus: 'active' | 'won' | 'failed'`.
- `waveIndex`: number of incoming waves consumed so far (starts at 0).
- `isGameOver`: convenience boolean (`stageStatus !== 'active'`).

Authoritative turn pipeline:
`applyTurnResult(gameState, simulationResult) -> nextGameState`

Progression rules:
1. Terminal check: If `stageStatus === 'won'` or `stageStatus === 'failed'`, state does not advance further.
2. Volley shot consequences resolve; destroyed blocks are filtered out (destroyed blocks do not descend).
3. The first baseline exit determines next-turn launcher X.
4. All surviving active blocks descend by exactly one row-step (`ROW_STEP = 68`).
5. Finite wave entry:
   - If unconsumed waves remain (`waveIndex < totalWaves`), exactly one new row of blocks and optional pickups enters at canonical `rowOriginY` (`columnX(col)`), and `waveIndex` advances by 1.
   - After the final wave has entered (`waveIndex >= totalWaves`), no further rows or top-row pickups generate.
6. Danger line evaluation: If any active block reaches or crosses the danger line (`block.y + block.height >= DANGER_LINE_Y = 1060`), `stageStatus` becomes `'failed'`.
7. Stage completion evaluation:
   - The stage CANNOT be won while future waves remain (`waveIndex < totalWaves`), even if the current board has 0 blocks.
   - After all waves have entered (`waveIndex >= totalWaves`), if no active blocks remain on the board and the danger line has not been breached, `stageStatus` becomes `'won'`.
   - Otherwise, `stageStatus` remains `'active'`.
8. The next turn begins from that resulting board state.

Presentation rule:
- Authoritative state updates immediately.
- Presentation interpolates visual block descent and new row entrance over a brief ~220ms transition.
- Aiming and prediction are hidden during the committed volley and the ~220ms board transition.

## 7. Solver contract

The solver does not own physics.

It generates candidate angles and calls `simulateTurn()` for each candidate on an isolated copy of GameState, evaluating candidates against the canonical post-turn transition `applyTurnResult()`.

Candidate results expose:
- `score` and `stats`
- `nextLauncher`
- `nextGameState`
- `isGameOver`

Initial objectives may include:
- damage
- destruction

Internal solver metrics may include robustness and solution density.

Solver metadata and tie-breaking must remain deterministic. Replay of the best angle produces the exact same `nextGameState` as live gameplay.

Tooling such as solver sweeps and angle laboratory charts must not become the default player-facing UI.

## 8. Future Engine

The Future Engine is a player-facing interpretation of the authoritative simulation and progression pipeline.

Accepted future rule:
**The full authoritative future of a shot includes the next board state, not only immediate collision results.**

For any candidate angle, Future Preview derives the full authoritative post-turn state:
current state → simulate volley → first-return launcher → surviving blocks descend → deterministic new row enters → failure check → `nextGameState`.

It exposes:
- predicted trajectory
- projected hit blocks
- projected destroyed blocks
- damage
- destroyed count
- robustness/stability
- `nextLauncher`
- `nextGameState`
- `isGameOver`

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

Visual/UI iteration is encouraged.

Physics rules, state schema, solver semantics, angle domain, and the `simulateTurn()` contract are locked unless a failing test proves a defect or an explicit design decision supersedes them.

## 16. Ball Count Economy and Pickups (Strategic Core Pass 01)

**Ball count is a persistent strategic resource. Deterministic +1 Ball pickups can increase the next-turn volley size.**

- **Data Representation**: Pickups are represented as `{ id, x, y, radius, active }` on `GameState`.
- **Spawn Rules**: Deterministic top-row placement aligned to canonical corridors (empty columns) at configurable cadence (defaults to roughly 1 pickup every 2–4 rows). IDs are unique and stable (`pickup_r{rowIndex}_c{col}`).
- **Acquisition**: Live balls pass through pickups without deflection or HP absorption. Intersecting an active pickup collects it at most once per volley.
- **Persistence**: Collected pickups increment `GameState.balls.available` starting on the subsequent turn. The current volley does not retroactively gain balls.
- **HUD Semantics**: HITS, numeric ANGLE, STABILITY %, and raw SCORE are removed from standard gameplay. Immediate summary exposes DAMAGE and DESTROYED; contextual summary displays `+BALL` only when a candidate future acquires a pickup.
- **Parity**: Identical across gameplay, Future Preview, Solver, replay, and serialization.

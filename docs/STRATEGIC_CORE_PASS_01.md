# PROJECT VECTOR — Strategic Core Pass 01

Status: EXECUTION BRIEF
Depends on: CORE_LOOP_QUALITY_AUDIT_01.md

## Goals

This pass has two goals only:
1. clean up player-facing information so every HUD element is meaningful;
2. turn ball count into a real strategic resource through deterministic +1 Ball pickups.

Do not add unrelated features.

## A — HUD semantic cleanup

Remove from standard gameplay:
- HITS
- numeric angle readout
- STABILITY %
- raw SCORE as a primary visible optimization metric

Keep player-facing:
- DAMAGE
- DESTROYED
- ball count near launcher
- turn
- stage/scenario label
- failure warning when relevant
- +BALL preview only when a candidate future acquires a ball pickup

Angle remains internal and may be available in debug/Angle Lab tooling.
Robustness remains internal for solver/design analysis.

## B — Ball Pickup mechanic

Introduce a deterministic pickup object representing +1 Ball.

### Spawn rules
- Pickups may appear in generated top rows.
- Placement must be deterministic from authoritative GameState.
- Do not use Math.random().
- Pickup IDs must be unique/stable.
- Pickup spawn frequency must be configurable and deterministic.
- For v1, keep frequency conservative; target roughly one pickup opportunity every 2–4 generated rows unless deterministic pattern logic yields an equivalent cadence.

### Collision/acquisition rule
- A pickup is acquired when any live ball intersects it during the authoritative volley.
- Acquisition happens at most once per pickup.
- Pickup collision must be deterministic and represented in authoritative simulation events/results.
- Pickup does not behave like a damageable brick.
- After acquisition, it disappears from the board.

### Persistent effect
- Each acquired pickup adds exactly +1 to GameState.balls.available for subsequent turns.
- The current volley does not retroactively gain additional balls.
- The increased count applies starting next turn.

### State contract
Ball acquisition must be represented identically across:
- gameplay
- Future Preview
- Solver
- replay
- serialize/deserialize

GameState must persist the resulting balls.available.

## C — Future Preview integration

For a candidate angle, preview must expose:
- damage
- destroyed
- ballPickupsCollected
- next ball count
- next launcher
- next board state
- game-over risk

Player-facing summary should show +1 BALL only when applicable.

Do not show HITS or STABILITY.

Do not add a giant analytics panel.

## D — Solver integration

Solver candidates must include ball pickup results in nextGameState.

Do not yet define a single final BEST score combining destruction and ball acquisition.

Preserve current destruction/damage objectives for compatibility, but expose pickup count as an explicit candidate dimension.

## E — Rendering

Pickup visual must fit Minimal Precision:
- simple circular or diamond-like token;
- clearly different from blocks;
- high readability;
- no heavy glow;
- small +1 / ball symbol allowed;
- must not be confused with live balls.

Future preview should visibly indicate when the pickup will be collected.

## F — Tests

Add tests for at least:
1. deterministic pickup generation;
2. pickup IDs stable/unique;
3. pickup acquired by collision;
4. pickup acquired only once;
5. current volley ball count unchanged;
6. next-turn ball count increments by exactly one;
7. multiple pickups increment by the correct total if allowed by board state;
8. serialize→load preserves new ball count;
9. Preview next ball count == gameplay next ball count;
10. Solver replay next ball count == gameplay;
11. destroyed/removed pickup does not persist into descended board;
12. full board progression still generates/descent correctly with pickups present;
13. all prior tests remain green.

## G — Documentation

Update Master Spec, Locks, Migration Notes, and Core Loop audit status.

Record:
**Ball count is a persistent strategic resource. Deterministic +1 Ball pickups can increase the next-turn volley size.**

## H — Explicitly defer

Do not implement yet:
- final stage win condition;
- complex pickup types;
- multiball multipliers;
- power-ups;
- crit/armor mechanics;
- final solver utility;
- final difficulty curve;
- final visual polish.

## Validation report

After implementation report:
- total tests pass/fail;
- modified files;
- exact deterministic pickup generation rule;
- exact collision/acquisition rule;
- how next-turn ball count is stored;
- how Preview and Solver remain identical;
- player-facing HUD before/after;
- explicit confirmation HITS, angle, STABILITY and raw SCORE were removed from default HUD;
- Physics changes summary.
# PROJECT VECTOR — Core Loop Quality Audit 01

Status: CURRENT DESIGN AUDIT
Date: 2026-10-25

## Purpose

This audit identifies prototype residue, redundant information, missing strategic systems, and unresolved product semantics before further visual polish.

The goal is not to add features indiscriminately. The goal is to make every persistent mechanic and HUD element earn its place.

## 1. HUD metric redundancy — CONFIRMED

Current Future Preview exposes hits, destroyed, damage, and robustness / stability.

At present every valid block collision reduces HP by exactly 1. Therefore hits == damage for the current ruleset.

Decision:
- Remove HITS from the player-facing HUD.
- Keep DAMAGE and DESTROYED as distinct immediate-outcome metrics.
- Keep hits internally for diagnostics/tests if useful.
- Do not reintroduce HITS until mechanics exist where one hit can deal non-unit damage, be absorbed, crit, pierce, etc.

## 2. Angle readout — DEBUG, NOT CORE PLAYER INFORMATION

The numeric angle does not currently enable a meaningful player decision that is not already represented spatially by the trajectory.

Decision:
- Remove numeric degree readout from standard gameplay.
- Preserve angle internally.
- Angle may remain available in developer/debug/Angle Lab tooling.

## 3. Ball count is currently not strategic — CONFIRMED

Current ball counts are level fixtures: L01=18, L02=20, L03=22, L04=24, L05=24.

Within a stage, ball count does not change. Therefore the ×N launcher label is currently informative but not strategically dynamic.

Required improvement:
- Ball count becomes a persistent resource.
- Add deterministic +1 Ball pickups to generated rows.
- Collecting one increases GameState.balls.available for future turns.
- Pickup acquisition must be identical across gameplay, Future Preview, Solver, replay, and serialization.

This creates genuine future trade-offs: more destruction now versus less destruction plus stronger future ball economy.

## 4. Stage semantics are unresolved — HIGH PRIORITY

Current progression continuously descends surviving blocks, generates a new row, and checks failure. There is a deterministic lose condition but no authoritative win / stage-completion condition.

Therefore current L01–L05 are test scenarios, not complete production stages.

Decision for current prototype:
- Treat L01–L05 as scenario fixtures / calibration stages, not final campaign levels.
- Do not build final progression UI around them yet.

Required later decision: choose one production stage model: finite turn survival, finite wave stage, target-clear stage with bounded generation, endless survival, or a hybrid campaign plus endless mode.

## 5. Score is currently arbitrary — PROTOTYPE RESIDUE

Current score is based on hits plus a destruction bonus and has no validated player-facing purpose.

Decision:
- Keep score provisional/internal.
- Do not let score drive strategy yet.
- Do not polish score presentation until stage goals are defined.

## 6. STABILITY is mathematically real but player semantics are weak

Current robustness samples nearby angles using an internal utility based on destruction and damage.

Decision:
- Keep robustness internally as a design/solver metric.
- Remove STABILITY % from the default HUD for now.
- Reintroduce only if the game explicitly teaches forgiving versus fragile futures as a mechanic.

## 7. Future Engine knows next state, but UI underuses it — CORE DIFFERENTIATOR GAP

The engine now computes immediate damage/destruction, return point, descended board, generated next row, and failure state.

But player-facing preview still emphasizes current-volley trajectory and immediate block damage.

Required future work: communicate immediate consequence, next launcher position, next board pressure/danger, and important resource pickup opportunities spatially without turning the screen into a dashboard.

## 8. Solver objective is still too myopic

The solver ranks mainly by destruction or damage even though it computes nextGameState.

Required future work: internal evaluation dimensions should eventually include danger margin, future launcher quality, ball acquisition, remaining total HP, board accessibility, and terminal-state avoidance.

Do not collapse these into one player-visible BEST score yet.

## 9. Row generation is deterministic but balance is provisional

Current 8 corridor patterns and turn-based HP formula are technically valid but not yet a designed difficulty curve.

Decision:
- Keep architecture.
- Treat pattern library and HP curve as provisional.
- Tune difficulty only after ball economy and stage semantics exist.

## 10. Danger line is meaningful but presentation should remain restrained

Danger line is authoritative and useful. Keep it as a gameplay boundary, but avoid over-labeling it permanently if the rule becomes visually obvious.

# Priority Order

## P0 — semantic cleanup
1. Remove player-facing HITS.
2. Remove numeric angle from standard gameplay.
3. Remove player-facing STABILITY for now.
4. Keep DAMAGE + DESTROYED only as immediate summary.

## P0 — strategic depth
5. Add deterministic Ball Pickup / ball-count progression.

## P1 — unique product identity
6. Design next-state preview language.

## P1 — game structure
7. Decide production stage / win-condition model.

## P2 — strategic solver
8. Add next-state evaluation dimensions.

## P2 — balance
9. Tune row patterns, HP growth, pickup frequency, stage difficulty.

# Recommended HUD after semantic cleanup

Persistent:
- stage/scenario identifier
- turn
- ball count near launcher
- reset / navigation where needed

Contextual future summary:
- DMG
- DESTROYED
- +BALL if applicable
- explicit danger / terminal warning only when relevant

Hidden from default gameplay:
- HITS
- numeric ANGLE
- STABILITY %
- raw SCORE as primary metric
- solver objective values
- state fingerprints / debug telemetry
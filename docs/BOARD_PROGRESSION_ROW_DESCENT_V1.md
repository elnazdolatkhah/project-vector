# PROJECT VECTOR — Board Progression / Row Descent v1

Status: EXECUTION BRIEF
Scope: Core loop / deterministic next-state
Priority: Before further visual polish

## Product intent

PROJECT VECTOR must not behave as a static board where only HP changes.

Each committed volley advances the game state.

After a volley:
1. direct shot consequences resolve;
2. the first bottom exit determines next-turn launcher X;
3. surviving blocks descend exactly one row;
4. a new row is generated at the top;
5. the next turn begins from that resulting board state.

This turn-to-turn pressure is part of the core challenge.

The player is choosing not only a shot result, but a future board.

## Core principle

The authoritative next state must be identical across:
- gameplay;
- Future Preview;
- Solver;
- replay;
- serialization / reload.

No subsystem may invent or approximate its own board progression.

## 1 — Row geometry

Introduce a canonical row-step value derived from level/block layout data.

Requirements:
- all active blocks descend by exactly one row-step after volley completion;
- descent is deterministic;
- do not move blocks during the volley;
- descent occurs only after authoritative shot resolution;
- block coordinates remain data/state, not renderer-only offsets.

Do not hard-code arbitrary pixel shifts in App.tsx.

## 2 — New row generation

Add deterministic top-row generation.

Requirements:
- generation must be reproducible from GameState;
- no Math.random() or hidden randomness;
- same state + same turn progression = same new row;
- row content may be simple for v1 but must be data-driven;
- generated block IDs must be unique and stable;
- generated HP values must be deterministic;
- generated layout must fit canonical columns / board width.

For the first implementation, prefer a simple deterministic generator over a complex procedural system.

Acceptable v1 strategy examples:
- turn-seeded deterministic pattern table;
- deterministic PRNG with explicit seed stored in GameState;
- indexed preset row library.

Choose the simplest architecture that remains reproducible and testable.

## 3 — Danger line / failure condition

Introduce a canonical danger boundary near the bottom of the playable block region.

Rule:
- after row descent and new-row insertion, if any active block crosses or reaches the danger line according to the chosen block-boundary rule, the state becomes failed / game-over.

This failure state must be authoritative.

Define the exact geometric rule explicitly in code and documentation.

Do not use UI-only collision with the launcher.

## 4 — GameState additions

Extend GameState only as needed for deterministic progression.

Likely state fields may include:
- progression seed or row-generator state;
- next generated row index;
- failure / terminal status.

Do not duplicate derived values unnecessarily.

Any schema change requires:
- schemaVersion update if appropriate;
- validation update;
- serialization/deserialization support;
- fingerprint stability update;
- migration notes.

## 5 — Authoritative turn pipeline

Create one canonical state-transition function for a committed turn.

Recommended shape:

`applyTurnResult(gameState, simulationResult) -> nextGameState`

or equivalent.

It should own:
- block result from the volley;
- next launcher X from first bottom exit;
- row descent;
- new-row generation;
- turn increment;
- score update;
- failure-state evaluation.

Do not spread these rules across App.tsx.

UI should call the domain/core transition.

## 6 — Simulation result contract

Simulation remains responsible for the volley itself.

Expose only the authoritative information required by progression, including:
- final block states;
- score/stats/events;
- first bottom-exit X.

Do not move row progression into low-level collision simulation.

Physics and board progression remain separate deterministic layers.

## 7 — Future Preview must include next state

This is critical.

The Future Engine must no longer stop at "what this shot hits."

For any candidate angle, it must be able to derive the full authoritative post-turn state:

**current state
→ simulate volley
→ first-return launcher
→ surviving blocks descend
→ deterministic new row enters
→ failure check
→ next GameState**

Expose enough preview data to inspect:
- immediate damage;
- destroyed blocks;
- next launcher position;
- next board positions;
- newly generated row;
- whether this future produces game over.

Do not yet overload the player-facing UI with all of this.
First make the system correct.

## 8 — Solver contract

Solver candidates must be evaluated against the same full next-state transition.

Do not keep solver evaluation limited to direct destruction only if the domain now exposes full next state.

For v1:
- preserve existing destruction/damage objective compatibility;
- add next-state data to candidate results;
- do not invent a new final player-facing "best" objective yet.

The solver must be able to replay the exact same resulting next state through gameplay.

## 9 — Presentation

After volley completion:

- blocks visually descend together in a short controlled transition;
- new top row enters during the same transition;
- launcher moves/settles to authoritative next X;
- then aim-ready state appears.

Important:
- authoritative state changes immediately in the domain;
- descent animation is presentation-only interpolation from old state to new state;
- input may be gated only for the brief board-transition interval if necessary;
- keep total transition short, target ~180–260ms;
- no decorative camera motion.

Prediction must be hidden during committed volley and board-transition animation.

## 10 — Failure presentation

If the resulting state is failed:
- do not immediately add a complex game-over screen;
- expose a minimal terminal state for validation;
- prevent further launches;
- renderer may show a restrained danger/failure indication.

Final game-over UX is deferred.

## 11 — Do not change

Do not modify:
- collision mathematics;
- fixedDt;
- ballSpeed;
- reflection;
- swept collision;
- canonical 1°–179° input range;
- ghost prediction motion language;
- spawnInterval;
- return-point first-exit rule.

## 12 — Tests

Add regression coverage for at least:

1. surviving blocks descend exactly one row;
2. destroyed blocks do not descend;
3. generated top row is deterministic;
4. same state + same angle produces identical full next GameState;
5. first-exit launcher X survives into next state;
6. preview next state == gameplay next state;
7. solver replay next state == gameplay next state;
8. serialize → load preserves future row generation;
9. unique block IDs remain stable after generation;
10. failure triggers deterministically at danger line;
11. no failure when blocks remain above danger line;
12. full 1°–179° aiming still works after progression;
13. turn increments exactly once per volley;
14. new row is generated exactly once per completed volley.

Run the complete suite.

## 13 — Documentation

Update:
- PROJECT_VECTOR_MASTER_SPEC_v1.0.md
- LOCKS_AND_EDITABLE_AREAS.md
- MIGRATION_NOTES.md
- architecture docs if a new domain transition module is added.

Record the accepted rule:

**Every completed volley advances the board by one row and produces a deterministic new top row.**

Also record:

**The full authoritative future of a shot includes the next board state, not only immediate collision results.**

## 14 — Validation report

After implementation, report:
- total tests pass/fail;
- modified files;
- any schema/version changes;
- exact row-step definition;
- exact danger-line rule;
- exact deterministic row-generation method;
- exact authoritative next-state function;
- how Future Preview derives the full next state;
- how Solver uses/replays the same next state;
- exact board-transition animation duration;
- explicit confirmation that physics collision rules are unchanged.

## Acceptance standard

This pass is accepted only if a shot deterministically produces the same:
- block damage/destruction;
- first return point;
- descended surviving board;
- generated new row;
- terminal/failure state;
- next-turn launcher;
across gameplay, preview, solver, replay, and serialized reload.

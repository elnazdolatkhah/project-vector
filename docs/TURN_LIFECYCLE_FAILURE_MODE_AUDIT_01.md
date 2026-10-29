# PROJECT VECTOR — Systematic Turn Lifecycle Failure-Mode Audit 01

Status: RELIABILITY GATE / ANALYSIS-FIRST
Date: 2026-10-29

## Purpose

Before further visual polish or feature work, audit the entire committed-turn lifecycle for latent failure modes.

This pass exists specifically to find defects BEFORE manual playtest exposes them.

Do not assume existing green tests cover lifecycle integration.

# Lifecycle under audit

1. Ready / preview
2. Pointer down / aim
3. Pointer move / future recomputation
4. Pointer cancel / release
5. Shot commitment
6. Ball spawning
7. Dense volley
8. Tail acceleration
9. Ball exits / return-point establishment
10. Final-ball completion
11. applyTurnResult
12. Board transition
13. Terminal-state decision
14. Ready-state restoration / next preview
15. Reset / level switch / unmount at any point

# Audit policy

For each failure mode:

- reproduce or prove impossible;
- classify as CONFIRMED / NOT REPRODUCIBLE / BY DESIGN / TEST GAP;
- fix only confirmed defects;
- add regression coverage;
- do not redesign unrelated systems.

# A — Input lifecycle

Audit:
- pointer down while ready;
- rapid pointer moves;
- pointer release outside canvas after pointer capture;
- pointer cancel;
- pointer up after state became terminal;
- second pointer / multi-touch;
- rapid tap without meaningful drag;
- release while Future Preview debounce is pending;
- release while Future Echo fade timer is pending.

Required invariants:
- one committed volley maximum per gesture;
- no stale preview callback after commitment;
- no shot after cancel;
- no double-launch;
- pointerId ownership remains coherent.

Known suspicion from code audit:
`handlePointerCancel()` clears aiming state but may leave echo/preview timers alive.

# B — Preview lifecycle / stale async work

Audit all timers and RAF callbacks:
- previewTimerRef;
- echoCheckTimerRef;
- echoAnimFrameRef;
- animFrameRef;
- board transition RAF;
- trajectory transition state.

Check for stale callbacks after:
- shot commitment;
- level reset;
- previous/next stage;
- terminal state;
- component unmount.

Required invariant:
no callback created for State A may mutate/render State B after State B replaces it.

# C — Reset and level switching at every phase

Explicitly test Reset / Previous / Next during:
- aiming;
- dense volley;
- 2x tail;
- 6x rapid tail;
- returning-ball slide;
- board transition;
- won overlay;
- failed overlay.

Known high-priority suspicion from code audit:
`setLevel()` cancels `animFrameRef` only when `runningRef.current` is true.
During board transition, `runningRef.current` is false while `transitioningRef.current` is true.
Therefore an old `transitionLoop()` RAF may survive a level reset/switch.

Acceptance:
- switching/resetting instantly invalidates every callback belonging to prior turn/level;
- old transition cannot render or alter new level;
- no late setState from old lifecycle.

Prefer a generation/token cancellation mechanism if needed rather than scattered conditions.

# D — Spawn lifecycle

Audit:
- ball0 spawn;
- final ball spawn;
- allSpawned transition;
- tail scheduler cannot accelerate before allSpawned;
- frame hitch while balls are still spawning;
- stage with 1 ball;
- hypothetical high ball counts.

Required:
- each ball spawns exactly once;
- spawn order deterministic;
- no ball skipped/duplicated;
- presentation tier state does not alter spawn semantics.

# E — Collision edge cases

Audit representative:
- simultaneous/equal-time wall vs block candidate;
- corner collision;
- two adjacent blocks sharing an edge/corner;
- block destroyed by one ball while another reaches same block in same fixed step;
- repeated collision at epsilon boundary;
- very shallow wall grazing;
- maxCollisionsPerStep cap.

Special requirement — CollisionCapReached:
Determine whether reaching the cap can leave a ball:
- embedded in geometry;
- repeatedly generating cap events;
- effectively stuck;
- or producing divergence between Preview and Gameplay.

If cap is purely defensive and unreachable under legal campaign states, prove it with tests.
If reachable, define safe deterministic behavior.

# F — Pickup ordering

Audit:
- pickup immediately before block collision;
- pickup immediately after reflection;
- pickup and exit in same fixed step;
- two balls reaching same pickup in same step;
- pickup already inactive;
- accelerated presentation tiers.

Required:
- pickup collected once;
- deterministic winner/order;
- no collection through blocking geometry;
- identical Preview/Game/Solver result.

# G — Exit / return-point semantics

Audit:
- first two balls exit in same simulation step;
- equal-time exits;
- one ball crosses baseline while another collides;
- firstExitX assignment determinism;
- later exits cannot overwrite firstExitX;
- extreme left/right baseline exit clamp;
- final ball exit.

Required:
`firstExitX` is deterministic and stable.

# H — Returning-ball presentation

Audit the non-authoritative baseline convergence animation:
- multiple exits in same rendered frame;
- 2x/6x tier change while slide is active;
- final physics ball completed but returning slide still active;
- reset/level switch during slide;
- duplicate visual ball IDs between active and returning lists.

Required:
- presentation may delay visual completion briefly but cannot alter authoritative result;
- no ghost ball remains after turn completion.

# I — Watchdog / unresolved simulation

Audit:
- real legal trajectories near 5° and 175°;
- artificial constrained watchdog;
- watchdog during Preview;
- watchdog during Solver;
- watchdog during committed Gameplay if artificially forced.

Required:
- unresolved is never presented as completed;
- no board progression;
- no fake exit;
- same diagnostic semantics across all consumers.

# J — Volley completion race

Audit the exact condition:
`sim.finished && allExitEffectsDone && allReturningDone`

Test:
- destruction effect ends after final exit;
- returning slide ends after sim.finished;
- final event and RAF timing on same frame;
- state update exactly once.

Required:
- applyTurnResult called exactly once;
- turn increments exactly once;
- no duplicate board transitions.

# K — Board transition lifecycle

Audit:
- transition starts with correct previous/current block/pickup sets;
- destroyed blocks do not reappear;
- incoming authored wave appears once;
- pickups descend once;
- launcher settles once;
- reset/switch during transition;
- terminal state reached on same turn transition begins.

Required:
- no double descent;
- no duplicated wave;
- no stale transition after level change.

# L — Terminal-state timing

Audit:
- win on same turn as final ball exits;
- fail on same turn final wave enters;
- potential simultaneous win/fail conditions;
- terminal overlay during/after transition;
- input disabled exactly when terminal;
- reset/level switch still works.

Required semantic priority must match locked stage rules.

# M — Ready-state restoration

Audit:
- futureRef reset and recomputed exactly once;
- old trajectory transition cleared;
- ready fade;
- launcher position matches authoritative next state;
- ball count matches authoritative next state;
- no old return-point indicator;
- no old liveBalls;
- no stale Future Echo.

Known confirmed presentation defect:
`Calculating…` remains visible through the committed volley.

Correct behavior:
during committed volley, hide/replace the future-summary chip entirely rather than claim calculation is ongoing.
Do not perform extra computation merely to change text.

# N — Unmount / resource cleanup

Audit cleanup of:
- main RAF;
- board transition RAF;
- echo RAF;
- preview timeout;
- echo timeout;
- resize listeners;
- pointer capture where relevant.

Required:
no timer/RAF callback survives component teardown.

# O — Frame hitch / background-tab recovery

Audit the `rawDt` clamp behavior when:
- a frame stalls;
- tab becomes hidden and returns;
- device has very low FPS.

Required:
- no physics teleport;
- no duplicate events;
- authoritative progression remains deterministic;
- presentation may take longer but cannot corrupt state.

# P — Rapid user actions / controls

Audit:
- repeated Reset clicks;
- rapid Next/Previous clicks;
- Reset then Next in same short interval;
- controls during running/transitioning.

Decide explicitly whether controls should be disabled during committed volley/transition or safely cancel current lifecycle.

Do not leave ambiguous behavior.

# Q — Test strategy

Add integration/regression tests for confirmed defects and high-risk invariants.

Prefer deterministic harnesses over fragile DOM timing tests where possible.

At minimum cover:
1. pointer cancel clears pending preview/echo work;
2. level/reset during board transition cannot allow stale transition callback;
3. simultaneous/equal-step exits preserve deterministic firstExitX;
4. final-ball completion advances turn exactly once;
5. CollisionCapReached behavior is proven safe or made safe;
6. committed volley does not display stale preview state;
7. no stale ghost trajectory/return point after ready restoration;
8. reset/switch during tail acceleration leaves no old RAF/tier state;
9. watchdog cannot progress turn;
10. terminal state accepts no new shot;
11. unmount clears all asynchronous work.

# R — Deliverable

Return a failure-mode matrix:

`Area | Scenario | Result | Severity | Fix | Regression Test`

Severity:
- BLOCKER
- HIGH
- MEDIUM
- LOW
- NONE

Also return:
- confirmed defects found;
- files modified;
- tests added;
- full test count;
- any unresolved risks;
- explicit recommendation: RELIABILITY GATE PASS or FAIL.

# Locks

Do not change:
- physics constants unless fixing a proven engine defect requires a separately justified decision;
- stage layouts/balance;
- pickup economy;
- Future Echo design;
- legal input range;
- visual art direction.

# Acceptance

This gate passes only when no known BLOCKER/HIGH turn-lifecycle defect remains and every confirmed lifecycle race has regression coverage.
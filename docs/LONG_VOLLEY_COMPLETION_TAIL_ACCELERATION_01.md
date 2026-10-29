# PROJECT VECTOR — Long-Volley Completion & Tail Acceleration 01

Status: BLOCKING CORE-LOOP DEFECT / EXECUTION BRIEF
Date: 2026-10-29

## Confirmed defect

Current live play advances the authoritative Simulation at 1 fixed physics step per real-time 1/60 s.

`Simulation.step()` also contains a diagnostic ceiling:
`if (this.time > maxSimulationTime) { timedOut = true; ... ball.active = false; }`

Therefore long but legal trajectories can visibly disappear before reaching the launcher baseline.

This is unacceptable.

## Product requirement

1. A legal committed shot must visibly and authoritatively finish its physical path.
2. Long volley tails must not force the player to wait at 1x for an excessive period.
3. Presentation acceleration must never alter physics results.

## Architectural rule

Do NOT increase `ballSpeed` for fast-forward.
Do NOT enlarge `fixedDt`.
Do NOT teleport balls to the return line.
Do NOT mark remaining balls inactive.

Fast-forward is presentation scheduling only:
run multiple canonical fixed simulation steps per rendered frame.

Example:
- 1x presentation: 1 simulation-step budget per fixed real-time quantum;
- 2x presentation: consume approximately 2 canonical fixed steps for the same real-time interval;
- optional later escalation only if validated.

The authoritative Simulation remains identical.

## Tail acceleration trigger

Implement a restrained automatic late-volley acceleration.

Initial calibration target:
- normal volley begins at 1x;
- after the volley has clearly entered a long tail, switch smoothly/clearly to 2x;
- trigger should consider real elapsed presentation time and/or remaining active balls;
- do not accelerate immediately during the main dense impact phase;
- avoid oscillating between speeds.

Recommended first validation candidate:
- minimum ~5–7 real seconds before acceleration;
- AND/OR once a large majority of spawned balls have already exited;
- then hold 2x until volley completion.

Exact trigger must be measured, not guessed.

## Timeout semantics

`maxSimulationTime` must not be allowed to terminate a legal live volley.

Separate diagnostic protection from gameplay completion semantics.

Acceptable solutions:
- a high internal hard guard that throws/flags an engine defect but never masquerades as normal completion;
- or a bounded-step guard in tooling/tests that reports unresolved simulation without mutating live game state.

Unacceptable:
- deactivating remaining balls because a timer expired;
- returning to ready state while balls are still physically unresolved.

## Determinism requirement

For a given GameState + angle:

Result at 1x presentation == Result at accelerated presentation

including:
- final blocks/HP;
- destroyed count;
- pickups;
- firstExitX;
- nextLauncher;
- nextGameState;
- stageStatus;
- event ordering where authoritative.

## Tests

Add regression coverage for:
1. A long legal shallow/rebound shot completes without abrupt ball deactivation.
2. No live-path timeout converts unresolved balls into completed/ready state.
3. 1x vs 2x presentation stepping produces identical authoritative result.
4. firstExitX parity under acceleration.
5. pickup and block collision parity under acceleration.
6. long-tail simulation eventually reaches allDone for representative legal angles.
7. no new timeout dependence in L01–L05 balance profiles.

## Presentation validation

Record/inspect at least:
- a normal short volley (must remain 1x);
- a long tail with only a few balls remaining (should accelerate);
- a shallow/rebound-heavy legal volley;
- a pickup volley;
- a final-ball return.

Acceleration should feel like waiting-time compression, not a sudden physics mode change.

## Do not change

- collision math;
- ball radius;
- legal 5°–175° aim domain;
- authored stage data;
- pickup economy;
- stage balance;
- Future Echo;
- board progression;
- launcher return semantics.

## Acceptance

This pass is accepted only when no legal live shot can visibly disappear due to timeout, and long volley tails finish promptly via presentation-only acceleration while authoritative results remain identical.
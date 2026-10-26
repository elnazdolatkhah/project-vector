# PROJECT VECTOR — Shallow-Angle Timeout Defect & Turn Completion Policy 01

Status: BLOCKING DEFECT / EXECUTION BRIEF
Date: 2026-10-26

## Observed defect

A near-horizontal legal shot can bounce repeatedly along the side walls, slowly gain vertical height, and then abruptly disappear / collect before reaching the bricks.

## Root cause

`PHYSICS_CONFIG.maxSimulationTime = 30` is currently treated as a gameplay termination rule.

When `Simulation.time > maxSimulationTime`, the simulation forcibly marks every ball inactive/spawned and emits `SimulationTimeout`.

For shallow legal angles near 1° or 179°, the vertical component is very small. With ballSpeed=10 world units per fixed step at 60 steps/s, a 1° shot rises only about 10.47 world units per real-time second. From launcher y=1180 to blocks near y≈250, the travel can require roughly 89 seconds of simulated flight even before considering route geometry.

Therefore a valid deterministic trajectory is being truncated by a 30-second safety guard.

This is not acceptable gameplay behavior.

# Product rule

A safety timeout must NEVER silently turn an unresolved legal shot into a normal completed volley.

`SimulationTimeout` is a diagnostic/failure guard, not a legitimate ball-return event.

## Immediate corrections

### 1. Remove silent forced completion

When the safety guard is reached:
- do not mark all balls as normally exited;
- do not establish or alter return-point launcher state;
- do not apply board progression as though the volley completed;
- expose an explicit unresolved/timeout diagnostic result in development/tests.

Normal production gameplay should not reach this state for any legal player shot.

### 2. Introduce a minimum practical vertical component

The current 1°–179° domain permits pathological nearly-horizontal shots.

Change the normal player aim domain to a symmetric practical hemisphere:

`5°–175°`

Rationale:
- retains full left/right aiming;
- removes degenerate near-horizontal loops;
- at 5°, vertical travel to the current upper-board region completes comfortably within the existing 30-second safety window;
- improves game rhythm and prevents visually boring wall-scrape trajectories.

Do not describe this as reducing left/right support. The full upward tactical hemisphere remains available except the 5° safety margin at each horizontal extreme.

### 3. Keep timeout as a guard, not a balancing mechanic

Retain a generous diagnostic safety cap.

Recommended:
- increase `maxSimulationTime` from 30 to 45–60 simulated seconds after the legal angle clamp is applied;
- timeout should still produce an explicit diagnostic result, never fake exits.

Choose the smallest value that all legal 5°–175° regression fixtures complete under with margin.

### 4. Future Preview / Solver parity

Preview, solver, replay, and live gameplay must reject/use the same canonical aim domain.

No subsystem may continue searching 1°–4.999° or 175.001°–179° candidates.

# Tests

Add explicit regression coverage:

1. 1° is rejected by canonical input validation.
2. 179° is rejected.
3. 5° is valid.
4. 175° is valid.
5. A 5° shot completes normally without SimulationTimeout in representative L01 geometry.
6. A 175° mirrored shot completes normally without timeout.
7. A forced tiny diagnostic timeout produces an explicit timeout/unresolved result and does NOT count balls as normal exits.
8. Timeout does not set firstExitX.
9. Timeout does not advance board progression.
10. Solver candidate range matches 5°–175°.
11. Future Preview and gameplay agree for shallow legal shots.
12. All existing deterministic tests remain green.

# Presentation

If a diagnostic timeout somehow occurs in development:
- do not visually collect all balls as if the volley ended normally;
- surface it only as a developer/debug error;
- production UI should never expose a fake normal turn completion.

# Do not change

- collision response math;
- wall reflection;
- launcher-baseline exit rule;
- return-point first-exit rule;
- board progression;
- pickup collision ordering;
- stage state machine;
- ball count economy;
- ball speed.

# Validation report

After implementation report:
- total tests;
- final canonical angle range;
- final maxSimulationTime;
- exact timeout result semantics;
- proof that 5° and 175° representative shots complete normally;
- proof that timeout cannot masquerade as a completed volley;
- modified files;
- Physics response changes = NONE; input-domain and simulation-guard semantics changed only.
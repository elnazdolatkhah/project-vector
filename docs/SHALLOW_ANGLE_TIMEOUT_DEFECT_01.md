# SHALLOW ANGLE TIMEOUT DEFECT — AUTHORITATIVE SPECIFICATION & VALIDATION REPORT

**Document ID**: DEFECT-01-SHALLOW-ANGLE-TIMEOUT  
**Date**: 2026-10-26  
**Status**: RESOLVED & VALIDATED  
**Authoritative Scope**: Aim domain restriction (5°–175°), shallow shot completion, deterministic timeout abort semantics.

---

## 1. Problem & Root Cause Analysis

### 1.1 The Shallow Angle Dilemma
- Previously, the player aim domain permitted angles from 1° to 179°.
- At ultra-shallow angles such as 1° ($vy = 10 \cdot \sin(1^\circ) \approx 0.1745$ px/step = 10.47 px/s):
  - Vertical round-trip transit from baseline ($y = 1180$) to ceiling ($y = 6$) and back requires $\approx 224$ seconds.
- Even at shallow legal angles of 5° and 175° ($vy = 10 \cdot \sin(5^\circ) \approx 0.8716$ px/step = 52.29 px/s):
  - Round-trip transit on an empty board requires $2348 \text{ px} / 52.29 \text{ px/s} \approx 44.92$ seconds.
  - On L01 (18 balls), completing the volley requires $\approx 35.95$ seconds.
- Because `PHYSICS_CONFIG.maxSimulationTime` was capped at 30 seconds:
  1. Shots at 5° and 175° hit `SimulationTimeout` prematurely at $t = 30.0167$ seconds.
  2. The remaining in-flight balls were abruptly deactivated.

### 1.2 The Masquerading Volley Defect
- When `SimulationTimeout` occurred:
  1. The simulation returned without setting a distinct `timedOut` status.
  2. If any ball had exited prior to the timeout, `firstExitX` was retained.
  3. `applyTurnResult` consumed the timed-out result as a normal turn, descending surviving blocks, advancing `turn`, consuming waves, and checking the danger line.
  4. This allowed a simulation abort to masquerade as an authoritative completed volley, corrupting progression and physics parity.

---

## 2. Authoritative Requirements & Solutions

| Requirement | Implementation Solution | Validation Evidence |
| :--- | :--- | :--- |
| **Canonical Player Aim Range: 5°–175°** | Updated `INPUT_CONFIG.angleMin = 5` and `INPUT_CONFIG.angleMax = 175`. `assertAngle()` in `src/physics/simulation.js` strictly rejects angles $< 5^\circ$ or $> 175^\circ$. | Test 1 in `tests/shallowAngleTimeout.test.js` rejects 0°, 1°, 4.99°, 175.01°, 179°, 180°. |
| **5° and 175° Complete Normally** | Increased `PHYSICS_CONFIG.maxSimulationTime` from 30 to 75 seconds. Empty court transit takes 44.92s ($< 75\text{s}$), L01 takes 35.95s ($< 75\text{s}$). | Tests 2 & 3 verify `timedOut === false`, `completed === true`, 100% ball exit count, valid `firstExitX`. |
| **Timeout Cannot Masquerade as Normal Volley** | Explicit `timedOut: boolean` and `completed: boolean` added to `SimulationResult` and `FuturePreview`. `timedOut = true` and `completed = false` set on timeout. | Test 4 confirms `timedOut === true` and `SimulationTimeout` event recorded. |
| **Timeout Must Not Mark Balls as Exits** | Balls deactivated by timeout do not increment `stats.ballsExited` and do not emit `BallExited` events. | Test 5 confirms unexited balls yield `ballsExited: 0` and 0 `BallExited` events. |
| **Timeout Must Not Set `firstExitX`** | On timeout, `firstExitX` is forced to `null`, and `nextLauncher.x` remains at `state.launcher.x`. | Test 6 verifies `firstExitX === null` and `nextLauncher.x === launcher.x`. |
| **Timeout Must Not Advance Progression** | `applyTurnResult(state, res)` checks `res?.timedOut \|\| res?.completed === false`. If timed out, returns unadvanced canonical state. | Test 7 verifies turn, waveIndex, blocks, pickups, launcher, and stage status are completely unadvanced. |
| **Unified Angle Domain** | Preview, Solver, live gameplay, and tests share `INPUT_CONFIG` [5°, 175°]. Solver strictly prioritizes completed candidates over timed-out candidates. | Tests 8 & 9 verify full parity across Preview, Solver, and live gameplay. |

---

## 3. Preserved Architecture & Invariants

1. **Deterministic Physics**: Core swept AABB vs swept circle physics and wall reflection formulas remain 100% untouched.
2. **First-Return Launcher Rule**: Canonical downward exit at `launcher.y` establishes `firstExitX` on all completed volleys.
3. **Board Progression & Danger Line**: Unchanged for all completed turns; halted strictly on timeout.
4. **Pickup Ordering**: Swept chronological collection with $t_{\text{pickup}} \le t_{\text{phys}}$ collision precedence preserved.
5. **Finite-Wave Stage State Machine**: Wave consumption, clear condition, and fail condition preserved.
6. **Zero Feature Creep**: No visual redesign, no extra gameplay elements added.

---

## 4. Test Suite Execution Summary

- **Total Test Files**: 12
- **Total Tests**: 109
- **Passed**: 109 (100%)
- **Failed**: 0
- **TypeScript Check (`tsc --noEmit`)**: 0 errors
- **Production Build (`npm run build`)**: Success

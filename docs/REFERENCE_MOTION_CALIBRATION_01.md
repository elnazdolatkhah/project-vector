# PROJECT VECTOR — Reference Motion Calibration 01

Status: Execution brief
Scope: Presentation / motion only
Reference: User-provided Bricks Breaker Quest gameplay videos

## Objective

Calibrate PROJECT VECTOR's motion language so the game feels smooth, legible, restrained, and mobile-native.

Do not add new gameplay systems.
Do not redesign the visual identity.
Do not change authoritative physics.

This pass is specifically about:

**aim → release → volley cadence → live motion → hit → destroy → volley end → ready state**

## Reference findings

The reference game's feel does not come from heavy effects.

It comes from:
- consistent ball velocity;
- regular ball spacing;
- restrained hit feedback;
- highly readable aim preview;
- very little visual noise;
- fast transitions between states;
- natural spectacle created by ball density rather than particles.

The reference uses a dotted/ghost-ball aiming language instead of a strong continuous engineering line.

The predicted path is readable because of spacing and rhythm, not because of glow intensity.

## LOCKED

Do not modify:
- src/physics/*
- src/domain/*
- src/future/*
- src/solver/*
- fixedDt
- ballSpeed
- collision rules
- reflection
- simulateTurn()
- GameState structure
- canonical input range 1°–179°
- current level data
- spawnInterval unless a measured reference comparison proves it must change

All deterministic tests must remain green.

## 1 — Aim Preview Language

Replace the current dominant continuous trajectory beam with a restrained ghost-ball/dotted trajectory presentation.

Requirements:
- use evenly spaced small circular markers;
- spacing must remain visually consistent through rebounds;
- markers may fade with distance/time;
- rebound points must remain readable;
- affected block states remain authoritative;
- no fake/approximate physics path;
- the underlying path still comes from Future Engine trajectories;
- no thick laser line;
- no excessive glow.

Goal:
The player should read the future path immediately without the board feeling like a debugging tool.

## 2 — Immediate Aim Response

Aim direction must remain visually attached to the pointer/finger at display refresh rate.

Keep:
- immediate local aim response;
- authoritative previewFuture() as the source of consequences;
- no React state churn for high-frequency pointer movement where avoidable.

If preview recomputation is throttled, visual aim response must still be immediate.

When a new authoritative future arrives:
- transition ghost markers cleanly;
- do not aggressively snap the entire path;
- never present non-authoritative block consequences.

## 3 — Volley Cadence

Preserve the authoritative spawnInterval unless measured behavior proves a problem.

Calibrate presentation so balls read as a coherent stream:
- consistent visual spacing;
- no visible jitter between balls;
- no easing mid-flight;
- no individual ball animation that changes apparent speed;
- newly spawned balls may use only a very subtle scale/fade-in.

The stream itself should be the spectacle.

## 4 — Live Ball Motion

Keep render interpolation.

Verify:
- no stepping/stutter at 60Hz;
- no stepping/stutter at 90/120Hz where supported;
- interpolated positions are presentation-only;
- no visual drift from authoritative simulation;
- no overshoot/easing around rebounds.

Ball motion should feel constant and physical.

## 5 — Hit Feedback

Reference behavior is restrained.

For each block hit:
- very short local flash;
- very small compression/scale response;
- number change remains the main information;
- do not shake the screen;
- do not create large particles;
- do not obstruct neighboring block values.

Target duration:
~70–120 ms.

## 6 — Destroy Feedback

Destroy feedback should be quick and legible.

Use:
- short fade/scale exit;
- optional tiny fragments;
- no explosion effect;
- no lingering debris;
- no camera shake.

Target duration:
~100–180 ms.

Authoritative destruction still occurs at the exact simulation event.

## 7 — Rebound Readability

Wall and block rebounds should remain geometrically crisp.

Do not add:
- bounce easing;
- spring physics;
- curved paths;
- post-impact slowdowns.

The direction change should be instantaneous in authoritative motion, with only subtle presentation feedback at the contact point if needed.

## 8 — Volley End State

This pass must improve how the end of a volley feels without changing gameplay state rules.

Requirements:
- identify when all balls have exited;
- avoid an abrupt hard cut from motion to aiming state;
- use a very short visual settling transition;
- restore aim-ready state quickly;
- avoid unnecessary delay before the player can aim again.

Do NOT yet implement:
- return-point-dependent launcher position;
- block row descent;
- new row generation;
- next-turn launcher relocation.

Those are gameplay decisions for a later pass.

## 9 — Visual Noise Budget

During heavy ball activity:
- block numbers must remain readable;
- balls must remain individually legible as a stream;
- prediction visuals should be hidden or reduced during committed live play;
- hit effects must not accumulate into a bright flashing mass;
- no long trails;
- no large glow fields.

## 10 — Mobile Calibration

Test at:
- 360×800
- 390×844
- 412×915

Verify:
- pointer aim remains responsive on both left and right sides;
- 45°, 90°, and 135° remain visually correct;
- ghost-ball preview spacing is readable;
- launcher is not obscured by bottom UI;
- volley end transitions immediately back to usable aim state.

## 11 — Performance

Use requestAnimationFrame for presentation timing.

Avoid:
- React state updates for every ball/frame;
- allocations inside hot render loops where avoidable;
- recalculating robustness on every raw pointer event;
- per-ball DOM nodes.

Canvas remains the primary rendering surface.

## 12 — Validation

After implementation:

1. Run the full test suite.
2. Confirm every existing deterministic test passes.
3. Physics changes = NONE.
4. Report modified files.
5. Report whether spawnInterval changed. Expected answer: NO unless measured evidence required it.
6. Describe ghost-ball spacing logic.
7. Describe how aim preview transitions between authoritative future updates.
8. Describe volley-end presentation behavior.
9. Explicitly confirm no new gameplay systems were added.

## Acceptance Standard

This pass is accepted only if:
- aiming feels immediate;
- predicted path feels game-native rather than debug-like;
- live balls move with constant, smooth rhythm;
- repeated hits remain readable under density;
- destruction is fast and restrained;
- the transition from volley end back to aiming feels intentional;
- all deterministic behavior remains unchanged.

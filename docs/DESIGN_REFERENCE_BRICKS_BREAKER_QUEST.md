# Case Study — Bricks Breaker Quest (Mobirix)

## Purpose
This is a structural UX reference for PROJECT VECTOR, not a visual-copy target. Do not copy branding, art assets, exact color treatment, level content, or proprietary UI. Extract the mobile interaction anatomy and then express it in PROJECT VECTOR's own identity.

## Verified reference facts
Official listing: https://play.google.com/store/apps/details?id=com.mobirix.swipebrick2

The official description states that:
- the ball flies toward the touched location;
- the player should find strong positions and angles for hitting bricks;
- the game is designed for simple pocket/mobile play;
- levels are cleared by removing bricks while preventing them from reaching the bottom.

Reference screenshots show a portrait playfield dominated by the board, a thin top status/progress region, dense numbered blocks in the upper/middle field, a launcher/ball count near the lower edge, and minimal permanent chrome around the active board.

## Screen anatomy to learn from
1. **Playfield dominance** — the board should visually own the screen. Permanent UI must not occupy a large central card or side panel.
2. **Portrait rhythm** — top status is shallow; the main field is tall; aiming originates near the lower edge.
3. **Dense readable targets** — bricks are numerous enough to make angle choice meaningful, but each still has a readable durability value.
4. **Direct manipulation** — aiming happens on the playfield itself. The user's finger is the primary control, not a persistent slider.
5. **One-hand comprehension** — controls and state feedback are readable quickly on a phone.
6. **Immediate causality** — trajectory, rebounds, hit values, and destruction are spatially connected to the board.

## What PROJECT VECTOR must deliberately change
Bricks Breaker Quest mostly asks the player to estimate an angle and then observe the result. PROJECT VECTOR's differentiator is **visible futures before commitment**.

Therefore the reference interaction becomes:

**Drag = explore a predicted future → Release = choose which predicted future becomes real.**

Prediction should be rendered *inside the board*:
- predicted trajectory on the field;
- projected damage on affected bricks;
- projected destruction as a clear state treatment on the brick itself;
- a tiny summary near the aim zone if needed (e.g. `6 DESTROYED · 18 DAMAGE`), not a dashboard.

## Anti-patterns for PROJECT VECTOR
- side panels on mobile;
- large floating analytics cards over the board;
- a separate permanent angle slider when direct aim is available;
- showing a single “BEST” answer as the main interaction;
- allowing debug tooling to become the player-facing UI;
- copying the reference game's exact neon presentation or branded assets.

## Acceptance snapshot
At normal mobile scale, a first-time viewer should identify in under a second:
1. where the bricks are;
2. where the shot originates;
3. what direction is currently being explored;
4. which bricks the current future will affect;
5. how to commit the shot.

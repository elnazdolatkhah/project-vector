# PROJECT VECTOR — Future Readability / Next-State Preview 01

Status: DESIGN + EXECUTION BRIEF
Date: 2026-10-26

## Product problem

PROJECT VECTOR already computes the full authoritative future of a candidate shot:
- immediate damage/destruction;
- pickup acquisition;
- first-return launcher X;
- descended surviving board;
- incoming next wave;
- next ball count;
- terminal stage status.

But the player-facing preview still communicates mostly the immediate volley.

This undersells the core product idea:

**The player is not merely aiming a shot. The player is choosing a future board.**

## Design goal

Make the NEXT STATE spatially legible without turning the screen into a dashboard.

The player should be able to answer, at a glance:
- what will I damage now?
- what will survive?
- where will those survivors be next turn?
- what new pressure enters from above?
- where will I launch from next?
- will I gain a ball?
- does this future create immediate danger or win/failure?

Do not show all of this as text.

# Core visual language — FUTURE ECHO

Use a secondary, diegetic layer called **Future Echo**.

Future Echo is NOT a duplicate full board.
It is a restrained spatial projection of the authoritative `nextGameState`.

## Layer hierarchy while aiming

1. Current board blocks — solid, readable.
2. Immediate consequences — current block damage/destruction treatment.
3. Predicted trajectory — ghost-ball path.
4. Future Echo — faint next-turn positions and next launcher.

Future Echo must be visually weaker than current-board information.

# A — Surviving-block landing echoes

For each block that survives the current volley:
- render a faint outline/ghost at its exact `nextGameState` position one row lower;
- do NOT duplicate the durability number at full strength;
- if a remaining value is useful, render it subtly inside the echo;
- use low opacity and thin stroke;
- no glow field;
- no filled solid block.

The connection between current block and future position should be visually inferable without drawing arrows for every block.

Optional: a very short downward offset cue may appear when aim settles, but avoid motion clutter.

# B — Destroyed blocks

Blocks predicted to be destroyed must NOT receive a next-state echo.

This absence is meaningful.

Keep their immediate projected-destruction treatment restrained.

# C — Incoming next wave

If a future wave remains:
- render the incoming next-wave blocks as very faint top-edge silhouettes/outlines at their exact authoritative next-state positions;
- distinguish them from surviving-block echoes with slightly different opacity/pattern, not a different loud color;
- do not reveal information that is not already deterministic and available to Future Preview.

If no wave remains, render no incoming-wave echo.

# D — Next launcher

Render the authoritative `nextLauncher.x` on the launcher baseline as a small ghost launcher marker.

Requirements:
- clearly distinct from current launcher;
- no numeric X coordinate;
- restrained circle/ring;
- optionally show a tiny `NEXT` micro-label only during calibration, removable later.

This is strategically important because return point changes the next turn.

# E — Ball pickup consequence

If the candidate shot collects a pickup:
- keep pickup collection highlight on the pickup itself;
- show `+1 BALL` contextually near the pickup or compact future summary;
- next launcher/ball-count state may subtly show the new total only if it remains readable.

Do not create a persistent resource panel.

# F — Danger projection

If the authoritative `nextGameState` is close to the danger line:
- use the Future Echo itself to communicate pressure;
- echoes entering the danger zone may receive a restrained warm/red warning stroke;
- if the candidate future is `failed`, show a concise spatial warning such as `DANGER` near the breach location;
- do not rely on a large modal or analytics text during aim.

Terminal futures:
- `failed` future should be unmistakably dangerous;
- `won` future may receive a restrained stage-clear cue.

# G — Temporal reveal behavior

To prevent clutter, do not display the full Future Echo at maximum visibility during rapid pointer movement.

Recommended behavior:
- immediate trajectory and current-block consequence update first;
- if pointer angle remains approximately stable for ~80–120ms, Future Echo fades in;
- during rapid scrub, Future Echo stays quieter or temporarily hidden;
- authoritative data is unchanged; this is presentation timing only.

This creates a two-speed reading model:
- fast scrub = compare shot paths;
- brief hold = inspect the resulting future board.

# H — Future summary cleanup

Default compact text summary should remain minimal:
- DAMAGE
- DESTROYED
- `+1 BALL` only when applicable.

Do NOT reintroduce:
- HITS;
- numeric angle;
- STABILITY%;
- raw solver score.

If next-state spatial language succeeds, the text pill should become less important and may eventually be removed.

# I — No hidden recommendation

Do NOT label a candidate as:
- BEST;
- OPTIMAL;
- RECOMMENDED.

The system shows futures; the player chooses.

# J — Technical source of truth

Future Echo must be rendered only from authoritative `FuturePreview.nextGameState` and related result fields.

Do NOT:
- recompute row descent in renderer;
- estimate next launcher locally;
- fake incoming rows;
- approximate failure state.

Renderer receives authoritative current and next-state data.

# K — Performance

Do not run additional simulations merely to draw Future Echo.

Reuse the already computed Future Preview.

Future Echo rendering should be canvas-only and presentation-side.

# L — Calibration mode

For the first implementation, add a temporary internal/debug toggle if useful:
`showFutureEcho`

This is not a player-facing mode.
It exists only to compare current preview vs Future Echo during validation.

# M — Validation scenarios

Validate at least these cases:

1. Candidate destroys several blocks:
   - destroyed blocks have no next echo;
   - survivors echo exactly one row lower.

2. Candidate collects +1 Ball:
   - pickup consequence visible;
   - next ball count authoritative.

3. Candidate changes return X strongly:
   - next launcher ghost visibly relocates.

4. Final wave exhausted:
   - no incoming wave echo.

5. Candidate future fails:
   - breach location spatially obvious.

6. Candidate future wins:
   - no contradictory danger/failure cue.

7. Rapid angle scrub:
   - no flashing wall of duplicate blocks;
   - Future Echo remains restrained.

8. Hold angle ~100ms:
   - Future Echo becomes legible.

# N — Do not change

- physics;
- simulation timeout semantics;
- legal 5°–175° aim domain;
- board geometry;
- return-line behavior;
- pickup rules;
- ball economy;
- finite-wave stage state machine;
- row patterns / HP balance;
- Minimal Precision base direction.

# Acceptance standard

This pass is accepted when a player can visually distinguish two candidate angles not only by immediate destruction, but by the different next boards they create.

The screen must still feel like a game board, not a comparison dashboard.

After implementation report:
- modified files;
- exact Future Echo opacity/stroke values;
- reveal timing;
- source fields used from FuturePreview/nextGameState;
- proof no extra simulation path was added;
- full test results;
- explicit confirmation gameplay mechanics unchanged.
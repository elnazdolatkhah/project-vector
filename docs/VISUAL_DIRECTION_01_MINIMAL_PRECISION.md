# PROJECT VECTOR — Visual Direction 01: Minimal Precision

Status: SELECTED / BASE VISUAL LANGUAGE
Decision date: 2026-10-25

## Decision

PROJECT VECTOR will use **Minimal Precision** as its base visual direction.

This is the default visual language for the core game, early levels, onboarding, and standard play.

The purpose is clarity, calmness, precision, and immediate gameplay readability.

PROJECT VECTOR should first feel like a polished game, not a visual-effects showcase.

## Core visual hierarchy

1. Live balls
2. Blocks and their current / projected state
3. Predicted future path
4. Minimal HUD
5. Decorative atmosphere

Decorative presentation must never overtake gameplay information.

## Base characteristics

### Background
- Very dark neutral/navy field.
- Subtle tonal depth is allowed.
- No heavy sci-fi panels.
- No persistent decorative glow fields.
- Grid, if used, must be extremely restrained.

### Blocks
- Clean geometric blocks.
- Clear durability number.
- Slight depth or restrained gradient is acceptable.
- Base blocks should remain visually calm.
- Predicted damage/destruction uses state changes, not excessive effects.

### Balls
- High-contrast, simple, bright balls.
- Crisp silhouette.
- Minimal soft highlight is acceptable.
- No long trails.
- No excessive bloom.

### Prediction
- Ghost-ball / dotted future trajectory.
- Clearly visible but subordinate to live gameplay.
- Rebound points are readable but restrained.
- Projected consequences are shown directly on affected blocks.

### HUD
- Very shallow.
- Minimal stage / turn / score / reset information.
- No analytics-dashboard appearance.
- Avoid permanent “CALCULATING…” or developer-status language in the final player experience.

### Typography
- Clean, compact sans-serif.
- Strong numeric readability.
- No decorative futuristic typeface required.

### Motion
Use the locked motion language:
- deterministic fixed-step physics;
- presentation interpolation;
- direct responsive aiming;
- restrained hit feedback;
- quick destruction feedback;
- return-point launcher;
- ghost prediction language.

## Higher-level visual variation

Minimal Precision is the BASE language, not a permanent restriction on all future levels.

Later/high-level content may introduce controlled visual variations for special conditions such as:
- special stages;
- difficult or rare challenges;
- environmental themes;
- high-risk futures;
- unusual target types;
- milestone levels;
- boss / event-like encounters if those systems are later accepted.

These variations must preserve:
- the same gameplay readability hierarchy;
- ball visibility;
- block durability readability;
- prediction clarity;
- input clarity.

The visual variation should communicate that the situation is special, rather than making every level visually loud.

## Rule for future art passes

Do not replace this direction with a new overall theme without an explicit design decision.

Future AI Studio visual work should treat **Minimal Precision** as the default target.

Premium tactile or predictive/futuristic treatments may be selectively borrowed later for special states, but they are not the base art direction.

## Next implementation goal

Translate Minimal Precision into the current game without redesigning mechanics.

The first implementation pass should focus on:
- removing prototype/debug visual residue;
- simplifying HUD;
- resolving the “CALCULATING…” state elegantly;
- improving block surfaces and typography;
- creating a polished neutral background;
- maintaining the locked prediction/motion behavior;
- producing a cohesive finished-game look on mobile.

No gameplay feature additions are part of this visual pass.

# PROJECT VECTOR — Playability & Balance Validation 01

Status: DESIGN + EXECUTION BRIEF
Date: 2026-10-28

## Purpose

Authored Stage Content, Stage Identity, and Contested Pickup Economy are now locked.

This pass validates whether L01–L05 are actually playable as a coherent campaign sequence.

This is NOT a feature pass.
This is NOT a visual-polish pass.
This is NOT a redesign of the deterministic architecture.

## Core question

Do L01–L05 form a readable, fair, escalating difficulty ramp in real play?

We must validate:
- stage duration;
- average and worst-case board pressure;
- HP pacing;
- starting ball counts;
- pickup value;
- failure pressure;
- recoverability after weak shots;
- whether a strong player can exploit a stage too easily;
- whether a weaker but reasonable player can still recover.

## Locked systems

Do not change:
- collision physics;
- 5°–175° aim domain;
- timeout semantics;
- board geometry;
- launcher-baseline return;
- authored stage identities;
- authored finite-wave structure;
- pickup collision rules;
- contested-pickup design principle;
- Future Echo;
- stage-state semantics;
- Minimal Precision visual direction.

Only stage data may be adjusted if required by measured balance evidence.

# A — Stage duration

For each L01–L05, estimate and/or simulate:
- minimum turns to clear under strong play;
- typical turns under competent play;
- weak-but-valid play survival length;
- maximum practical cleanup tail after final wave.

Do not use a single greedy destruction solver as the only model.

Use at least three internal play profiles:

### Strong
Chooses among high-quality non-failed futures, balancing destruction and danger.

### Competent
Chooses from the upper-middle set of viable futures rather than always best.

### Weak-but-reasonable
Avoids obvious failure but does not optimize well.

Report turn-count distributions or representative simulated runs.

# B — Difficulty ramp

Expected qualitative ramp:

L01 — forgiving introduction
L02 — first meaningful routing constraint
L03 — longer-path planning
L04 — decision complexity / trade-off
L05 — precision + pressure

Validate that measured difficulty generally rises across the sequence.

Difficulty should not simply mean higher HP.

Consider:
- required precision;
- dangerMargin erosion;
- number of viable futures;
- recovery options;
- pickup opportunity cost;
- launcher-position consequences.

# C — HP pacing

Audit all initial blocks and authored wave HP.

Flag:
- blocks that survive too many ordinary volleys without strategic reason;
- HP spikes that merely prolong play;
- stages where destruction feels trivial because ball count overwhelms HP;
- stages where cleanup after final wave becomes tedious.

Prefer geometry and consequence complexity over HP inflation.

# D — Ball economy

Validate starting ball counts:
- L01 = 18
- L02 = 18
- L03 = 18
- L04 = 20
- L05 = 20

Do not assume these values are correct merely because they are currently authored.

Measure:
- effective damage capacity per volley;
- how much +1 Ball changes later-turn outcomes;
- whether pickups matter too little;
- whether repeated pickups snowball excessively;
- whether missing one pickup creates unfair failure.

If changing starting ball count is necessary, make the smallest justified change.

# E — Danger pressure

Track dangerMargin across simulated turns.

For each stage report:
- starting dangerMargin;
- median/typical dangerMargin by turn;
- minimum non-failed dangerMargin;
- turn where danger becomes strategically relevant;
- whether failure arrives gradually or suddenly.

Desired behavior:
- L01 should teach the danger line without punishing early mistakes harshly;
- L02/L03 should introduce recoverable pressure;
- L04 should make board safety a real strategic dimension;
- L05 may apply sustained pressure but must remain learnable.

# F — Recovery test

For each stage deliberately choose one mediocre but legal early shot.

Then test whether competent play can still recover.

A stage fails recovery validation if:
- one non-catastrophic early mistake almost always makes failure inevitable;
- or recovery is trivially easy regardless of choice.

Campaign stages should support consequence without becoming brittle.

# G — Dominant-strategy audit

Sample the full angle range on representative turns.

Flag if:
- one angle family repeatedly dominates most meaningful dimensions;
- pickup route is almost always mandatory;
- same wall-bounce pattern solves multiple stages despite different identities;
- launcher position becomes irrelevant;
- Future Echo reveals an obviously dominant answer every turn.

The player should compare futures, not discover a universal exploit.

# H — Cleanup-tail audit

After final authored wave enters:
- measure remaining block count;
- remaining total HP;
- turns required to finish under competent play.

A stage should not become less interesting after its authored content ends.

If cleanup tail is too long, prefer reducing final-wave/remaining HP rather than adding new mechanics.

# I — Playability acceptance targets

These are calibration targets, not immutable production rules:

L01:
- clearable in roughly 3–5 committed turns by strong play;
- forgiving recovery;
- low cleanup tail.

L02:
- roughly 4–6 turns;
- reflection advantage matters but is not mandatory every turn.

L03:
- roughly 5–7 turns;
- double-reflection concept appears clearly at least once;
- no excessive rebound-time / timeout dependence.

L04:
- roughly 5–7 turns;
- multiple viable strategic futures remain present;
- pickup investment changes later options.

L05:
- roughly 6–8 turns;
- sustained but fair danger pressure;
- precision bands matter without requiring pixel-perfect input.

Do not force exact turn counts if measured play shows a better range.

# J — Metrics to return

For every stage return a compact table with:
- starting balls;
- authored wave count;
- initial total HP;
- total authored incoming HP;
- strong-play clear turns;
- competent-play clear turns;
- weak-play survival/clear result;
- minimum observed non-failed dangerMargin;
- pickup count collected in each profile;
- cleanup-tail turns;
- PASS / FAIL / TUNE.

# K — Adjustment policy

If a stage fails:

Make the smallest stage-data adjustment only.

Allowed:
- local HP reduction/increase;
- one block moved to another canonical column;
- pickup placement adjustment only if balance evidence demands it;
- starting ball count ±1 or ±2 if strongly justified;
- authored wave order adjustment.

Not allowed:
- new gameplay mechanic;
- new physics rule;
- new UI system;
- global generator changes;
- rewriting all stages.

After each adjustment rerun the affected stage analysis.

# L — Human-play proxy

Solver-perfect play is not enough.

When selecting Competent and Weak profiles, introduce deterministic quality bands rather than always taking the best-ranked candidate.

Document the selection rule so runs are reproducible.

# M — Regression

After any stage-data tuning:
- rerun all existing tests;
- rerun Stage Identity Validation;
- rerun Pickup Trade-off Validation;
- confirm L01–L05 identities remain PASS;
- confirm all campaign pickups remain CONTESTED;
- confirm deterministic parity remains intact.

# Acceptance

This pass is accepted when:
- L01–L05 form a coherent escalating difficulty curve;
- no stage is trivial, brittle, grindy, or dominated by one universal route;
- cleanup tails are controlled;
- pickup economy matters without becoming mandatory;
- danger pressure is gradual and readable;
- all locked identities remain intact.
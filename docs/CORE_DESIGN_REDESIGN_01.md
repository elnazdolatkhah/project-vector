# PROJECT VECTOR — Core Design Redesign 01

Status: ACTIVE AFTER P1 FAIL
Date: 2026-10-30

## Trigger

P1 Decision Landscape Audit failed with four measured design problems:
1. pickups have near-zero strategic leverage;
2. high-value shots are systematically much slower;
3. good outcomes are fragmented into sub-degree needle bands;
4. early-stage difficulty is bimodal: blind/random play can succeed while mediocre informed play can still fail badly.

## Design principle

Do not optimize metrics mechanically.

The goal is not to make pickups mandatory, not to make every angle forgiving, and not to shorten every volley.

The goal is to create readable strategic trade-offs where:
- strong choices are discoverable through preview;
- good choices occupy human-selectable angular bands;
- different futures are meaningfully different, not merely higher/lower damage;
- high-value play does not impose disproportionate waiting;
- pickups and return position matter situationally rather than by coercion.

## Preserve

Keep:
- deterministic simulation;
- visible-futures core interaction;
- authored stages L01-L05 as conceptual teaching roles;
- first-exit launcher relocation;
- pickups as independent physical objects;
- row descent / danger pressure;
- minimal visual direction.

## Redesign order

### R1 — Human-selectable solution bands

Target: important strategic routes should usually have robust bands approximately 2°–5° wide, with narrower precision shots reserved deliberately for L05.

Actions:
- identify all <1° isolated needle routes that materially outperform neighbors;
- separate intended precision routes from gap/corner degeneracies;
- redesign local geometry first, not global physics;
- avoid changing ball radius or all column gaps globally unless local geometry cannot solve the issue.

Acceptance:
- L01-L04 should not depend on accidental <1° spikes for strong play;
- L05 may contain narrower bands, but its primary viable solutions should still be intentionally readable and selectable.

### R2 — Pacing / value decoupling

Target: top-quality shots should not routinely take 2.5x–5x as long as median shots.

Actions:
- identify geometry producing long low-information reflection loops;
- distinguish strategically meaningful rebound sequence from repetitive traversal;
- prefer authored geometry changes that allow strong routes to resolve naturally;
- evaluate presentation acceleration trigger based on event density / strategic action completion, not only last-ball tail, if geometry alone is insufficient.

Do NOT alter authoritative physics by teleporting, forced exits, or collision skipping.

Acceptance:
- top-10% shot duration should generally remain within ~2x median duration;
- no routine campaign best shot >~20s without a deliberate stage-specific reason.

### R3 — Pickup leverage

Target: pickups should be situational strategic investments, not cosmetic and not mandatory taxes.

Do NOT simply make stages unwinnable without pickups.

Actions:
- reduce excess starting-ball surplus where appropriate;
- place pickups on routes that trade immediate board control for future capacity;
- ensure some strong no-pickup routes remain viable;
- measure future-quality delta, not only final win rate.

Acceptance:
- at least some states show a measurable trade-off between immediate damage/danger control and +ball economy;
- pickup-seeking should sometimes improve future options, sometimes be inferior;
- zero-pickup completion remains possible for campaign stages unless a later explicit design decision changes this.

### R4 — Stage identity retune

L01 — Direct:
- remain forgiving enough to teach preview;
- random play should not be 100% reliable;
- strong direct bands should be broad and readable.

L02 — Reflection:
- preserve one-wall reflection identity;
- shorten high-value reflection duration;
- make return-point trade-off visible and consequential.

L03 — Double Reflection:
- preserve genuine double-reflection advantage;
- remove long repetitive ricochet tails from best routes;
- avoid severe return-position traps unless preview makes the sacrifice legible.

L04 — Multiple Solutions:
- treat as current strategic benchmark;
- preserve real return-point divergence;
- add meaningful pickup trade-off without collapsing solution diversity.

L05 — Precision:
- precision must mean deliberate narrow choice, not accidental 12px/12px degeneracy;
- retain tighter bands than earlier stages but make the intended precision route readable and reproducible by human input.

## Validation loop

After each stage redesign:
1. run Decision Landscape metrics on that stage;
2. compare against pre-redesign baseline;
3. reject changes that improve one metric while destroying stage identity;
4. do not proceed to external playtest until all five stages meet acceptance.

## P1R exit

Proceed to real App reliability / external playtest only when:
- L01-L04 strong viable bands are human-selectable;
- L05 precision is intentional rather than degenerate;
- pickups show situational leverage;
- high-quality shot duration is no longer systematically punitive;
- random policy no longer trivializes early campaign;
- L04-style multi-dimensional trade-offs exist in more than one stage.
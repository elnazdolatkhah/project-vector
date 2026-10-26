# PROJECT VECTOR — Stage Architecture Decision 01

Status: DESIGN DECISION
Date: 2026-10-26

## Problem

The core loop is now mature enough to expose a structural gap:
- the player can lose when blocks breach the danger line;
- but the game has no authoritative definition of winning a stage.

Without stage semantics, difficulty, pickup cadence, HP growth, score, solver evaluation, and campaign progression cannot be designed coherently.

## Candidate Models

### Model A — Endless Survival

Rule: rows continue forever; the only objective is to survive as long as possible.

Strengths:
- simplest architecture;
- naturally fits row descent;
- useful as a secondary/endless mode.

Weaknesses:
- weak fit for authored campaign stages;
- does not give a clear sense of completion;
- reduces PROJECT VECTOR's future-choice concept toward pure survival optimization.

Decision: NOT the primary campaign model. Keep as a possible later mode.

### Model B — Clear-All Target Stage

Rule: destroy all blocks to win.

Strengths:
- easy to understand;
- clear win state.

Weaknesses:
- conflicts with continuous deterministic row generation;
- encourages direct damage optimization;
- risks making ball pickups and future board quality secondary;
- poor fit for staged pressure over time.

Decision: Rejected as the default model.

### Model C — Fixed Turn Survival

Rule: survive N turns without breaching the danger line.

Strengths:
- simple;
- naturally compatible with board descent;
- easy to balance.

Weaknesses:
- can reward passive survival instead of purposeful play;
- weak narrative of accomplishment;
- future evaluation becomes mostly danger avoidance.

Decision: Useful as a special challenge type, not the default.

### Model D — Finite Wave / Row Campaign Stage

Rule:
- each stage has a finite, deterministic sequence of incoming rows;
- every completed volley advances one row;
- after the final authored/generated wave enters, no further rows are generated;
- the stage is won when all remaining active blocks from the finite wave set are destroyed;
- danger line breach at any time is defeat.

Strengths:
- preserves row pressure and danger;
- creates a clear beginning, middle, and end;
- allows authored difficulty curves;
- makes future board quality strategically important;
- ball pickups have lasting value because they strengthen later turns;
- supports meaningful trade-offs between immediate destruction and future power;
- deterministic Future Preview can reason about a bounded future structure;
- fits campaign progression cleanly.

Weaknesses:
- requires stage wave definitions;
- balance is more involved than endless mode.

Decision: SELECTED as the primary campaign stage architecture.

### Model E — Objective Hybrid

Rule: stages may have special objectives such as survive X turns, destroy a protected target, collect resources, or clear a finite wave sequence.

Decision: DEFER. This may be introduced later as advanced stage variety, built on top of the finite-wave campaign architecture.

# Selected Architecture — Finite Wave Campaign

## Authoritative stage rules

Each campaign stage owns:
- a finite deterministic wave/row sequence;
- an initial board state;
- a total wave count;
- optional pickup placements or deterministic pickup rules;
- stage-specific HP curve / pattern data;
- danger line rule;
- stage completion state.

Turn pipeline:
1. player explores futures;
2. player commits a shot;
3. volley resolves;
4. first return point determines next launcher X;
5. surviving blocks descend one row;
6. if unconsumed waves remain, exactly one next row enters;
7. danger line is evaluated;
8. if no waves remain AND no active blocks remain, stage is WON;
9. otherwise next turn begins.

## Important consequence

The stage does NOT end merely because the current board is empty if future scheduled waves remain.

The stage DOES end when:
- all scheduled waves have been introduced;
- all active blocks have been destroyed;
- the state is not failed.

## State additions

Recommended authoritative fields:
- stageStatus: 'active' | 'won' | 'failed'
- waveIndex / nextWaveIndex
- totalWaves

Do not keep separate booleans such as isGameOver + isWon if a single explicit status enum can replace them cleanly.

Schema migration should be deliberate and tested.

## Row generation change

Current infinite procedural generation becomes provisional tooling.

For campaign stages:
- row generation must stop when the finite wave sequence is exhausted;
- rows may be authored, deterministically generated from a finite stage seed, or mixed;
- all future rows for a given stage must remain deterministic.

## Future Engine implication

Future Preview should eventually expose not only current-turn consequences, but stage-level pressure signals derived from the bounded stage:
- remaining waves;
- danger risk;
- ball resource gain;
- whether a candidate future creates immediate failure;
- whether a candidate future completes the stage.

Do not expose all of these as HUD text by default.

## Solver implication

The solver must support terminal state semantics:
- failed futures are dominated by non-failed futures unless explicitly analyzing sacrifice;
- winning futures can be identified;
- current damage/destruction objective remains available for tooling;
- future strategic evaluation can later incorporate remaining wave pressure.

## Why this fits PROJECT VECTOR

PROJECT VECTOR is about choosing among visible futures.

A finite-wave stage creates a meaningful planning horizon:
- early turns can trade immediate damage for ball growth;
- mid-stage turns manage board pressure;
- late-stage turns can prioritize clean-up and survival;
- some futures may be locally weaker but globally safer.

This makes the game's core philosophy mechanically meaningful rather than cosmetic.

# Deferred stage types

Later variations may include:
- Endless Survival;
- Fixed-Turn Challenge;
- Precision / restricted-angle challenge;
- Resource objective;
- protected target;
- special visual-condition stages;
- boss/event structures.

These should reuse the same deterministic state-transition architecture.

# Next implementation pass

Implement a minimal finite-wave stage state machine before tuning balance.

Do NOT yet design final campaign content.

Use L01 as the validation stage with a small finite wave count.

Acceptance must prove:
- rows stop generating after the final wave;
- stage cannot win before all waves have entered;
- stage wins once final wave has entered and all remaining blocks are cleared;
- danger breach still causes failure;
- Preview / Gameplay / Solver / serialization agree on stage status;
- all existing deterministic systems remain valid.
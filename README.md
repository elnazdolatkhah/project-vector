# PROJECT VECTOR — Google AI Studio Migration Package v1

This package converts the single-file prototype into a modular, testable web project suitable for continued work in Google AI Studio or any normal web IDE.

## Run locally
```bash
npm install
npm test
npm run dev
```

Then open the dev-server URL on desktop or phone.

## Start in AI Studio
Read and paste/submit `AI_STUDIO_FIRST_PROMPT.md` as the first task after importing the project.

## Why this package exists
PROJECT VECTOR's core promise is prediction fidelity: the future shown before a shot must be the same future produced after commitment. The architecture therefore keeps physics, prediction, and solver behind one authoritative `simulateTurn()` contract and keeps visual iteration outside that contract.

## Current package contents
- modular physics/domain/future/solver/UI code;
- five migration level fixtures;
- deterministic regression tests;
- Bricks Breaker Quest structural case-study brief;
- locked/editable system rules;
- acceptance checklist;
- canonical project specs;
- legacy prototypes for traceability.

## Canonical hierarchy
1. Explicit accepted decisions made after this package.
2. `docs/PROJECT_VECTOR_MASTER_SPEC_v1.0.md`.
3. Modular source in `src/` where it faithfully implements the Master Spec.
4. `legacy/` only for historical reference.

# Project Vector (React)

A deterministic mobile predictive-strategy brick breaker puzzle game built with React, TypeScript, Vite, and Tailwind CSS.

## Overview

Project Vector's differentiator is **pre-shot consequence prediction**. While aiming, players inspect the exact future trajectories, projected block damage, and robustness rating before launching.

- **Mental Model**: Drag on the field to explore a future; release to commit and make it real.
- **Authoritative Physics Contract**: Gameplay, pre-shot prediction, solver, and tests all call the same `simulateTurn()` contract from `src/physics/simulation.js`.

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Bundler**: Vite 7
- **Styling**: Tailwind CSS v4
- **Testing**: Node.js built-in test runner (`node --test tests/*.test.js`)

## Commands

```bash
# Start development server
npm run dev

# Run test suite
npm test

# Typecheck codebase
npm run lint

# Production build
npm run build
```

## Architecture

- `src/App.tsx`: Main React application component managing game lifecycle, pointer gestures, and HUD.
- `src/render/canvasRenderer.ts`: Canvas 2D renderer for viewport fitting, board boundary, blocks, aim line, predictive trajectories, and live ball animation.
- `src/render/viewport.js`: Canonical aspect-ratio fitting (720x1280) and coordinate transformation.
- `src/future/futureEngine.js`: Pre-shot consequence preview and multi-angle robustness calculation.
- `src/physics/simulation.js`: Authoritative continuous collision simulation (`simulateTurn`).
- `src/physics/collision.js`: Continuous swept circle-vs-AABB collision with corner normal resolution.
- `src/physics/vector.js`: Vector math and reflection utilities.
- `src/domain/gameState.js`: State validation, canonical serialization, and deterministic hashing.
- `src/levels/levels.js`: Structured level fixtures (L01–L05).

# Modular Architecture

```text
src/
  config.js                 canonical numeric/input/version config
  domain/gameState.js       validation, canonical serialization, fingerprint
  physics/vector.js         vector math
  physics/collision.js      swept circle-vs-AABB
  physics/simulation.js     Simulation + authoritative simulateTurn()
  future/futureEngine.js    pre-shot consequence preview + robustness
  solver/solver.js          angle search that calls simulateTurn()
  levels/levels.js          data-only level fixtures
  render/canvasRenderer.js  presentation only; never authoritative state
  ui/app.js                 mobile gesture/application orchestration
```

Dependency direction:

```text
UI / Renderer
      ↓
Future / Solver
      ↓
simulateTurn()
      ↓
Physics + GameState
```

The renderer is forbidden from mutating authoritative physics state.

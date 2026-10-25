export interface Vector2D {
  x: number;
  y: number;
}

export interface Block {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  active: boolean;
}

export interface Launcher {
  x: number;
  y: number;
}

export interface Level {
  levelId: string;
  name: string;
  rowOriginY?: number;
  launcher: Launcher;
  ballCount: number;
  blocks: Block[];
}

export interface GameState {
  schemaVersion: string;
  gameVersion: string;
  physicsVersion: string;
  migrationVersion?: string;
  levelId: string;
  turn: number;
  score: number;
  balls: { available: number };
  launcher: Launcher;
  blocks: Block[];
  rowOriginY?: number;
  seed?: number;
  nextRowIndex?: number;
  isGameOver?: boolean;
}

export interface Ball {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  spawnTime: number;
  spawned: boolean;
  active: boolean;
}

export interface SimulationStats {
  hits: number;
  destroyed: number;
  ballsExited: number;
}

export interface SimulationEvent {
  t: number;
  type: string;
  ballId?: string;
  blockId?: string;
}

export interface SimulationResult {
  angleDeg: number;
  finalBlocks: Block[];
  stats: SimulationStats;
  trajectories?: Record<string, Vector2D[]> | null;
  events: SimulationEvent[];
  score: number;
  elapsedTime: number;
  firstExitX?: number | null;
  nextLauncher?: Launcher;
}

export interface FuturePreview {
  stateFingerprint: string;
  physicsVersion: string;
  angleDeg: number;
  hits: number;
  destroyed: number;
  damage: number;
  remainingHP: number;
  remainingBlocks: number;
  initialHP: number;
  initialBlocks: number;
  trajectories?: Record<string, Vector2D[]> | null;
  firstExitX?: number | null;
  nextLauncher?: Launcher;
  result: SimulationResult;
  nextGameState: GameState;
  isGameOver: boolean;
}

export interface RobustnessAnalysis {
  percent: number;
  futures: FuturePreview[];
}

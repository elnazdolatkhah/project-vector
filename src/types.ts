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

export interface BallPickup {
  id: string;
  x: number;
  y: number;
  radius: number;
  active: boolean;
}

export type StageStatus = 'active' | 'won' | 'failed';

export interface Level {
  levelId: string;
  name: string;
  rowOriginY?: number;
  totalWaves?: number;
  pickupCadence?: number;
  launcher: Launcher;
  ballCount: number;
  blocks: Block[];
  pickups?: BallPickup[];
}

export interface GameState {
  schemaVersion: string;
  gameVersion: string;
  physicsVersion: string;
  migrationVersion?: string;
  levelId: string;
  stageStatus: StageStatus;
  turn: number;
  waveIndex: number;
  totalWaves: number;
  score: number;
  balls: { available: number };
  launcher: Launcher;
  blocks: Block[];
  pickups?: BallPickup[];
  rowOriginY?: number;
  pickupCadence?: number;
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
  ballPickupsCollected?: number;
}

export interface SimulationEvent {
  t: number;
  type: string;
  ballId?: string;
  blockId?: string;
  pickupId?: string;
  x?: number;
}

export interface SimulationResult {
  angleDeg: number;
  timedOut?: boolean;
  completed?: boolean;
  finalBlocks: Block[];
  finalPickups?: BallPickup[];
  collectedPickups?: string[];
  ballPickupsCollected?: number;
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
  timedOut?: boolean;
  completed?: boolean;
  hits: number;
  destroyed: number;
  damage: number;
  ballPickupsCollected: number;
  nextBallCount: number;
  remainingHP: number;
  remainingBlocks: number;
  initialHP: number;
  initialBlocks: number;
  trajectories?: Record<string, Vector2D[]> | null;
  firstExitX?: number | null;
  nextLauncher?: Launcher;
  result: SimulationResult;
  nextGameState: GameState;
  stageStatus: StageStatus;
  isGameOver: boolean;
}

export interface RobustnessAnalysis {
  percent: number;
  futures: FuturePreview[];
}

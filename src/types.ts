export interface Vector2D {
  x: number;
  y: number;
}

export interface PhysicsConfig {
  canvasWidth: number;
  canvasHeight: number;
  ballRadius: number;
  ballSpeed: number;
  gravity: number;
  fixedDt: number;
  spawnInterval: number;
  maxSimulationSteps?: number;
  maxSimulationTime: number;
  collisionEpsilon: number;
  maxCollisionsPerStep: number;
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

export interface WaveBlockSpec {
  col: number;
  hp: number;
  offset?: number;
  id?: string;
}

export interface WaveSpec {
  blocks: WaveBlockSpec[];
  pickupCol?: number;
  intent?: string;
}

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
  waves?: WaveSpec[];
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
  waves?: WaveSpec[];
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
  watchdogTriggered?: boolean;
  completed?: boolean;
  stepCount?: number;
  unresolvedBalls?: string[];
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
  dangerMargin?: number;
  trajectories?: Record<string, Vector2D[]> | null;
  firstExitX?: number | null;
  nextLauncher?: Launcher;
  result: SimulationResult;
  nextGameState: GameState;
  stageStatus: StageStatus;
  isGameOver: boolean;
}

export interface SolverCandidate {
  angleDeg: number;
  objective: string;
  timedOut: boolean;
  completed: boolean;
  score: number;
  stats: SimulationStats;
  ballPickupsCollected: number;
  nextBallCount: number;
  nextLauncher?: Launcher;
  nextGameState: GameState;
  dangerMargin?: number;
  stageStatus: StageStatus;
  isGameOver: boolean;
  robustness?: number;
}

export interface StageFuturesAnalysisSample {
  angle: number;
  angleDeg: number;
  damage: number;
  destroyed: number;
  pickups: number;
  ballPickupsCollected: number;
  nextBallCount: number;
  nextLauncherX: number;
  stageStatus: StageStatus;
  dangerMargin: number;
  wallReboundCount: number;
  leadWallRebounds: number;
  sideWallRebounds: number;
  leadSideWallRebounds: number;
  blockReboundCount: number;
  timedOut?: boolean;
  completed?: boolean;
}

export interface StageFuturesAnalysisReport {
  levelId: string;
  sampleCount: number;
  distinctFuturesCount: number;
  samples: StageFuturesAnalysisSample[];
}

export interface RobustnessAnalysis {
  percent: number;
  futures: FuturePreview[];
}

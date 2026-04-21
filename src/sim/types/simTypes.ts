export type TerrainType = 'grass' | 'forest' | 'water' | 'hill' | 'barren';

export type Inventory = {
  food: number;
  wood: number;
  stone: number;
};

export type AgentTrait =
  | 'aggressive'
  | 'cooperative'
  | 'cautious'
  | 'ambitious'
  | 'greedy'
  | 'loyal'
  | 'curious'
  | 'resilient';

export type AgentAvatar = {
  bodyColor: string;
  hairShape: 'short' | 'long' | 'bun' | 'mohawk' | 'bald';
  skinTone: 'light' | 'tan' | 'brown' | 'dark';
  accessory: 'band' | 'cape' | 'pack' | 'stripe' | 'none';
};

export type Agent = {
  id: number;
  name: string;
  x: number;
  y: number;
  renderX: number;
  renderY: number;
  health: number;
  hunger: number;
  energy: number;
  alive: boolean;
  ageDays: number;
  inventory: Inventory;
  traits: AgentTrait[];
  settlementId: number | null;
  currentGoal: string;
  currentAction: string;
  migrationTarget: { x: number; y: number } | null;
  migrationCooldown: number;
  combatCooldown: number;
  /** Action we're locked into until commitment expires (reduces thrashing / micro-rest). */
  committedAction: string;
  /** Ticks remaining on the current commitment; 0 means pick a new action next tick. */
  actionCommitTicks: number;
  /** How long since this agent was near their home settlement (members only). */
  ticksSinceSettlementVisit: number;
  /** Consecutive ticks without changing grid cell while a movement action expects travel. */
  gridStagnationTicks: number;
  /** 0–100: discomfort with staying at the current settlement; must rise before migrating away. */
  settlementIntolerance: number;
  /** After land rush, only agents with charge may attempt to found (from settlement splinters). */
  splinterFoundingCharge: number;
  avatar: AgentAvatar;
};

export type SettlementStatus = 'growing' | 'stable' | 'starving' | 'abandoned';

export type Settlement = {
  id: number;
  name: string;
  color: string;
  founderId: number;
  /** Governing figure for this polity (same town identity for politics + territory). */
  leaderId: number;
  x: number;
  y: number;
  population: number;
  foodStored: number;
  woodStored: number;
  stoneStored: number;
  ageDays: number;
  status: SettlementStatus;
};

export type SimEvent = {
  id: number;
  day: number;
  type: string;
  summary: string;
  importance: number;
  source?: 'base' | 'module';
  moduleId?: string;
  agentIds?: number[];
  settlementIds?: number[];
  x?: number;
  y?: number;
};

export type ModuleConfigEntry = {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
};

export type ModuleConfigState = {
  modules: ModuleConfigEntry[];
};

export type Cell = {
  x: number;
  y: number;
  terrain: TerrainType;
  food: number;
  wood: number;
  stone: number;
  settlementId: number | null;
};

export type World = {
  width: number;
  height: number;
  cells: Cell[];
};

export type WorldStats = {
  peakPopulation: number;
  currentPopulation: number;
  totalDeaths: number;
  settlementsFounded: number;
  largestSettlementPopulation: number;
  dominantSettlementId: number | null;
  lastSurvivorId: number | null;
  populationHistory: number[];
  settlementHistory: number[];
  deathHistory: number[];
};

export type SimConfig = {
  worldWidth: number;
  worldHeight: number;
  startAgentCount: number;
  ticksPerDay: number;
  maxDays: number;
  foodSpawnRate: number;
  woodSpawnRate: number;
  stoneSpawnRate: number;
  movementCost: number;
  hungerRate: number;
  energyRate: number;
  starvationDamage: number;
  exhaustionDamage: number;
  settlementThreshold: number;
  dominanceThreshold: number;
};

/** Short-lived map markers for battles and notable gathers (decay each tick). */
export type WorldCue = {
  id: number;
  kind: 'fight' | 'major_fight' | 'gather_food' | 'gather_wood';
  x: number;
  y: number;
  ttl: number;
};

export type SimulationState = {
  seed: number;
  tick: number;
  day: number;
  phase: 'running' | 'ended';
  endReason: 'all_dead' | 'settlement_dominance' | 'max_day' | 'module' | null;
  config: SimConfig;
  world: World;
  agents: Agent[];
  settlements: Settlement[];
  events: SimEvent[];
  stats: WorldStats;
  moduleConfig: ModuleConfigState;
  moduleEndReason: string | null;
  worldCues: WorldCue[];
  selectedAgentId: number | null;
  selectedSettlementId: number | null;
};

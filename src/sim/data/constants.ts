import type { SimConfig, WorldStats } from '../types/simTypes';

export const DEFAULT_CONFIG: SimConfig = {
  worldWidth: 200,
  worldHeight: 125,
  startAgentCount: 100,
  ticksPerDay: 120,
  maxDays: 200,
  foodSpawnRate: 0.08,
  woodSpawnRate: 0.06,
  stoneSpawnRate: 0.04,
  movementCost: 1,
  hungerRate: 0.08,
  energyRate: 0.05,
  starvationDamage: 0.6,
  exhaustionDamage: 0.3,
  settlementThreshold: 6,
  dominanceThreshold: 0.7,
};

/** Settlers need this much accumulated frustration with home before they may migrate away. */
export const MIN_INTOLERANCE_TO_LEAVE_SETTLEMENT = 56;

/** New settlements get this many in-game days before full reserve pressure applies. */
export const SETTLEMENT_GRACE_DAYS = 2.5;

/** Independent founding (not from a splinter) is only natural in this window (roughly the first 10 days). */
export const LAND_RUSH_END_DAY = 10;

/** Only this fraction of agents may *independently* try to found (deterministic per agent); splinters ignore this. */
export const FOUNDER_ELIGIBLE_PERCENT = 16;

/** Later splinters only fire from settlements at least this big (people to spare). */
export const SPLINTER_MIN_POPULATION = 6;

/** ~1 splinter roll per this many in-game days per eligible settlement (deterministic). */
export const SPLINTER_DAY_SPAN = 18;

export const EMPTY_WORLD_STATS: WorldStats = {
  peakPopulation: 0,
  currentPopulation: 0,
  totalDeaths: 0,
  settlementsFounded: 0,
  largestSettlementPopulation: 0,
  dominantSettlementId: null,
  lastSurvivorId: null,
  populationHistory: [],
  settlementHistory: [],
  deathHistory: [],
};

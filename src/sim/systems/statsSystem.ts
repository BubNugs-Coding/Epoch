import type { SimConfig, WorldStats } from '../types/simTypes';

type StatsInput = {
  previous: WorldStats;
  aliveCount: number;
  settlementCount: number;
  newDeaths: number;
  settlementsFoundedDelta: number;
  largestSettlementPopulation: number;
  config: SimConfig;
  tick: number;
  dominantSettlementId: number | null;
};

export function updateStats({
  previous,
  aliveCount,
  settlementCount,
  newDeaths,
  settlementsFoundedDelta,
  largestSettlementPopulation,
  config,
  tick,
  dominantSettlementId,
}: StatsInput): WorldStats {
  const next: WorldStats = {
    ...previous,
    currentPopulation: aliveCount,
    peakPopulation: Math.max(previous.peakPopulation, aliveCount),
    totalDeaths: previous.totalDeaths + newDeaths,
    settlementsFounded: previous.settlementsFounded + settlementsFoundedDelta,
    largestSettlementPopulation: Math.max(previous.largestSettlementPopulation, largestSettlementPopulation),
    dominantSettlementId,
  };

  if (tick % config.ticksPerDay === 0) {
    next.populationHistory = [...previous.populationHistory, aliveCount];
    next.settlementHistory = [...previous.settlementHistory, settlementCount];
    next.deathHistory = [...previous.deathHistory, next.totalDeaths];
  }

  return next;
}

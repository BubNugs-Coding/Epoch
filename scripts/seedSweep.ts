import { initializeSimulation } from '../src/sim/engine/simulation';
import { stepSimulation } from '../src/sim/engine/tick';

type SeedSummary = {
  seed: number;
  endReason: string | null;
  day: number;
  survivors: number;
  totalDeaths: number;
  settlementsFounded: number;
  dominanceEvents: number;
  battles: number;
  majorBattles: number;
  migrationsStarted: number;
  migrationsCompleted: number;
  profile: 'balanced' | 'war-heavy' | 'settlement-heavy' | 'unstable';
};

const seeds = [1001, 1002, 1003, 1004, 1005, 1201, 1202, 1203, 1401, 1601];
const summaries: SeedSummary[] = [];

for (const seed of seeds) {
  let state = initializeSimulation(seed);
  const tickLimit = state.config.maxDays * state.config.ticksPerDay + 5000;

  for (let i = 0; i < tickLimit && state.phase !== 'ended'; i += 1) {
    state = stepSimulation(state);
  }

  const battles = state.events.filter((event) => event.type === 'battle_occurred').length;
  const majorBattles = state.events.filter((event) => event.type === 'major_battle_occurred').length;
  const migrationsStarted = state.events.filter((event) => event.type === 'migration_started').length;
  const migrationsCompleted = state.events.filter((event) => event.type === 'migration_completed').length;
  const dominanceEvents = state.events.filter((event) => event.type === 'dominant_settlement_emerged').length;

  const summary: Omit<SeedSummary, 'profile'> = {
    seed,
    endReason: state.endReason,
    day: state.day,
    survivors: state.stats.currentPopulation,
    totalDeaths: state.stats.totalDeaths,
    settlementsFounded: state.stats.settlementsFounded,
    dominanceEvents,
    battles,
    majorBattles,
    migrationsStarted,
    migrationsCompleted,
  };

  summaries.push({
    ...summary,
    profile: classifySeed(summary),
  });
}

const avg = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

const aggregate = {
  avgSurvivors: avg(summaries.map((s) => s.survivors)),
  avgDeaths: avg(summaries.map((s) => s.totalDeaths)),
  avgSettlements: avg(summaries.map((s) => s.settlementsFounded)),
  avgDominanceEvents: avg(summaries.map((s) => s.dominanceEvents)),
  totalBattles: sum(summaries.map((s) => s.battles)),
  totalMajorBattles: sum(summaries.map((s) => s.majorBattles)),
  totalMigrationsStarted: sum(summaries.map((s) => s.migrationsStarted)),
  totalMigrationsCompleted: sum(summaries.map((s) => s.migrationsCompleted)),
  endReasons: summaries.reduce<Record<string, number>>((acc, summary) => {
    const key = summary.endReason ?? 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {}),
  profileCounts: summaries.reduce<Record<string, number>>((acc, summary) => {
    acc[summary.profile] = (acc[summary.profile] ?? 0) + 1;
    return acc;
  }, {}),
};

const recommendations = {
  balanced: summaries.filter((s) => s.profile === 'balanced').map((s) => s.seed),
  warHeavy: summaries.filter((s) => s.profile === 'war-heavy').map((s) => s.seed),
  settlementHeavy: summaries.filter((s) => s.profile === 'settlement-heavy').map((s) => s.seed),
};

console.log(JSON.stringify({ summaries, aggregate, recommendations }, null, 2));

function classifySeed(summary: Omit<SeedSummary, 'profile'>): SeedSummary['profile'] {
  if (summary.battles >= 260 || summary.majorBattles >= 75) {
    return 'war-heavy';
  }

  if (summary.settlementsFounded >= 6 && summary.dominanceEvents >= 1 && summary.battles <= 220) {
    return 'settlement-heavy';
  }

  if (summary.survivors >= 9 && summary.survivors <= 24 && summary.settlementsFounded >= 2 && summary.migrationsCompleted >= 3) {
    return 'balanced';
  }

  return 'unstable';
}

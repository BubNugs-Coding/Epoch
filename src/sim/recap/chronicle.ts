import type { Agent, SimEvent, SimulationState } from '../types/simTypes';

export type Chronicle = {
  title: string;
  subtitle: string;
  opening: string;
  rise: string;
  conflict: string;
  ending: string;
  notableFigures: Array<{ label: string; value: string }>;
  keyStats: Array<{ label: string; value: string }>;
};

export function generateChronicle(state: SimulationState): Chronicle {
  const orderedEvents = [...state.events].sort((a, b) => a.day - b.day || a.id - b.id);
  const majorEvents = orderedEvents.filter((event) => event.importance >= 3);

  const firstSettlement = findEvent(orderedEvents, 'settlement_founded');
  const secondSettlement = findNthEventOfType(orderedEvents, 'settlement_founded', 2);
  const dominanceEmergence = findEvent(orderedEvents, 'dominant_settlement_emerged');
  const firstDeath = findEvent(orderedEvents, 'agent_died');
  const latestMajor = majorEvents.length > 0 ? majorEvents[majorEvents.length - 1] : null;

  const opening = buildOpening(firstSettlement, firstDeath);
  const rise = buildRise(state, firstSettlement, secondSettlement, dominanceEmergence);
  const conflict = buildConflict(state, majorEvents);
  const ending = buildEnding(state, latestMajor);

  return {
    title: `Chronicle of Seed ${state.seed}`,
    subtitle: buildSubtitle(state),
    opening,
    rise,
    conflict,
    ending,
    notableFigures: buildNotableFigures(state),
    keyStats: buildKeyStats(state),
  };
}

function buildSubtitle(state: SimulationState) {
  if (state.endReason === 'all_dead') {
    return 'The line of the first hundred ended.';
  }

  if (state.endReason === 'settlement_dominance') {
    return 'A single banner outlasted all rivals.';
  }

  return 'The world reached its day horizon before final collapse.';
}

function buildOpening(firstSettlement: SimEvent | null, firstDeath: SimEvent | null) {
  if (firstSettlement && firstDeath) {
    return `The first stretch was chaotic: scattered survivors raced to secure food and wood while attrition began early. By day ${firstSettlement.day}, ${normalizeSentence(firstSettlement.summary)} The first confirmed death followed by day ${firstDeath.day}, setting a grim tone for the era.`;
  }

  if (firstSettlement) {
    return `The opening days were marked by wandering bands and opportunistic gathering. Stability began to appear on day ${firstSettlement.day}, when ${normalizeSentence(firstSettlement.summary)}`;
  }

  return 'The opening era remained decentralized, with agents drifting across the map and relying on short-term foraging over durable institutions.';
}

function buildRise(
  state: SimulationState,
  firstSettlement: SimEvent | null,
  secondSettlement: SimEvent | null,
  dominanceEmergence: SimEvent | null,
) {
  if (firstSettlement && dominanceEmergence) {
    return `Settlement life expanded from a single foothold into wider political gravity. After the first founding, cohesion tightened until day ${dominanceEmergence.day}, when ${normalizeSentence(dominanceEmergence.summary)}`;
  }

  if (firstSettlement && secondSettlement) {
    return `Communities multiplied: after the first town on day ${firstSettlement.day}, a second settlement appeared on day ${secondSettlement.day}, when ${normalizeSentence(secondSettlement.summary)} Competing hubs reshaped travel and trade.`;
  }

  if (state.stats.settlementsFounded > 0) {
    return `A settlement network slowly emerged, with ${state.stats.settlementsFounded} founded in total and a peak size of ${state.stats.largestSettlementPopulation}. These hubs shaped migration and resource flow even when no single polity dominated.`;
  }

  return 'No lasting civic structure formed; attempts at clustering remained temporary and vulnerable to hunger cycles.';
}

function buildConflict(state: SimulationState, majorEvents: SimEvent[]) {
  const deaths = state.events.filter((event) => event.type === 'agent_died').length;
  const migrations = state.events.filter((event) => event.type === 'migration_completed').length;
  const battles = state.events.filter((event) => event.type === 'battle_occurred' || event.type === 'major_battle_occurred').length;
  const dominanceEvent = findLastEvent(state.events, 'dominant_settlement_emerged');

  if (dominanceEvent) {
    return `Pressure between groups escalated through repeated losses and shifting alliances. ${deaths} total deaths, ${battles} battle events, and ${migrations} completed migrations were recorded, and by day ${dominanceEvent.day}, ${normalizeSentence(dominanceEvent.summary)} That moment effectively ended multipolar competition.`;
  }

  if (state.stats.settlementsFounded >= 2) {
    return `Multiple towns competed for people and stores. ${state.stats.settlementsFounded} settlements were founded over the run, while ${deaths} deaths, ${battles} clashes, and ${migrations} migrations reflected recurring flashpoints around resource-rich zones.`;
  }

  if (majorEvents.length > 0) {
    const highlight = majorEvents[Math.max(0, majorEvents.length - 1)];
    return `Conflict stayed local rather than ideological. Major stress points still appeared, including day ${highlight.day} when ${normalizeSentence(highlight.summary)}`;
  }

  return 'Large-scale conflict never fully materialized; scarcity created tension, but pressure remained diffuse rather than organized.';
}

function buildEnding(state: SimulationState, latestMajor: SimEvent | null) {
  const reasonText =
    state.endReason === 'all_dead'
      ? 'The civilization exhausted itself completely.'
      : state.endReason === 'settlement_dominance'
        ? 'The run ended with clear political consolidation.'
        : 'The run paused at the configured maximum day.';

  const anchor = latestMajor
    ? `The late period was defined by day ${latestMajor.day}, when ${normalizeSentence(latestMajor.summary)}`
    : 'The late period saw diminishing momentum and fewer decisive turns.';

  return `${reasonText} ${anchor} Final survivors: ${state.stats.currentPopulation}.`;
}

function buildNotableFigures(state: SimulationState) {
  const founder = firstAgentFromEvent(state, 'settlement_founded');
  const longestLived = [...state.agents].sort((a, b) => b.ageDays - a.ageDays)[0] ?? null;
  const lastSurvivor = state.agents.find((agent) => agent.alive) ?? null;
  const deadliest = findDeadliestFighter(state);
  const dominantLabel = settlementLabel(state, state.stats.dominantSettlementId);

  return [
    { label: 'First Founder', value: founder?.name ?? 'None' },
    {
      label: 'Longest Lived',
      value: longestLived ? `${longestLived.name} (${longestLived.ageDays.toFixed(1)} days)` : 'Unknown',
    },
    { label: 'Dominant polity', value: dominantLabel },
    { label: 'Deadliest Fighter', value: deadliest?.name ?? 'Unknown' },
    { label: 'Last Survivor', value: lastSurvivor?.name ?? 'None' },
  ];
}

function buildKeyStats(state: SimulationState) {
  const dominantLabel = settlementLabel(state, state.stats.dominantSettlementId);

  return [
    { label: 'Days Simulated', value: `${state.day}` },
    { label: 'Peak Population', value: `${state.stats.peakPopulation}` },
    { label: 'Total Deaths', value: `${state.stats.totalDeaths}` },
    { label: 'Settlements Founded', value: `${state.stats.settlementsFounded}` },
    { label: 'Dominant settlement', value: dominantLabel },
    { label: 'Largest Settlement', value: `${state.stats.largestSettlementPopulation}` },
    { label: 'Final Survivors', value: `${state.stats.currentPopulation}` },
  ];
}

function settlementLabel(state: SimulationState, id: number | null) {
  if (id == null) {
    return 'None';
  }
  const s = state.settlements.find((x) => x.id === id);
  return s ? `${s.name} (#${s.id})` : `#${id}`;
}

function normalizeSentence(text: string) {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return '';
  }

  const withoutFinalPeriod = trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed;
  const lower = withoutFinalPeriod.charAt(0).toLowerCase() + withoutFinalPeriod.slice(1);
  return `${lower}.`;
}

function firstAgentFromEvent(state: SimulationState, type: string) {
  const event = findEvent(state.events, type);
  if (!event?.agentIds || event.agentIds.length === 0) {
    return null;
  }

  return findAgent(state.agents, event.agentIds[0]);
}

function findEvent(events: SimEvent[], type: string) {
  return events.find((event) => event.type === type) ?? null;
}

function findNthEventOfType(events: SimEvent[], type: string, n: number): SimEvent | null {
  let seen = 0;
  for (const event of events) {
    if (event.type === type) {
      seen += 1;
      if (seen === n) {
        return event;
      }
    }
  }
  return null;
}

function findLastEvent(events: SimEvent[], type: string) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].type === type) {
      return events[i];
    }
  }

  return null;
}

function findAgent(agents: Agent[], id: number) {
  return agents.find((agent) => agent.id === id) ?? null;
}

function findDeadliestFighter(state: SimulationState) {
  const wins = new Map<number, number>();
  for (const event of state.events) {
    if ((event.type !== 'battle_occurred' && event.type !== 'major_battle_occurred') || !event.agentIds || event.agentIds.length < 2) {
      continue;
    }

    const winnerId = event.agentIds[0];
    wins.set(winnerId, (wins.get(winnerId) ?? 0) + 1);
  }

  let best: { id: number; wins: number } | null = null;
  for (const [id, count] of wins.entries()) {
    if (!best || count > best.wins) {
      best = { id, wins: count };
    }
  }

  return best ? findAgent(state.agents, best.id) : null;
}

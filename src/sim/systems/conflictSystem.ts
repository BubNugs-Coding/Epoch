import type { Agent, SimConfig, SimEvent } from '../types/simTypes';
import { clamp, deterministicInt, getCell, manhattanDistance } from './simHelpers';
import type { MutableSimState } from './simHelpers';

// Resolves local conflict under scarcity/territory pressure.
export function runConflictSystem(state: MutableSimState, config: SimConfig): SimEvent[] {
  const events: SimEvent[] = [];
  const processedPairs = new Set<string>();

  const aliveAgents = state.agents.filter((agent) => agent.alive);

  for (const attacker of aliveAgents) {
    const target = pickTarget(attacker, state.agents);
    if (!target) {
      continue;
    }

    const pairKey = makePairKey(attacker.id, target.id);
    if (processedPairs.has(pairKey)) {
      continue;
    }

    if (!shouldFight(attacker, target, state, config)) {
      continue;
    }

    processedPairs.add(pairKey);

    const attackerPower = computePower(attacker, state.agents, state.tick);
    const defenderPower = computePower(target, state.agents, state.tick + 91);

    resolveEncounter(attacker, target, attackerPower, defenderPower, state, events);
  }

  return events;
}

function pickTarget(agent: Agent, agents: Agent[]) {
  let best: Agent | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of agents) {
    if (!candidate.alive || candidate.id === agent.id) {
      continue;
    }

    if (!isHostile(agent, candidate)) {
      continue;
    }

    const distance = manhattanDistance(agent.x, agent.y, candidate.x, candidate.y);
    if (distance <= 1 && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}

function shouldFight(attacker: Agent, defender: Agent, state: MutableSimState, config: SimConfig) {
  if (attacker.combatCooldown > 0 || defender.combatCooldown > 0) {
    return false;
  }

  const attackerCell = getCell(state.world, attacker.x, attacker.y);
  const scarcityPressure = (attackerCell?.food ?? 0) < 0.5 || attacker.hunger > 80;
  const aggressive = attacker.traits.includes('aggressive');
  const cautious = attacker.traits.includes('cautious');

  // Tuned to make fights emerge from pressure rather than constant background noise.
  const baseChance = scarcityPressure ? 30 : 4;
  const aggressiveBonus = aggressive ? 14 : 0;
  const cautiousPenalty = cautious ? -18 : 0;
  const settlementPressure =
    attacker.settlementId != null && defender.settlementId != null && attacker.settlementId !== defender.settlementId
      ? 7
      : 0;

  const roll = deterministicInt(attacker.id * 137 + defender.id * 59 + state.tick * 17, 1, 100);
  const threshold = clamp(baseChance + aggressiveBonus + cautiousPenalty + settlementPressure, 2, 80);

  const socialTrigger = aggressive || settlementPressure > 0;
  return roll <= threshold && attacker.energy > config.energyRate && (scarcityPressure || socialTrigger);
}

function computePower(agent: Agent, agents: Agent[], seed: number) {
  const allyCount = agents.filter(
    (candidate) =>
      candidate.alive &&
      candidate.id !== agent.id &&
      manhattanDistance(candidate.x, candidate.y, agent.x, agent.y) <= 2 &&
      candidate.settlementId != null &&
      candidate.settlementId === agent.settlementId,
  ).length;

  const traitBonus =
    (agent.traits.includes('aggressive') ? 10 : 0) +
    (agent.traits.includes('resilient') ? 7 : 0) +
    (agent.traits.includes('cautious') ? -5 : 0);

  const variance = deterministicInt(seed + agent.id * 23, -6, 6);

  return agent.health + agent.energy * 0.35 + allyCount * 8 + traitBonus + variance;
}

function resolveEncounter(
  attacker: Agent,
  defender: Agent,
  attackerPower: number,
  defenderPower: number,
  state: MutableSimState,
  events: SimEvent[],
) {
  const diff = attackerPower - defenderPower;
  const winner = diff >= 0 ? attacker : defender;
  const loser = diff >= 0 ? defender : attacker;

  if (Math.abs(diff) >= 18) {
    loser.health = clamp(loser.health - (18 + Math.abs(diff) * 0.18), 0, 100);
  } else {
    loser.health = clamp(loser.health - 9, 0, 100);
    loser.energy = clamp(loser.energy - 14, 0, 100);
    // Flee by stepping one cell away when possible.
    loser.x = clamp(loser.x + Math.sign(loser.x - winner.x), 0, state.world.width - 1);
    loser.y = clamp(loser.y + Math.sign(loser.y - winner.y), 0, state.world.height - 1);
  }

  winner.energy = clamp(winner.energy - 7, 0, 100);

  const eventType = loser.health <= 0 ? 'major_battle_occurred' : 'battle_occurred';
  const summary =
    loser.health <= 0
      ? `${winner.name} killed ${loser.name} in a local clash.`
      : `${winner.name} forced ${loser.name} to flee after a skirmish.`;

  events.push({
    id: 0,
    day: state.day,
    type: eventType,
    summary,
    importance: loser.health <= 0 ? 3 : 2,
    agentIds: [winner.id, loser.id],
    settlementIds: compactSettlementIds([winner.settlementId, loser.settlementId]),
    x: winner.x,
    y: winner.y,
  });

  // Cooldown prevents rapid repeated skirmishes on adjacent tiles.
  winner.combatCooldown = 20;
  loser.combatCooldown = 20;
}

function isHostile(a: Agent, b: Agent) {
  if (a.settlementId != null && b.settlementId != null) {
    return a.settlementId !== b.settlementId;
  }

  // Homeless agents can still clash under scarcity pressure.
  return true;
}

function makePairKey(a: number, b: number) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function compactSettlementIds(values: Array<number | null>) {
  return Array.from(new Set(values.filter((value): value is number => value != null)));
}

import {
  LAND_RUSH_END_DAY,
  SETTLEMENT_GRACE_DAYS,
  SPLINTER_DAY_SPAN,
  SPLINTER_MIN_POPULATION,
} from '../data/constants';
import type { SimConfig, SimEvent, Settlement } from '../types/simTypes';
import { deterministicInt, getCell, manhattanDistance } from './simHelpers';
import type { MutableSimState } from './simHelpers';
import { resetSettlementIntolerance } from './settlementIntolerance';

const SETTLEMENT_COLORS = ['#f2a65a', '#65c8b8', '#8a80d8', '#e58fbc', '#d4be68', '#6ea7df'];

// Handles founding, joining, and lightweight settlement lifecycle updates.
export function runSettlementSystem(state: MutableSimState, config: SimConfig): SimEvent[] {
  const events: SimEvent[] = [];

  runSettlementSplinters(state, config, events);

  for (const agent of state.agents) {
    if (!agent.alive || agent.settlementId != null) {
      continue;
    }

    if (agent.currentAction === 'foundSettlement' && canFoundSettlement(state, agent.id, config)) {
      const settlement = createSettlement(state, agent.id);
      state.settlements.push(settlement);
      agent.settlementId = settlement.id;
      resetSettlementIntolerance(agent);
      agent.splinterFoundingCharge = 0;
      consumeFoundingCost(agent);
      markSettlementCell(state, settlement.id, settlement.x, settlement.y);

      events.push({
        id: 0,
        day: state.day,
        type: 'settlement_founded',
        summary: `${agent.name} founded ${settlement.name}.`,
        importance: 3,
        agentIds: [agent.id],
        settlementIds: [settlement.id],
        x: settlement.x,
        y: settlement.y,
      });
      continue;
    }

    if (agent.currentAction === 'joinSettlement') {
      const nearest = findNearestSettlement(state.settlements, agent.x, agent.y);
      if (nearest && nearest.distance <= 1) {
        agent.settlementId = nearest.settlement.id;
        resetSettlementIntolerance(agent);
        agent.splinterFoundingCharge = 0;
        nearest.settlement.population += 1;
        events.push({
          id: 0,
          day: state.day,
          type: 'agent_joined_settlement',
          summary: `${agent.name} joined ${nearest.settlement.name}.`,
          importance: 2,
          agentIds: [agent.id],
          settlementIds: [nearest.settlement.id],
          x: nearest.settlement.x,
          y: nearest.settlement.y,
        });
      }
    }
  }

  for (const settlement of state.settlements) {
    const livingResidents = state.agents.filter((agent) => agent.alive && agent.settlementId === settlement.id).length;
    settlement.population = livingResidents;
    settlement.ageDays += 1 / config.ticksPerDay;

    const reserves = settlement.foodStored + settlement.woodStored + settlement.stoneStored;
    const inGrace = settlement.ageDays < SETTLEMENT_GRACE_DAYS;
    const starvingCutoff = inGrace ? 4 : 8;

    if (livingResidents === 0) {
      settlement.status = 'abandoned';
    } else if (reserves < starvingCutoff) {
      settlement.status = 'starving';
    } else if (reserves > 20) {
      settlement.status = 'stable';
    } else {
      settlement.status = 'growing';
    }
  }

  return events;
}

/** After the land rush, new towns mostly come from overcrowded settlements sending founders. */
function runSettlementSplinters(state: MutableSimState, config: SimConfig, events: SimEvent[]) {
  if (state.day <= LAND_RUSH_END_DAY || state.tick <= 0 || state.tick % config.ticksPerDay !== 0) {
    return;
  }

  for (const settlement of state.settlements) {
    if (settlement.status === 'abandoned') {
      continue;
    }

    const residents = state.agents.filter((a) => a.alive && a.settlementId === settlement.id);
    if (residents.length < SPLINTER_MIN_POPULATION) {
      continue;
    }

    if (deterministicInt(state.seed + settlement.id * 5003 + state.day, 1, SPLINTER_DAY_SPAN) !== 1) {
      continue;
    }

    const ambitious = residents.filter((a) => a.traits.includes('ambitious'));
    if (ambitious.length < 2) {
      continue;
    }

    const pick = ambitious[deterministicInt(state.seed + state.tick * 17 + settlement.id * 91, 0, ambitious.length - 1)];
    pick.splinterFoundingCharge = 1;
    pick.settlementId = null;
    pick.settlementIntolerance = 0;

    events.push({
      id: 0,
      day: state.day,
      type: 'settlement_splinter',
      summary: `${pick.name} left ${settlement.name} to try founding elsewhere.`,
      importance: 3,
      agentIds: [pick.id],
      settlementIds: [settlement.id],
      x: pick.x,
      y: pick.y,
    });
  }
}

function canFoundSettlement(state: MutableSimState, agentId: number, config: SimConfig) {
  const agent = state.agents.find((item) => item.id === agentId);
  if (!agent || !agent.alive || agent.settlementId != null) {
    return false;
  }

  if (agent.inventory.food < 1.5 || agent.inventory.wood < 1) {
    return false;
  }

  if (agent.health < 45 || agent.energy < 28) {
    return false;
  }

  const nearby = findNearestSettlement(state.settlements, agent.x, agent.y);
  if (nearby && nearby.distance < config.settlementThreshold) {
    return false;
  }

  const cell = getCell(state.world, agent.x, agent.y);
  if (!cell || cell.terrain === 'water') {
    return false;
  }

  const resourceScore = cell.food + cell.wood + cell.stone;
  return resourceScore >= 1.15;
}

function createSettlement(state: MutableSimState, founderId: number): Settlement {
  const founder = state.agents.find((item) => item.id === founderId);
  if (!founder) {
    throw new Error('Founder missing when creating settlement.');
  }

  return {
    id: state.settlements.length > 0 ? Math.max(...state.settlements.map((s) => s.id)) + 1 : 1,
    name: `${founder.name.split(' ')[0]} Hollow`,
    color: pickSettlementColor(state.settlements),
    founderId,
    leaderId: founderId,
    x: founder.x,
    y: founder.y,
    population: 1,
    foodStored: 6,
    woodStored: 5,
    stoneStored: 1,
    ageDays: 0,
    status: 'growing',
  };
}

function pickSettlementColor(existing: Settlement[]) {
  const nextIndex = existing.length % SETTLEMENT_COLORS.length;
  return SETTLEMENT_COLORS[nextIndex];
}

function consumeFoundingCost(agent: MutableSimState['agents'][number]) {
  agent.inventory.food = Math.max(0, agent.inventory.food - 2);
  agent.inventory.wood = Math.max(0, agent.inventory.wood - 2);
}

function markSettlementCell(state: MutableSimState, settlementId: number, x: number, y: number) {
  const cell = getCell(state.world, x, y);
  if (cell) {
    cell.settlementId = settlementId;
  }
}

function findNearestSettlement(settlements: Settlement[], x: number, y: number) {
  let best: { settlement: Settlement; distance: number } | null = null;

  for (const settlement of settlements) {
    if (settlement.status === 'abandoned') {
      continue;
    }

    const distance = manhattanDistance(x, y, settlement.x, settlement.y);
    if (!best || distance < best.distance) {
      best = { settlement, distance };
    }
  }

  return best;
}

import {
  FOUNDER_ELIGIBLE_PERCENT,
  LAND_RUSH_END_DAY,
  MIN_INTOLERANCE_TO_LEAVE_SETTLEMENT,
} from '../data/constants';
import type { Agent, SimConfig, Settlement } from '../types/simTypes';
import { deterministicInt, getCell, manhattanDistance } from './simHelpers';
import type { MutableSimState } from './simHelpers';
import { simModuleManager } from '../modules';
import { pickHumanGoal } from '../narrative/humanGoals';

const ACTIONS = [
  'explore',
  'findFood',
  'gatherWood',
  'eatFromInventory',
  'rest',
  'joinSettlement',
  'returnHome',
  'depositResources',
  'foundSettlement',
  'migrate',
] as const;

type ActionType = (typeof ACTIONS)[number];

const VISIT_RETURN_PRESSURE_TICKS = 300;

/** Last ~38% of each day counts as night — main sleep window. */
export function isNightTick(tick: number, ticksPerDay: number): boolean {
  if (ticksPerDay <= 0) {
    return false;
  }
  const t = ((tick % ticksPerDay) + ticksPerDay) % ticksPerDay;
  const nightStart = Math.floor(ticksPerDay * 0.62);
  return t >= nightStart;
}

function ticksRemainingInDay(tick: number, ticksPerDay: number): number {
  const t = ((tick % ticksPerDay) + ticksPerDay) % ticksPerDay;
  return ticksPerDay - t;
}

/** Members away from home accumulate; reset when near their settlement. */
export function updateSettlementVisitCounters(state: MutableSimState) {
  for (const agent of state.agents) {
    if (!agent.alive) {
      continue;
    }

    if (agent.settlementId == null) {
      agent.ticksSinceSettlementVisit = 0;
      continue;
    }

    const home = state.settlements.find((s) => s.id === agent.settlementId && s.status !== 'abandoned');
    if (!home) {
      agent.ticksSinceSettlementVisit += 1;
      continue;
    }

    if (manhattanDistance(agent.x, agent.y, home.x, home.y) <= 2) {
      agent.ticksSinceSettlementVisit = 0;
    } else {
      agent.ticksSinceSettlementVisit += 1;
    }
  }
}

// Picks one action per tick using weighted survival + social heuristics.
export function runDecisionSystem(state: MutableSimState, config: SimConfig) {
  for (const agent of state.agents) {
    if (!agent.alive) {
      continue;
    }

    const nearestSettlement = findNearestSettlement(state.settlements, agent.x, agent.y);
    const carry = agent.inventory.food + agent.inventory.wood + agent.inventory.stone;

    if (agent.actionCommitTicks > 0 && !shouldForceBreakCommit(agent, state, config, carry)) {
      agent.actionCommitTicks -= 1;
      agent.currentAction = agent.committedAction;
      applyGoalForAction(agent, agent.currentAction, state, config);
      continue;
    }

    agent.actionCommitTicks = 0;

    const action = chooseAction(agent, state, config, nearestSettlement?.distance ?? null, carry);
    agent.currentAction = action;
    agent.committedAction = action;
    agent.actionCommitTicks = computeCommitTicks(action, agent, state, config);

    applyGoalForAction(agent, action, state, config);
  }
}

function applyGoalForAction(agent: Agent, action: string, state: MutableSimState, config: SimConfig) {
  agent.currentGoal = pickHumanGoal(agent, action, state, isNightTick(state.tick, config.ticksPerDay));
}

function shouldForceBreakCommit(
  agent: Agent,
  state: MutableSimState,
  config: SimConfig,
  carry: number,
): boolean {
  if (agent.health < 18) {
    return true;
  }
  if (agent.hunger > 94) {
    return true;
  }
  if (agent.hunger > 88 && agent.inventory.food > 0) {
    return true;
  }
  if (agent.energy < 7) {
    return true;
  }
  if (agent.gridStagnationTicks > 14) {
    return true;
  }

  if (agent.committedAction === 'depositResources' && carry <= 0) {
    return true;
  }
  if (agent.committedAction === 'eatFromInventory' && agent.inventory.food <= 0) {
    return true;
  }
  if (agent.committedAction === 'migrate' && !agent.migrationTarget) {
    return true;
  }

  if (agent.committedAction === 'returnHome' && agent.settlementId != null && carry <= 0) {
    const home = state.settlements.find((s) => s.id === agent.settlementId && s.status !== 'abandoned');
    if (home && manhattanDistance(agent.x, agent.y, home.x, home.y) <= 2) {
      return true;
    }
  }

  if (agent.committedAction === 'joinSettlement' && agent.settlementId != null) {
    return true;
  }

  if (agent.committedAction === 'rest' && !isNightTick(state.tick, config.ticksPerDay) && agent.energy > 22) {
    return true;
  }

  if (agent.committedAction === 'foundSettlement' && agent.settlementId == null) {
    const stuck =
      state.day <= LAND_RUSH_END_DAY || agent.splinterFoundingCharge > 0
        ? agent.gridStagnationTicks > 26
        : agent.gridStagnationTicks > 12;
    if (stuck) {
      return true;
    }
  }

  return false;
}

function computeCommitTicks(action: ActionType, agent: Agent, state: MutableSimState, config: SimConfig): number {
  const seed = state.seed + agent.id * 977 + state.tick * 31;

  switch (action) {
    case 'explore':
      return deterministicInt(seed, 10, 22);
    case 'findFood':
      return deterministicInt(seed + 1, 14, 30);
    case 'gatherWood':
      return deterministicInt(seed + 2, 12, 26);
    case 'eatFromInventory':
      return deterministicInt(seed + 3, 2, 4);
    case 'rest': {
      if (isNightTick(state.tick, config.ticksPerDay)) {
        const nightLeft = ticksRemainingInDay(state.tick, config.ticksPerDay);
        const span = Math.max(18, Math.min(48, deterministicInt(seed + 4, 22, 44)));
        return Math.min(span, nightLeft);
      }
      return deterministicInt(seed + 5, 8, 16);
    }
    case 'joinSettlement':
      return deterministicInt(seed + 6, 22, 44);
    case 'returnHome':
      return deterministicInt(seed + 7, 28, 56);
    case 'depositResources':
      return deterministicInt(seed + 8, 18, 38);
    case 'foundSettlement': {
      const landRush = state.day <= LAND_RUSH_END_DAY;
      if (landRush && agent.settlementId == null) {
        return deterministicInt(seed + 9, 48, 88);
      }
      if (agent.splinterFoundingCharge > 0) {
        return deterministicInt(seed + 9, 32, 58);
      }
      return deterministicInt(seed + 9, 10, 18);
    }
    case 'migrate':
      return deterministicInt(seed + 10, 40, 85);
    default:
      return deterministicInt(seed + 11, 10, 20);
  }
}

function chooseAction(
  agent: Agent,
  state: MutableSimState,
  config: SimConfig,
  nearestSettlementDistance: number | null,
  carry: number,
): ActionType {
  const localCell = getCell(state.world, agent.x, agent.y);
  const localFood = localCell?.food ?? 0;
  const localWood = localCell?.wood ?? 0;
  const resilientBias = agent.traits.includes('resilient') ? -6 : 0;
  const exploreBias = agent.traits.includes('curious') ? 10 : 0;
  const ambitiousBias = agent.traits.includes('ambitious') ? 16 : 0;
  const cooperativeBias = agent.traits.includes('cooperative') ? 10 : 0;

  const isHomeless = agent.settlementId == null;
  const night = isNightTick(state.tick, config.ticksPerDay);
  const visitOverdue = agent.settlementId != null && agent.ticksSinceSettlementVisit > VISIT_RETURN_PRESSURE_TICKS;
  const mayLeaveSettlement =
    agent.settlementId == null || agent.settlementIntolerance >= MIN_INTOLERANCE_TO_LEAVE_SETTLEMENT;

  const landRush = state.day <= LAND_RUSH_END_DAY;
  const inFounderPool =
    deterministicInt(state.seed + agent.id * 7919, 1, 100) <= FOUNDER_ELIGIBLE_PERCENT;
  const canAttemptIndependentFound =
    isHomeless &&
    (agent.splinterFoundingCharge > 0 || (landRush && inFounderPool));

  const scores: Record<ActionType, number> = {
    eatFromInventory: agent.inventory.food > 0 ? agent.hunger + 26 : -1000,
    findFood: agent.hunger + localFood * 12 + (agent.inventory.food === 0 ? 10 : 0) + resilientBias,
    gatherWood: isHomeless ? 24 + localWood * 10 + ambitiousBias * 0.4 : 10 + localWood * 8,
    rest: scoreRest(agent, night),
    explore: 18 + exploreBias + Math.max(0, 70 - agent.hunger) * 0.2 + Math.max(0, agent.energy - 30) * 0.18,
    joinSettlement:
      isHomeless && nearestSettlementDistance != null
        ? 18 + cooperativeBias + Math.max(0, 18 - nearestSettlementDistance) * 1.2
        : -1000,
    returnHome:
      agent.settlementId != null && (carry >= 1 || visitOverdue)
        ? 38 + carry * 2 + (visitOverdue ? 42 : 0)
        : -1000,
    depositResources: agent.settlementId != null && carry > 0 ? 22 + carry * 2.2 : -1000,
    foundSettlement: canAttemptIndependentFound
      ? ambitiousBias * 0.5 +
        cooperativeBias * 0.2 +
        scoreSettlementFounding(agent, localCell, state.day) +
        (landRush && inFounderPool ? 18 : 0) +
        (agent.splinterFoundingCharge > 0 ? 22 : 0)
      : -1000,
    migrate:
      mayLeaveSettlement &&
      ((localFood < 0.58 && agent.hunger > 70) || (localWood < 0.42 && isHomeless && agent.energy > 38))
        ? 22 + Math.max(0, agent.hunger - 64) * 0.55 + (agent.traits.includes('curious') ? 8 : 0)
        : -1000,
  };

  if (night && agent.settlementId != null && agent.energy < 55 && scores.rest > -200) {
    scores.rest += 18;
  }

  if (agent.hunger > 88 && agent.inventory.food > 0) {
    scores.eatFromInventory += 30;
  }
  if (agent.hunger > 92) {
    scores.findFood += 28;
    scores.gatherWood -= 12;
    scores.foundSettlement -= 22;
    if (mayLeaveSettlement) {
      scores.migrate += 4;
    }
  }

  if (!night && agent.energy < 12) {
    scores.rest += 55;
    scores.explore -= 25;
    scores.foundSettlement -= 16;
  }

  if (agent.settlementId != null && carry > 0) {
    scores.returnHome += 8;
  }

  if (nearestSettlementDistance != null && nearestSettlementDistance <= 2 && isHomeless) {
    scores.joinSettlement += 28;
  } else if (nearestSettlementDistance != null && nearestSettlementDistance <= 6 && isHomeless) {
    scores.joinSettlement += 12;
  }

  if (state.day >= config.maxDays) {
    scores.explore -= 3;
  }

  if (landRush && isHomeless && inFounderPool && agent.committedAction === 'foundSettlement') {
    scores.foundSettlement += 14;
    scores.explore -= 12;
  }

  if (agent.splinterFoundingCharge > 0 && isHomeless && agent.committedAction === 'foundSettlement') {
    scores.foundSettlement += 16;
    scores.explore -= 10;
  }

  if (landRush && isHomeless && inFounderPool && agent.committedAction === 'explore' && agent.hunger < 82 && agent.energy > 22) {
    scores.explore -= 6;
  }

  simModuleManager.applyActionScoreModifiers(agent, scores, state);

  return ACTIONS.reduce((best, current) => (scores[current] > scores[best] ? current : best), 'explore');
}

function scoreRest(agent: Agent, isNight: boolean): number {
  if (isNight) {
    let s = (100 - agent.energy) * 2.4;
    if (agent.energy < 38) {
      s += 35;
    }
    if (agent.hunger > 90) {
      s -= 120;
    } else if (agent.hunger > 82) {
      s -= 45;
    }
    return s;
  }

  if (agent.energy <= 9) {
    return 210 + (9 - agent.energy) * 14;
  }
  if (agent.energy <= 14) {
    return 28;
  }
  return -320;
}

function scoreSettlementFounding(agent: Agent, localCell: ReturnType<typeof getCell>, day: number) {
  if (!localCell) {
    return -1000;
  }

  const inventoryScore = agent.inventory.food * 5 + agent.inventory.wood * 6;
  const areaScore = localCell.food * 9 + localCell.wood * 9 + localCell.stone * 3;
  let score = inventoryScore + areaScore - 34;
  if (day <= LAND_RUSH_END_DAY) {
    score += 16;
  }
  return score;
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

export type { ActionType };

import type { Settlement, SimConfig } from '../types/simTypes';
import { deterministicInt, getCell, isWalkable, manhattanDistance } from './simHelpers';
import type { MutableSimState } from './simHelpers';

const DIRECTIONS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const STATIONARY_ACTIONS = new Set(['rest', 'eatFromInventory', 'foundSettlement']);

// Keeps logic on the hidden grid; renderer handles smooth interpolation.
export function runMovementSystem(state: MutableSimState, config: SimConfig) {
  for (const agent of state.agents) {
    if (!agent.alive) {
      continue;
    }

    const prevX = agent.x;
    const prevY = agent.y;

    if (agent.currentAction === 'rest' || agent.currentAction === 'eatFromInventory' || agent.currentAction === 'foundSettlement') {
      agent.gridStagnationTicks = 0;
      continue;
    }

    const target =
      agent.currentAction === 'findFood'
        ? nearestResourceStep(state, agent.x, agent.y, 'food')
        : agent.currentAction === 'gatherWood'
          ? nearestResourceStep(state, agent.x, agent.y, 'wood')
          : agent.currentAction === 'migrate' && agent.migrationTarget != null
            ? stepToward(state, agent.x, agent.y, agent.migrationTarget.x, agent.migrationTarget.y)
          : (agent.currentAction === 'returnHome' || agent.currentAction === 'depositResources') &&
              agent.settlementId != null
            ? stepToSettlement(state.settlements, state, agent.x, agent.y, agent.settlementId)
            : agent.currentAction === 'joinSettlement'
              ? stepToNearestSettlement(state.settlements, state, agent.x, agent.y)
              : exploreStep(state, agent.id, state.tick, agent.x, agent.y);

    if (!target) {
      if (!STATIONARY_ACTIONS.has(agent.currentAction)) {
        agent.gridStagnationTicks += 1;
      }
      continue;
    }

    agent.x = target.x;
    agent.y = target.y;
    agent.energy = Math.max(0, agent.energy - config.movementCost);

    const settledNearHome =
      (agent.currentAction === 'depositResources' || agent.currentAction === 'returnHome') &&
      agent.settlementId != null &&
      (() => {
        const home = state.settlements.find((s) => s.id === agent.settlementId && s.status !== 'abandoned');
        return home ? manhattanDistance(agent.x, agent.y, home.x, home.y) <= 1 : false;
      })();

    if (settledNearHome) {
      agent.gridStagnationTicks = 0;
    } else if (agent.x === prevX && agent.y === prevY) {
      agent.gridStagnationTicks += 1;
    } else {
      agent.gridStagnationTicks = 0;
    }
  }
}

function nearestResourceStep(state: MutableSimState, x: number, y: number, resource: 'food' | 'wood') {
  let bestCell: { x: number; y: number; score: number } | null = null;

  for (let dy = -5; dy <= 5; dy += 1) {
    for (let dx = -5; dx <= 5; dx += 1) {
      const cell = getCell(state.world, x + dx, y + dy);
      if (!isWalkable(cell) || !cell) {
        continue;
      }

      const value = resource === 'food' ? cell.food : cell.wood;
      if (value <= 0.5) {
        continue;
      }

      const dist = Math.abs(dx) + Math.abs(dy);
      const score = value * 3 - dist;
      if (!bestCell || score > bestCell.score) {
        bestCell = { x: cell.x, y: cell.y, score };
      }
    }
  }

  if (!bestCell) {
    return exploreStep(state, 0, state.tick, x, y);
  }

  return stepToward(state, x, y, bestCell.x, bestCell.y);
}

function stepToSettlement(settlements: Settlement[], state: MutableSimState, x: number, y: number, settlementId: number) {
  const settlement = settlements.find((item) => item.id === settlementId && item.status !== 'abandoned');
  if (!settlement) {
    return null;
  }

  if (manhattanDistance(x, y, settlement.x, settlement.y) <= 1) {
    return { x, y };
  }

  return stepToward(state, x, y, settlement.x, settlement.y);
}

function stepToNearestSettlement(settlements: Settlement[], state: MutableSimState, x: number, y: number) {
  let nearest: Settlement | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const settlement of settlements) {
    if (settlement.status === 'abandoned') {
      continue;
    }

    const distance = manhattanDistance(x, y, settlement.x, settlement.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = settlement;
    }
  }

  if (!nearest) {
    return null;
  }

  return stepToward(state, x, y, nearest.x, nearest.y);
}

function exploreStep(state: MutableSimState, agentId: number, tick: number, x: number, y: number) {
  const shuffled = [...DIRECTIONS].sort((a, b) => {
    const aScore = deterministicInt(agentId * 811 + tick * 37 + a.x * 13 + a.y * 17, 0, 1000);
    const bScore = deterministicInt(agentId * 811 + tick * 37 + b.x * 13 + b.y * 17, 0, 1000);
    return bScore - aScore;
  });

  for (const dir of shuffled) {
    const candidate = getCell(state.world, x + dir.x, y + dir.y);
    if (isWalkable(candidate) && candidate) {
      return { x: candidate.x, y: candidate.y };
    }
  }

  return null;
}

function stepToward(state: MutableSimState, x: number, y: number, targetX: number, targetY: number) {
  const dx = Math.sign(targetX - x);
  const dy = Math.sign(targetY - y);

  const horizontal = getCell(state.world, x + dx, y);
  if (dx !== 0 && isWalkable(horizontal) && horizontal) {
    return { x: horizontal.x, y: horizontal.y };
  }

  const vertical = getCell(state.world, x, y + dy);
  if (dy !== 0 && isWalkable(vertical) && vertical) {
    return { x: vertical.x, y: vertical.y };
  }

  return null;
}

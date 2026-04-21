import { MIN_INTOLERANCE_TO_LEAVE_SETTLEMENT } from '../data/constants';
import type { SimEvent } from '../types/simTypes';
import { deterministicInt, getCell, manhattanDistance } from './simHelpers';
import type { MutableSimState } from './simHelpers';

// Handles migration intent and milestone events.
// Conditions are tuned to produce occasional relocations under sustained scarcity.
export function runMigrationPlanningSystem(state: MutableSimState): SimEvent[] {
  const events: SimEvent[] = [];

  for (const agent of state.agents) {
    if (!agent.alive) {
      continue;
    }

    const localCell = getCell(state.world, agent.x, agent.y);
    const pressure = (localCell?.food ?? 0) < 0.52 && agent.hunger > 72;

    if ((!pressure && agent.currentAction !== 'migrate') || agent.migrationCooldown > 0) {
      if (agent.migrationTarget && agent.hunger < 48) {
        agent.migrationTarget = null;
      }
      continue;
    }

    if (
      agent.settlementId != null &&
      agent.settlementIntolerance < MIN_INTOLERANCE_TO_LEAVE_SETTLEMENT &&
      !agent.migrationTarget
    ) {
      continue;
    }

    if (!agent.migrationTarget) {
      const target = chooseMigrationTarget(state, agent.x, agent.y);
      if (!target) {
        continue;
      }

      agent.migrationTarget = target;
      agent.currentAction = 'migrate';
      agent.committedAction = 'migrate';
      agent.actionCommitTicks = Math.max(
        agent.actionCommitTicks,
        deterministicInt(state.seed + agent.id * 131 + state.tick, 36, 72),
      );
      agent.currentGoal = 'migrate toward richer terrain';
      events.push({
        id: 0,
        day: state.day,
        type: 'migration_started',
        summary: `${agent.name} began migrating toward richer terrain.`,
        importance: 2,
        agentIds: [agent.id],
        x: agent.x,
        y: agent.y,
      });
      agent.migrationCooldown = 90;
    }
  }

  return events;
}

export function runMigrationResolutionSystem(state: MutableSimState): SimEvent[] {
  const events: SimEvent[] = [];

  for (const agent of state.agents) {
    if (!agent.alive || !agent.migrationTarget) {
      continue;
    }

    if (manhattanDistance(agent.x, agent.y, agent.migrationTarget.x, agent.migrationTarget.y) <= 1) {
      events.push({
        id: 0,
        day: state.day,
        type: 'migration_completed',
        summary: `${agent.name} completed migration and reached a new area.`,
        importance: 2,
        agentIds: [agent.id],
        x: agent.x,
        y: agent.y,
      });
      agent.migrationTarget = null;
      agent.migrationCooldown = 120;
    }
  }

  return events;
}

function chooseMigrationTarget(state: MutableSimState, x: number, y: number) {
  let best: { x: number; y: number; score: number } | null = null;

  for (let dy = -12; dy <= 12; dy += 1) {
    for (let dx = -12; dx <= 12; dx += 1) {
      const cell = getCell(state.world, x + dx, y + dy);
      if (!cell || cell.terrain === 'water') {
        continue;
      }

      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist < 4 || dist > 16) {
        continue;
      }

      const fertility = cell.food * 1.6 + cell.wood * 0.9 + cell.stone * 0.3;
      const score = fertility - dist * 0.12;
      if (!best || score > best.score) {
        best = { x: cell.x, y: cell.y, score };
      }
    }
  }

  return best ? { x: best.x, y: best.y } : null;
}

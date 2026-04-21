import type { SimConfig, SimEvent } from '../types/simTypes';
import { clamp, getCell, manhattanDistance } from './simHelpers';
import type { MutableSimState } from './simHelpers';

// Applies effects of selected actions (eat/rest/gather/deposit).
export function runGatherSystem(state: MutableSimState, config: SimConfig): SimEvent[] {
  const events: SimEvent[] = [];

  for (const agent of state.agents) {
    if (!agent.alive) {
      continue;
    }

    if (agent.currentAction === 'eatFromInventory' && agent.inventory.food > 0) {
      agent.inventory.food = Math.max(0, agent.inventory.food - 1);
      agent.hunger = clamp(agent.hunger - 32, 0, 100);
      agent.energy = clamp(agent.energy + 3, 0, 100);
      continue;
    }

    if (agent.currentAction === 'rest') {
      agent.energy = clamp(agent.energy + 1.6, 0, 100);
      agent.hunger = clamp(agent.hunger + config.hungerRate * 0.2, 0, 100);
      continue;
    }

    if (agent.currentAction === 'findFood') {
      const cell = getCell(state.world, agent.x, agent.y);
      if (!cell || cell.food <= 0.25) {
        continue;
      }

      const gathered = Math.min(cell.food, 1.25);
      cell.food = Math.max(0, cell.food - gathered);
      agent.inventory.food += gathered;

      if (gathered >= 1) {
        events.push({
          id: 0,
          day: state.day,
          type: 'food_gathered',
          summary: `${agent.name} gathered food near (${agent.x}, ${agent.y}).`,
          importance: 1,
          agentIds: [agent.id],
          x: agent.x,
          y: agent.y,
        });
      }
      continue;
    }

    if (agent.currentAction === 'gatherWood') {
      const cell = getCell(state.world, agent.x, agent.y);
      if (!cell || cell.wood <= 0.2) {
        continue;
      }

      const gathered = Math.min(cell.wood, 1);
      cell.wood = Math.max(0, cell.wood - gathered);
      agent.inventory.wood += gathered;

      if (gathered >= 0.75) {
        events.push({
          id: 0,
          day: state.day,
          type: 'wood_gathered',
          summary: `${agent.name} collected wood in nearby forest.`,
          importance: 1,
          agentIds: [agent.id],
          x: agent.x,
          y: agent.y,
        });
      }
      continue;
    }

    if (agent.currentAction === 'depositResources' && agent.settlementId != null) {
      const settlement = state.settlements.find((item) => item.id === agent.settlementId && item.status !== 'abandoned');
      if (!settlement) {
        continue;
      }

      if (manhattanDistance(agent.x, agent.y, settlement.x, settlement.y) > 1) {
        continue;
      }

      const movedFood = agent.inventory.food;
      const movedWood = agent.inventory.wood;
      const movedStone = agent.inventory.stone;
      const movedTotal = movedFood + movedWood + movedStone;
      if (movedTotal <= 0) {
        continue;
      }

      settlement.foodStored += movedFood;
      settlement.woodStored += movedWood;
      settlement.stoneStored += movedStone;

      agent.inventory.food = 0;
      agent.inventory.wood = 0;
      agent.inventory.stone = 0;

      events.push({
        id: 0,
        day: state.day,
        type: 'resources_deposited',
        summary: `${agent.name} deposited supplies at ${settlement.name}.`,
        importance: 2,
        agentIds: [agent.id],
        settlementIds: [settlement.id],
        x: settlement.x,
        y: settlement.y,
      });
    }
  }

  return events;
}

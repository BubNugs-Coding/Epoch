import type { SimConfig } from '../types/simTypes';
import { clamp } from './simHelpers';

import type { MutableSimState } from './simHelpers';

export function runNeedsSystem(state: MutableSimState, config: SimConfig) {
  for (const agent of state.agents) {
    if (!agent.alive) {
      continue;
    }

    agent.hunger = clamp(agent.hunger + config.hungerRate, 0, 100);
    agent.energy = clamp(agent.energy - config.energyRate, 0, 100);

    if (agent.hunger >= 95) {
      agent.health = clamp(agent.health - config.starvationDamage, 0, 100);
    }

    if (agent.energy <= 5) {
      agent.health = clamp(agent.health - config.exhaustionDamage, 0, 100);
    }
  }
}

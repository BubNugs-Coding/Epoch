import type { Agent } from '../types/simTypes';
import { clamp } from './simHelpers';
import type { MutableSimState } from './simHelpers';

/**
 * Members accumulate frustration with poor conditions; it must rise before they may migrate away.
 * Loyal agents build frustration more slowly.
 */
export function runSettlementMemberIntolerance(state: MutableSimState) {
  for (const agent of state.agents) {
    if (!agent.alive) {
      continue;
    }

    if (agent.settlementId == null) {
      agent.settlementIntolerance = 0;
      continue;
    }

    const home = state.settlements.find((s) => s.id === agent.settlementId && s.status !== 'abandoned');
    if (!home) {
      agent.settlementIntolerance = Math.min(100, agent.settlementIntolerance + 0.4);
      continue;
    }

    const reserves = home.foodStored + home.woodStored + home.stoneStored;
    const stressMul = agent.traits.includes('loyal') ? 0.68 : 1;

    let delta = -0.08;

    if (home.status === 'starving') {
      delta += 0.36 * stressMul;
    } else if (reserves < 10) {
      delta += 0.14 * stressMul;
    }

    if (reserves < 5) {
      delta += 0.2 * stressMul;
    }

    if (agent.hunger > 88) {
      delta += 0.32 * stressMul;
    } else if (agent.hunger > 78) {
      delta += 0.18 * stressMul;
    }

    agent.settlementIntolerance = clamp(agent.settlementIntolerance + delta, 0, 100);
  }
}

export function resetSettlementIntolerance(agent: Agent) {
  agent.settlementIntolerance = 0;
}

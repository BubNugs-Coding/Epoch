import { DEFAULT_CONFIG, EMPTY_WORLD_STATS } from '../data/constants';
import { createAgents } from '../entities/agentFactory';
import type { SimConfig, SimulationState } from '../types/simTypes';
import { generateWorld } from '../world/worldGen';
import { createRng } from '../../utils/rng';
import { simModuleManager } from '../modules';

export function initializeSimulation(seed: number, config: SimConfig = DEFAULT_CONFIG): SimulationState {
  const world = generateWorld({
    width: config.worldWidth,
    height: config.worldHeight,
    seed,
  });

  const rng = createRng(seed + 9973);
  const agents = createAgents(config.startAgentCount, world, rng);

  const initialState: SimulationState = {
    seed,
    tick: 0,
    day: 0,
    phase: 'running',
    endReason: null,
    config,
    world,
    agents,
    settlements: [],
    events: [],
    stats: {
      ...EMPTY_WORLD_STATS,
      peakPopulation: agents.length,
      currentPopulation: agents.length,
      populationHistory: [agents.length],
      settlementHistory: [0],
      deathHistory: [0],
    },
    moduleConfig: simModuleManager.createConfigState(),
    moduleEndReason: null,
    worldCues: [],
    selectedAgentId: null,
    selectedSettlementId: null,
  };

  simModuleManager.runOnInit(initialState);
  return initialState;
}

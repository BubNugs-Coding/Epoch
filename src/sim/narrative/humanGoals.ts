import type { Agent } from '../types/simTypes';
import { deterministicInt, type MutableSimState } from '../systems/simHelpers';

const FIND_FOOD = [
  'Looking for something to eat',
  'Searching the ground for food',
  'Trying to find a meal nearby',
  'Scouting for anything edible',
  'Following the smell of food',
];

const GATHER_WOOD = [
  'Gathering wood for tools and shelter',
  'Collecting fallen branches',
  'Looking for usable timber',
  'Stocking up on wood',
];

const EAT_PACK = [
  'Eating from their pack',
  'Having a meal from their supplies',
  'Finishing stored food',
];

const REST_NIGHT = [
  'Turning in for the night',
  'Resting until morning',
  'Sleeping through the dark hours',
  'Settling down to sleep',
];

const REST_DAY = [
  'Stopping to catch their breath',
  'Resting—they can barely go on',
  'Taking a desperate break',
];

const JOIN = [
  'Heading toward a settlement',
  'Looking for people to join',
  'Trying to reach shelter with others',
];

const HOME_CARRY = [
  'Carrying supplies back home',
  'Heading home with what they gathered',
  'Returning to their settlement loaded up',
];

const HOME_VISIT = [
  'Checking in back home',
  'Walking home to see their people',
  'Heading back to their settlement',
];

const DEPOSIT = [
  'Putting supplies into the common stores',
  'Adding what they gathered to the pile',
  'Unloading at the settlement',
];

const FOUND = [
  'Scouting a place to put down roots',
  'Looking for land to build on',
  'Trying to start a new home here',
];

const MIGRATE = [
  'Leaving for better ground',
  'Moving toward richer land',
  'Walking away from scarcity',
];

const EXPLORE = [
  'Wandering to see what is nearby',
  'Exploring the area',
  'Seeing what lies over the next rise',
  'Taking a slow look around',
];

/**
 * Short, natural language for the inspector — varies by agent and time so it feels less robotic.
 */
export function pickHumanGoal(agent: Agent, action: string, state: MutableSimState, isNight: boolean): string {
  const slot = deterministicInt(state.seed + agent.id * 1601 + state.day * 17, 0, 9999);

  switch (action) {
    case 'findFood':
      return FIND_FOOD[slot % FIND_FOOD.length];
    case 'gatherWood':
      return GATHER_WOOD[slot % GATHER_WOOD.length];
    case 'eatFromInventory':
      return EAT_PACK[slot % EAT_PACK.length];
    case 'rest':
      return isNight ? REST_NIGHT[slot % REST_NIGHT.length] : REST_DAY[slot % REST_DAY.length];
    case 'joinSettlement':
      return JOIN[slot % JOIN.length];
    case 'returnHome': {
      const c = agent.inventory.food + agent.inventory.wood + agent.inventory.stone;
      return c >= 1 ? HOME_CARRY[slot % HOME_CARRY.length] : HOME_VISIT[slot % HOME_VISIT.length];
    }
    case 'depositResources':
      return DEPOSIT[slot % DEPOSIT.length];
    case 'foundSettlement':
      return FOUND[deterministicInt(state.seed + agent.id * 89 + state.day, 0, 999) % FOUND.length];
    case 'migrate':
      return MIGRATE[slot % MIGRATE.length];
    case 'explore':
    default:
      return EXPLORE[slot % EXPLORE.length];
  }
}

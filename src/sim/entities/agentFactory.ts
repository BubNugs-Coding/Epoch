import { FIRST_NAMES, LAST_NAMES } from '../data/names';
import { ALL_TRAITS } from '../data/traits';
import type { Agent, AgentAvatar, AgentTrait, World } from '../types/simTypes';
import type { Rng } from '../../utils/rng';

const BODY_COLORS = ['#6fa8dc', '#e69138', '#93c47d', '#8e7cc3', '#c27ba0', '#76a5af'];
const SKIN_TONES: AgentAvatar['skinTone'][] = ['light', 'tan', 'brown', 'dark'];
const HAIR_SHAPES: AgentAvatar['hairShape'][] = ['short', 'long', 'bun', 'mohawk', 'bald'];
const ACCESSORIES: AgentAvatar['accessory'][] = ['band', 'cape', 'pack', 'stripe', 'none'];

export function createAgents(count: number, world: World, rng: Rng): Agent[] {
  const validCells = world.cells.filter((cell) => cell.terrain !== 'water');
  const usedNames = new Set<string>();

  return Array.from({ length: count }, (_, index) => {
    const spawnCell = rng.pick(validCells);
    const name = uniqueName(rng, usedNames);

    return {
      id: index + 1,
      name,
      x: spawnCell.x,
      y: spawnCell.y,
      renderX: spawnCell.x,
      renderY: spawnCell.y,
      health: 100,
      hunger: 0,
      energy: 100,
      alive: true,
      ageDays: 0,
      inventory: {
        food: rng.int(0, 3),
        wood: 0,
        stone: 0,
      },
      traits: pickTraits(rng),
      settlementId: null,
      currentGoal: 'survive',
      currentAction: 'explore',
      migrationTarget: null,
      migrationCooldown: 0,
      combatCooldown: 0,
      committedAction: 'explore',
      actionCommitTicks: 0,
      ticksSinceSettlementVisit: 0,
      gridStagnationTicks: 0,
      settlementIntolerance: 0,
      splinterFoundingCharge: 0,
      avatar: {
        bodyColor: rng.pick(BODY_COLORS),
        hairShape: rng.pick(HAIR_SHAPES),
        skinTone: rng.pick(SKIN_TONES),
        accessory: rng.pick(ACCESSORIES),
      },
    };
  });
}

function pickTraits(rng: Rng): AgentTrait[] {
  const traitCount = rng.int(2, 3);
  const traits = new Set<AgentTrait>();

  while (traits.size < traitCount) {
    traits.add(rng.pick(ALL_TRAITS));
  }

  return Array.from(traits);
}

function uniqueName(rng: Rng, usedNames: Set<string>): string {
  for (let attempts = 0; attempts < 1000; attempts += 1) {
    const fullName = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
    if (!usedNames.has(fullName)) {
      usedNames.add(fullName);
      return fullName;
    }
  }

  const fallback = `Agent-${usedNames.size + 1}`;
  usedNames.add(fallback);
  return fallback;
}

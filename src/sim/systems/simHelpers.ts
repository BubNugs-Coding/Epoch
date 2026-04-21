import type { Agent, Cell, Settlement, SimulationState, World } from '../types/simTypes';

export type MutableSimState = {
  tick: number;
  day: number;
  seed: number;
  world: World;
  agents: Agent[];
  settlements: Settlement[];
  moduleConfig: SimulationState['moduleConfig'];
  events: SimulationState['events'];
  pendingModuleEvents: SimulationState['events'];
  moduleEndReason: string | null;
};

export function cloneWorld(world: World): World {
  return {
    width: world.width,
    height: world.height,
    cells: world.cells.map((cell) => ({ ...cell })),
  };
}

export function cloneAgents(agents: Agent[]): Agent[] {
  return agents.map((agent) => ({
    ...agent,
    inventory: { ...agent.inventory },
    traits: [...agent.traits],
    avatar: { ...agent.avatar },
  }));
}

export function cloneSettlements(settlements: Settlement[]): Settlement[] {
  return settlements.map((settlement) => ({ ...settlement }));
}

export function cellIndex(world: World, x: number, y: number) {
  return y * world.width + x;
}

export function getCell(world: World, x: number, y: number): Cell | null {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) {
    return null;
  }

  return world.cells[cellIndex(world, x, y)];
}

export function isWalkable(cell: Cell | null) {
  return cell !== null && cell.terrain !== 'water';
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function deterministicUnit(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function deterministicInt(seed: number, min: number, max: number) {
  const u = deterministicUnit(seed);
  const span = max - min + 1;
  return min + Math.floor(u * span);
}

export function manhattanDistance(ax: number, ay: number, bx: number, by: number) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

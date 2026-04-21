import type { Settlement } from '../types/simTypes';
import { manhattanDistance } from '../systems/simHelpers';

/** Manhattan distance from settlement center this town's influence covers (for map tinting). */
export function influenceManhattanRadius(settlement: Settlement): number {
  if (settlement.status === 'abandoned') {
    return 0;
  }
  return 2 + Math.min(10, Math.floor(Math.sqrt(Math.max(1, settlement.population)) * 2.1));
}

export function settlementControllingCell(
  cellX: number,
  cellY: number,
  settlements: Settlement[],
): Settlement | null {
  let best: { s: Settlement; d: number } | null = null;

  for (const s of settlements) {
    if (s.status === 'abandoned') {
      continue;
    }
    const r = influenceManhattanRadius(s);
    const d = manhattanDistance(cellX, cellY, s.x, s.y);
    if (d > r) {
      continue;
    }
    if (!best || d < best.d) {
      best = { s, d };
    }
  }

  return best?.s ?? null;
}

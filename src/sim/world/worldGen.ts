import { createRng, type Rng } from '../../utils/rng';
import type { Cell, TerrainType, World } from '../types/simTypes';

type WorldGenConfig = {
  width: number;
  height: number;
  seed: number;
};

const BASE_RESOURCES: Record<TerrainType, { food: number; wood: number; stone: number }> = {
  grass: { food: 1.4, wood: 0.2, stone: 0.1 },
  forest: { food: 1.1, wood: 1.8, stone: 0.2 },
  water: { food: 0.2, wood: 0, stone: 0 },
  hill: { food: 0.3, wood: 0.4, stone: 1.8 },
  barren: { food: 0.1, wood: 0.1, stone: 0.5 },
};

const REF_AREA = 80 * 50;

export function generateWorld({ width, height, seed }: WorldGenConfig): World {
  const rng = createRng(seed);
  const cells: Cell[] = [];
  const areaScale = Math.max(1, Math.sqrt((width * height) / REF_AREA));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      cells.push({
        x,
        y,
        terrain: 'grass',
        food: 0,
        wood: 0,
        stone: 0,
        settlementId: null,
      });
    }
  }

  const sc = (min: number, max: number) => rng.int(Math.round(min * areaScale), Math.round(max * areaScale));

  paintClusters(cells, width, height, rng, 'forest', sc(8, 14), 5, 10);
  paintClusters(cells, width, height, rng, 'hill', sc(5, 9), 4, 8);
  paintClusters(cells, width, height, rng, 'water', Math.max(2, sc(2, 4)), 7, 16);
  paintClusters(cells, width, height, rng, 'barren', sc(4, 8), 3, 7);

  for (const cell of cells) {
    const base = BASE_RESOURCES[cell.terrain];
    cell.food = Math.max(0, base.food + jitter(rng, 0.8));
    cell.wood = Math.max(0, base.wood + jitter(rng, 0.8));
    cell.stone = Math.max(0, base.stone + jitter(rng, 0.8));
  }

  scatterFertileZones(cells, width, height, rng, areaScale);

  return { width, height, cells };
}

function paintClusters(
  cells: Cell[],
  width: number,
  height: number,
  rng: Rng,
  terrain: TerrainType,
  clusterCount: number,
  minRadius: number,
  maxRadius: number,
) {
  for (let i = 0; i < clusterCount; i += 1) {
    const centerX = rng.int(0, width - 1);
    const centerY = rng.int(0, height - 1);
    const radius = rng.int(minRadius, maxRadius);

    for (let y = Math.max(0, centerY - radius); y <= Math.min(height - 1, centerY + radius); y += 1) {
      for (let x = Math.max(0, centerX - radius); x <= Math.min(width - 1, centerX + radius); x += 1) {
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const noise = rng.next() * 1.8;

        if (dist + noise < radius) {
          getCell(cells, width, x, y).terrain = terrain;
        }
      }
    }
  }
}

function scatterFertileZones(cells: Cell[], width: number, height: number, rng: Rng, areaScale: number) {
  const fertileCount = rng.int(Math.round(7 * areaScale), Math.round(12 * areaScale));

  for (let i = 0; i < fertileCount; i += 1) {
    const centerX = rng.int(0, width - 1);
    const centerY = rng.int(0, height - 1);
    const radius = rng.int(3, 6);

    for (let y = Math.max(0, centerY - radius); y <= Math.min(height - 1, centerY + radius); y += 1) {
      for (let x = Math.max(0, centerX - radius); x <= Math.min(width - 1, centerX + radius); x += 1) {
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= radius) {
          const cell = getCell(cells, width, x, y);
          if (cell.terrain !== 'water' && cell.terrain !== 'barren') {
            const boost = (radius - dist + 1) * 0.18;
            cell.food += boost;
          }
        }
      }
    }
  }
}

function jitter(rng: Rng, amplitude: number) {
  return (rng.next() - 0.5) * amplitude;
}

function getCell(cells: Cell[], width: number, x: number, y: number) {
  return cells[y * width + x];
}

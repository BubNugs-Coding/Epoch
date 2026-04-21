import type { Agent, Settlement, TerrainType, World, WorldCue } from '../../sim/types/simTypes';
import { settlementControllingCell } from '../../sim/settlement/territory';
import { activityTagForAction, drawActivityTag } from './activityTags';

const facingMemory = new Map<number, number>();
const trailHeat = new Map<number, number>();
let cachedTerritoryTick = -1;
let cachedTerritoryWidth = 0;
let cachedTerritoryHeight = 0;
let cachedTerritoryOwnerIds: Int32Array | null = null;

const TERRAIN_COLORS: Record<TerrainType, string> = {
  grass: '#7ca36b',
  forest: '#4f7f52',
  water: '#4c7ca8',
  hill: '#8c836e',
  barren: '#9a967f',
};

const RESOURCE_COLORS = {
  food: 'rgba(199, 231, 139, 0.55)',
  wood: 'rgba(99, 71, 48, 0.48)',
  stone: 'rgba(176, 176, 176, 0.4)',
};

/** Canvas pan (screen px) + zoom; world is drawn in logical coords [0, canvasWidth] × [0, canvasHeight]. */
export type ViewTransform = {
  offsetX: number;
  offsetY: number;
  zoom: number;
};

export type RenderProfile = {
  totalMs: number;
  terrainMs: number;
  trailsMs: number;
  territoryMs: number;
  settlementsMs: number;
  agentsMs: number;
  cuesMs: number;
  labelsMs: number;
  activeSettlements: number;
  aliveAgents: number;
  trailCells: number;
};

export function screenToWorld(
  screenX: number,
  screenY: number,
  view: ViewTransform,
): { wx: number; wy: number } {
  return {
    wx: (screenX - view.offsetX) / view.zoom,
    wy: (screenY - view.offsetY) / view.zoom,
  };
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  agents: Agent[],
  settlements: Settlement[],
  simTick: number,
  selected: { agentId: number | null; settlementId: number | null },
  hovered: { agentId: number | null; settlementId: number | null },
  canvasWidth: number,
  canvasHeight: number,
  view: ViewTransform,
  worldCues: WorldCue[],
): RenderProfile {
  const frameStart = performance.now();
  const cellWidth = canvasWidth / world.width;
  const cellHeight = canvasHeight / world.height;
  let terrainMs = 0;
  let trailsMs = 0;
  let territoryMs = 0;
  let settlementsMs = 0;
  let agentsMs = 0;
  let cuesMs = 0;
  let labelsMs = 0;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  ctx.save();
  ctx.translate(view.offsetX, view.offsetY);
  ctx.scale(view.zoom, view.zoom);

  const settlementById = new Map(settlements.map((settlement) => [settlement.id, settlement]));
  const activeSettlements = settlements.filter((s) => s.status !== 'abandoned');

  const terrainStart = performance.now();
  for (const cell of world.cells) {
    const x = cell.x * cellWidth;
    const y = cell.y * cellHeight;

    ctx.fillStyle = TERRAIN_COLORS[cell.terrain];
    ctx.fillRect(x, y, cellWidth + 0.5, cellHeight + 0.5);

    const centerX = x + cellWidth / 2;
    const centerY = y + cellHeight / 2;
    const markerRadius = Math.min(cellWidth, cellHeight) * 0.12;

    if (cell.food > 1.4) {
      ctx.fillStyle = RESOURCE_COLORS.food;
      drawCircle(ctx, centerX - markerRadius * 0.9, centerY, markerRadius);
    }
    if (cell.wood > 1.2) {
      ctx.fillStyle = RESOURCE_COLORS.wood;
      drawCircle(ctx, centerX, centerY, markerRadius);
    }
    if (cell.stone > 1.25) {
      ctx.fillStyle = RESOURCE_COLORS.stone;
      drawCircle(ctx, centerX + markerRadius * 0.9, centerY, markerRadius);
    }
  }
  terrainMs = performance.now() - terrainStart;

  const trailsStart = performance.now();
  const lastTrailTick = (renderWorld as typeof renderWorld & { _lastTrailTick?: number })._lastTrailTick;
  if (lastTrailTick !== simTick) {
    (renderWorld as typeof renderWorld & { _lastTrailTick?: number })._lastTrailTick = simTick;
    decayTrails(world.width, world.height);
    for (const agent of agents) {
      if (!agent.alive) {
        continue;
      }
      const tx = Math.max(0, Math.min(world.width - 1, Math.round(agent.x)));
      const ty = Math.max(0, Math.min(world.height - 1, Math.round(agent.y)));
      const key = ty * world.width + tx;
      trailHeat.set(key, Math.min(1, (trailHeat.get(key) ?? 0) + 0.06));
    }
  }
  if (view.zoom >= 0.33) {
    drawTrails(ctx, trailHeat, world.width, world.height, cellWidth, cellHeight, view.zoom);
  }
  trailsMs = performance.now() - trailsStart;

  const territoryStart = performance.now();
  const territoryOwners = getTerritoryOwnerIds(world, activeSettlements, simTick);
  for (let idx = 0; idx < world.cells.length; idx += 1) {
    const ownerId = territoryOwners[idx];
    if (ownerId <= 0) {
      continue;
    }
    const cell = world.cells[idx];
    const owner = settlementById.get(ownerId);
    if (!owner) {
      continue;
    }
    const tx = cell.x * cellWidth;
    const ty = cell.y * cellHeight;
    ctx.fillStyle = hexToRgba(owner.color, cell.terrain === 'water' ? 0.06 : 0.1);
    ctx.fillRect(tx, ty, cellWidth + 0.5, cellHeight + 0.5);
  }
  territoryMs = performance.now() - territoryStart;

  // Light cell grid so the discrete simulation space stays readable while agents move smoothly.
  if (view.zoom >= 0.28) {
    const lineAlpha = Math.min(0.14, 0.05 + view.zoom * 0.06);
    ctx.strokeStyle = `rgba(15, 23, 37, ${lineAlpha})`;
    ctx.lineWidth = 1 / view.zoom;
    ctx.beginPath();
    for (let gx = 0; gx <= world.width; gx += 1) {
      const lx = gx * cellWidth;
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, canvasHeight);
    }
    for (let gy = 0; gy <= world.height; gy += 1) {
      const ly = gy * cellHeight;
      ctx.moveTo(0, ly);
      ctx.lineTo(canvasWidth, ly);
    }
    ctx.stroke();
  }

  const settlementsStart = performance.now();
  for (const settlement of settlements) {
    if (settlement.status === 'abandoned') {
      continue;
    }

    const px = (settlement.x + 0.5) * cellWidth;
    const py = (settlement.y + 0.5) * cellHeight;
    const radius = Math.max(5, Math.min(cellWidth, cellHeight) * 0.36);

    ctx.fillStyle = settlement.color;
    drawCircle(ctx, px, py, radius);

    ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.stroke();

    drawSettlementStructures(ctx, px, py, settlement.population, settlement.color, cellWidth, cellHeight);

    if (selected.settlementId === settlement.id || hovered.settlementId === settlement.id) {
      ctx.strokeStyle = '#f6f0b0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  settlementsMs = performance.now() - settlementsStart;

  const agentsStart = performance.now();
  const showAgentGlyphs = view.zoom >= 0.42;
  const glyphScale = Math.max(0.65, Math.min(1.35, view.zoom));
  const aliveAgents = agents.filter((a) => a.alive);
  const lastSurvivorId = aliveAgents.length === 1 ? aliveAgents[0].id : null;
  const leaderIds = new Set<number>();
  const founderIds = new Set<number>();
  for (const s of settlements) {
    if (s.status === 'abandoned') {
      continue;
    }
    leaderIds.add(s.leaderId);
    founderIds.add(s.founderId);
  }

  for (const agent of agents) {
    if (!agent.alive) {
      continue;
    }

    const px = (agent.renderX + 0.5) * cellWidth;
    const py = (agent.renderY + 0.5) * cellHeight;
    const radius = Math.max(2.6, Math.min(cellWidth, cellHeight) * 0.26);

    const settlement = agent.settlementId != null ? settlementById.get(agent.settlementId) ?? null : null;
    const groupColor = settlement?.color ?? agent.avatar.bodyColor;

    const dx = agent.x - agent.renderX;
    const dy = agent.y - agent.renderY;
    const moving = Math.hypot(dx, dy) > 0.05;
    const targetFacing = moving ? Math.atan2(dy, dx) : ((agent.id * 97) % 628) / 100;
    const currentFacing = facingMemory.get(agent.id) ?? targetFacing;
    const nextFacing = lerpAngle(currentFacing, targetFacing, moving ? 0.35 : 0.06);
    facingMemory.set(agent.id, nextFacing);

    const bob = moving ? Math.sin((simTick + agent.id * 9) * 0.18) * radius * 0.22 : 0;
    drawAgentAvatar(ctx, {
      x: px,
      y: py + bob,
      radius,
      facing: nextFacing,
      baseColor: groupColor,
      skinTone: agent.avatar.skinTone,
      accessory: agent.avatar.accessory,
      sashColor: settlement?.color ?? '#e2e8f0',
      selected: selected.agentId === agent.id || hovered.agentId === agent.id,
    });

    if (selected.agentId === agent.id || hovered.agentId === agent.id) {
      ctx.strokeStyle = '#fff2b4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, radius + 2.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    const important =
      selected.agentId === agent.id ||
      hovered.agentId === agent.id ||
      leaderIds.has(agent.id) ||
      founderIds.has(agent.id) ||
      lastSurvivorId === agent.id;

    if (showAgentGlyphs && (important || view.zoom >= 1.1)) {
      const tag = activityTagForAction(agent.currentAction);
      if (tag) {
        drawActivityTag(ctx, tag, px, py - radius - 10 * glyphScale, glyphScale);
      }
    }

    if (view.zoom >= 0.75 && important) {
      const role =
        leaderIds.has(agent.id)
          ? 'Leader'
          : founderIds.has(agent.id)
            ? 'Founder'
            : lastSurvivorId === agent.id
              ? 'Last survivor'
              : null;
      drawLabel(ctx, role ? `${agent.name} · ${role}` : agent.name, px, py - radius - 13);
    }
  }
  agentsMs = performance.now() - agentsStart;

  const cuesStart = performance.now();
  drawWorldCues(ctx, worldCues, cellWidth, cellHeight, view.zoom);
  cuesMs = performance.now() - cuesStart;

  const labelsStart = performance.now();
  const focusSettlement =
    settlements.find((s) => s.id === selected.settlementId) ??
    settlements.find((s) => s.id === hovered.settlementId) ??
    null;
  if (focusSettlement) {
    const px = (focusSettlement.x + 0.5) * cellWidth;
    const py = (focusSettlement.y + 0.5) * cellHeight;
    drawLabel(ctx, focusSettlement.name, px, py - 14);
  }
  labelsMs = performance.now() - labelsStart;

  ctx.restore();
  return {
    totalMs: performance.now() - frameStart,
    terrainMs,
    trailsMs,
    territoryMs,
    settlementsMs,
    agentsMs,
    cuesMs,
    labelsMs,
    activeSettlements: activeSettlements.length,
    aliveAgents: aliveAgents.length,
    trailCells: trailHeat.size,
  };
}

function drawWorldCues(
  ctx: CanvasRenderingContext2D,
  cues: WorldCue[],
  cellWidth: number,
  cellHeight: number,
  zoom: number,
) {
  const maxTtl: Record<WorldCue['kind'], number> = {
    fight: 40,
    major_fight: 56,
    gather_food: 22,
    gather_wood: 22,
  };

  for (const cue of cues) {
    const px = (cue.x + 0.5) * cellWidth;
    const py = (cue.y + 0.5) * cellHeight - Math.min(cellHeight, cellWidth) * 0.42;
    const denom = maxTtl[cue.kind];
    const alpha = Math.max(0.12, Math.min(1, cue.ttl / denom));
    const s = Math.max(0.7, Math.min(1.4, zoom));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(px, py);
    ctx.scale(s, s);

    if (cue.kind === 'fight' || cue.kind === 'major_fight') {
      const stroke = cue.kind === 'major_fight' ? '#fca5a5' : '#fde68a';
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-7, 7);
      ctx.lineTo(7, -7);
      ctx.moveTo(-7, -7);
      ctx.lineTo(7, 7);
      ctx.stroke();
      if (cue.kind === 'major_fight') {
        ctx.strokeStyle = 'rgba(127, 29, 29, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = cue.kind === 'gather_food' ? 'rgba(187, 247, 208, 0.95)' : 'rgba(217, 180, 140, 0.95)';
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) {
    return `rgba(148, 163, 184, ${alpha})`;
  }
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function darkenHex(hex: string, factor: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) {
    return '#334155';
  }
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `rgb(${r},${g},${b})`;
}

function drawSettlementStructures(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  population: number,
  color: string,
  cellW: number,
  cellH: number,
) {
  const n = Math.min(14, Math.max(4, 3 + Math.ceil(population / 2)));
  const roof = darkenHex(color, 0.55);
  const wall = darkenHex(color, 0.75);
  const step = Math.min(cellW, cellH) * 0.2;
  for (let i = 0; i < n; i += 1) {
    const ring = Math.floor(i / 5);
    const slot = i % 5;
    const ang = (slot / 5) * Math.PI * 2 + ring * 0.35;
    const dist = step * (0.85 + ring * 0.9);
    const hx = px + Math.cos(ang) * dist - 3;
    const hy = py + Math.sin(ang) * dist * 0.85 - 2;
    ctx.fillStyle = wall;
    ctx.fillRect(hx, hy + 3, 6, 5);
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(hx - 1, hy + 3);
    ctx.lineTo(hx + 3, hy - 1);
    ctx.lineTo(hx + 7, hy + 3);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.save();
  ctx.font = '12px Inter, sans-serif';
  const paddingX = 6;
  const paddingY = 4;
  const width = ctx.measureText(text).width + paddingX * 2;
  const height = 18;
  const boxX = x - width / 2;
  const boxY = y - height;

  ctx.fillStyle = '#0f1725cc';
  ctx.fillRect(boxX, boxY, width, height);
  ctx.strokeStyle = '#3b4d6bcc';
  ctx.strokeRect(boxX, boxY, width, height);

  ctx.fillStyle = '#e6edff';
  ctx.fillText(text, boxX + paddingX, boxY + height - paddingY);
  ctx.restore();
}

function drawTrails(
  ctx: CanvasRenderingContext2D,
  heat: Map<number, number>,
  worldWidth: number,
  worldHeight: number,
  cellWidth: number,
  cellHeight: number,
  zoom: number,
) {
  const stride = zoom < 0.55 ? 2 : 1;
  for (const [index, value] of heat.entries()) {
    if (value < 0.08) {
      continue;
    }
    const x = index % worldWidth;
    const y = Math.floor(index / worldWidth);
    if (x < 0 || y < 0 || x >= worldWidth || y >= worldHeight) {
      continue;
    }
    if ((x + y) % stride !== 0) {
      continue;
    }
    const px = x * cellWidth;
    const py = y * cellHeight;
    ctx.fillStyle = `rgba(245, 222, 179, ${Math.min(0.18, value * 0.18)})`;
    ctx.fillRect(px, py, cellWidth + 0.4, cellHeight + 0.4);
  }
}

function decayTrails(worldWidth: number, worldHeight: number) {
  for (const [index, value] of trailHeat.entries()) {
    const x = index % worldWidth;
    const y = Math.floor(index / worldWidth);
    if (x < 0 || y < 0 || x >= worldWidth || y >= worldHeight) {
      trailHeat.delete(index);
      continue;
    }
    const next = value * 0.982;
    if (next < 0.02) {
      trailHeat.delete(index);
    } else {
      trailHeat.set(index, next);
    }
  }
}

function drawAgentAvatar(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number;
    y: number;
    radius: number;
    facing: number;
    baseColor: string;
    skinTone: Agent['avatar']['skinTone'];
    accessory: Agent['avatar']['accessory'];
    sashColor: string;
    selected: boolean;
  },
) {
  const { x, y, radius, facing, baseColor, skinTone, accessory, sashColor, selected } = opts;
  const ux = Math.cos(facing);
  const uy = Math.sin(facing);
  const px = -uy;
  const py = ux;

  const bodyW = radius * 1.1;
  const bodyH = radius * 1.5;
  const headR = radius * 0.55;

  const bodyCx = x;
  const bodyCy = y + radius * 0.35;
  const headCx = x + ux * radius * 0.22;
  const headCy = y - radius * 0.9;

  ctx.fillStyle = darkenHex(baseColor, 0.72);
  fillOrientedRect(ctx, bodyCx, bodyCy, bodyW, bodyH, px, py, ux, uy);

  ctx.strokeStyle = 'rgba(15, 23, 42, 0.42)';
  ctx.lineWidth = 0.8;
  strokeOrientedRect(ctx, bodyCx, bodyCy, bodyW, bodyH, px, py, ux, uy);

  ctx.fillStyle = skinColorForTone(skinTone);
  drawCircle(ctx, headCx, headCy, headR);

  ctx.fillStyle = sashColor;
  fillOrientedRect(ctx, bodyCx + px * radius * 0.08, bodyCy - py * radius * 0.12, bodyW * 0.25, bodyH * 0.92, px, py, ux, uy);

  if (accessory === 'pack' || accessory === 'cape') {
    ctx.fillStyle = accessory === 'pack' ? 'rgba(61, 33, 17, 0.88)' : 'rgba(51, 65, 85, 0.8)';
    fillOrientedRect(ctx, bodyCx - ux * radius * 0.36, bodyCy + uy * radius * 0.1, bodyW * 0.34, bodyH * 0.7, px, py, ux, uy);
  }

  if (accessory === 'band' || accessory === 'stripe') {
    ctx.strokeStyle = accessory === 'band' ? '#f8fafcdd' : '#0f172acc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(headCx - px * headR * 0.9, headCy - py * headR * 0.9);
    ctx.lineTo(headCx + px * headR * 0.9, headCy + py * headR * 0.9);
    ctx.stroke();
  }

  if (selected) {
    ctx.strokeStyle = '#fff2b4';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(x, y, radius + 2.4, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function fillOrientedRect(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  px: number,
  py: number,
  ux: number,
  uy: number,
) {
  ctx.beginPath();
  ctx.moveTo(cx - px * w * 0.5 - ux * h * 0.5, cy - py * w * 0.5 - uy * h * 0.5);
  ctx.lineTo(cx + px * w * 0.5 - ux * h * 0.5, cy + py * w * 0.5 - uy * h * 0.5);
  ctx.lineTo(cx + px * w * 0.5 + ux * h * 0.5, cy + py * w * 0.5 + uy * h * 0.5);
  ctx.lineTo(cx - px * w * 0.5 + ux * h * 0.5, cy - py * w * 0.5 + uy * h * 0.5);
  ctx.closePath();
  ctx.fill();
}

function strokeOrientedRect(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  px: number,
  py: number,
  ux: number,
  uy: number,
) {
  ctx.beginPath();
  ctx.moveTo(cx - px * w * 0.5 - ux * h * 0.5, cy - py * w * 0.5 - uy * h * 0.5);
  ctx.lineTo(cx + px * w * 0.5 - ux * h * 0.5, cy + py * w * 0.5 - uy * h * 0.5);
  ctx.lineTo(cx + px * w * 0.5 + ux * h * 0.5, cy + py * w * 0.5 + uy * h * 0.5);
  ctx.lineTo(cx - px * w * 0.5 + ux * h * 0.5, cy - py * w * 0.5 + uy * h * 0.5);
  ctx.closePath();
  ctx.stroke();
}

function skinColorForTone(tone: Agent['avatar']['skinTone']) {
  switch (tone) {
    case 'light':
      return '#f7d7bc';
    case 'tan':
      return '#d7a67e';
    case 'brown':
      return '#9b6644';
    case 'dark':
      return '#6d422b';
    default:
      return '#c99772';
  }
}

function lerpAngle(from: number, to: number, amount: number) {
  let diff = to - from;
  while (diff > Math.PI) {
    diff -= Math.PI * 2;
  }
  while (diff < -Math.PI) {
    diff += Math.PI * 2;
  }
  return from + diff * amount;
}

function getTerritoryOwnerIds(world: World, activeSettlements: Settlement[], simTick: number): Int32Array {
  const cacheValid =
    cachedTerritoryOwnerIds != null &&
    cachedTerritoryTick === simTick &&
    cachedTerritoryWidth === world.width &&
    cachedTerritoryHeight === world.height;

  if (cacheValid) {
    return cachedTerritoryOwnerIds!;
  }

  const owners = new Int32Array(world.cells.length);
  if (activeSettlements.length > 0) {
    for (let i = 0; i < world.cells.length; i += 1) {
      const cell = world.cells[i];
      const owner = settlementControllingCell(cell.x, cell.y, activeSettlements);
      owners[i] = owner?.id ?? 0;
    }
  }

  cachedTerritoryTick = simTick;
  cachedTerritoryWidth = world.width;
  cachedTerritoryHeight = world.height;
  cachedTerritoryOwnerIds = owners;
  return owners;
}

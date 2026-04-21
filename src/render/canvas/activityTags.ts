/** Short map labels — no emoji (avoids OS glyphs like construction cranes for “building”). */
export const ACTION_ACTIVITY_TAG: Record<string, string> = {
  findFood: 'forage',
  gatherWood: 'wood',
  eatFromInventory: 'eat',
  rest: 'rest',
  joinSettlement: 'shelter',
  returnHome: 'home',
  depositResources: 'store',
  foundSettlement: 'settle',
  migrate: 'move',
  explore: 'roam',
};

export function activityTagForAction(action: string): string | null {
  return ACTION_ACTIVITY_TAG[action] ?? null;
}

export function drawActivityTag(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  scale: number,
) {
  ctx.save();
  const fontPx = Math.max(8, Math.round(9 * scale));
  ctx.font = `600 ${fontPx}px Inter, system-ui, sans-serif`;
  const padX = 5 * scale;
  const w = ctx.measureText(text).width + padX * 2;
  const h = Math.max(13, 13 * scale);
  const bx = x - w / 2;
  const by = y - h / 2;
  const r = 4 * scale;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + w - r, by);
  ctx.quadraticCurveTo(bx + w, by, bx + w, by + r);
  ctx.lineTo(bx + w, by + h - r);
  ctx.quadraticCurveTo(bx + w, by + h, bx + w - r, by + h);
  ctx.lineTo(bx + r, by + h);
  ctx.quadraticCurveTo(bx, by + h, bx, by + h - r);
  ctx.lineTo(bx, by + r);
  ctx.quadraticCurveTo(bx, by, bx + r, by);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
  ctx.lineWidth = 1 / Math.max(scale, 0.45);
  ctx.stroke();

  ctx.fillStyle = 'rgba(248, 250, 252, 0.96)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, by + h / 2);
  ctx.restore();
}

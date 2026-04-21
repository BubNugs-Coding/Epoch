import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { SimulationState } from '../../sim/types/simTypes';
import { renderWorld, screenToWorld, type RenderProfile, type ViewTransform } from '../../render/canvas/renderer';
import { getLastStepProfile } from '../../sim/engine/tick';

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 620;

const MIN_ZOOM = 0.18;
const MAX_ZOOM = 4.2;

type Selection = { agentId: number | null; settlementId: number | null };

type Props = {
  state: SimulationState;
  onSelect: (selection: Selection) => void;
};

type ProfilerSnapshot = RenderProfile & { fps: number; simTick: number };

export function WorldCanvas({ state, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hovered, setHovered] = useState<Selection>({ agentId: null, settlementId: null });
  const [view, setView] = useState<ViewTransform>({ offsetX: 0, offsetY: 0, zoom: 1 });
  const [profiler, setProfiler] = useState<ProfilerSnapshot | null>(null);
  const panRef = useRef<{ lastX: number; lastY: number; moved: number } | null>(null);
  const spaceHeld = useRef(false);
  const skipClickRef = useRef(false);
  const lastProfileUpdateAtRef = useRef(0);
  const lastFrameAtRef = useRef(0);

  const aliveCount = useMemo(
    () => state.agents.reduce((count, agent) => (agent.alive ? count + 1 : count), 0),
    [state.agents],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
      const sy = ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
      const factor = event.deltaY > 0 ? 0.9 : 1.11;

      setView((v) => {
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor));
        const wx = (sx - v.offsetX) / v.zoom;
        const wy = (sy - v.offsetY) / v.zoom;
        return {
          zoom: newZoom,
          offsetX: sx - wx * newZoom,
          offsetY: sy - wy * newZoom,
        };
      });
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        spaceHeld.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld.current = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const profile = renderWorld(
      ctx,
      state.world,
      state.agents,
      state.settlements,
      state.tick,
      {
        agentId: state.selectedAgentId,
        settlementId: state.selectedSettlementId,
      },
      hovered,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      view,
      state.worldCues ?? [],
    );

    const now = performance.now();
    const fps = lastFrameAtRef.current > 0 ? 1000 / Math.max(1, now - lastFrameAtRef.current) : 0;
    lastFrameAtRef.current = now;

    if (now - lastProfileUpdateAtRef.current > 250 || state.tick % 40 === 0) {
      lastProfileUpdateAtRef.current = now;
      setProfiler({
        ...profile,
        fps,
        simTick: state.tick,
      });
    }
  }, [state, hovered, view]);

  const shouldPan = (e: PointerEvent) =>
    e.button === 1 || e.button === 2 || (e.button === 0 && (e.altKey || spaceHeld.current));

  return (
    <section className="world-pane">
      <header className="world-header">
        <h2>Hundred Lives</h2>
        <p>
          Seed {state.seed} | Day {state.day} | Tick {state.tick} | Alive {aliveCount}/{state.config.startAgentCount}
        </p>
        <p className="world-hint">
          Scroll to zoom · Pan: middle mouse, right-drag, or Space + drag · Alt+click-drag
        </p>
      </header>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="world-canvas"
        style={{ touchAction: 'none' }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (!shouldPan(e)) {
            return;
          }
          e.preventDefault();
          skipClickRef.current = false;
          (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
          panRef.current = { lastX: e.clientX, lastY: e.clientY, moved: 0 };
        }}
        onPointerMove={(e) => {
          if (panRef.current) {
            const dx = e.clientX - panRef.current.lastX;
            const dy = e.clientY - panRef.current.lastY;
            const moved = panRef.current.moved + Math.hypot(dx, dy);
            panRef.current = { lastX: e.clientX, lastY: e.clientY, moved };
            setView((v) => ({ ...v, offsetX: v.offsetX + dx, offsetY: v.offsetY + dy }));
            return;
          }

          setHovered(pickSelection(e.clientX, e.clientY, canvasRef.current, state, view));
        }}
        onPointerUp={(e) => {
          if (panRef.current) {
            if (panRef.current.moved > 4) {
              skipClickRef.current = true;
            }
            panRef.current = null;
            try {
              (e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
          }
        }}
        onPointerLeave={() => {
          if (panRef.current) {
            return;
          }
          setHovered({ agentId: null, settlementId: null });
        }}
        onClick={(event) => {
          if (skipClickRef.current) {
            skipClickRef.current = false;
            return;
          }
          if (event.button !== 0) {
            return;
          }
          onSelect(pickSelection(event.clientX, event.clientY, canvasRef.current, state, view));
        }}
      />
      {profiler ? (
        <div className="perf-overlay" aria-live="polite">
          <strong>Profiler</strong>
          <span>tick {state.tick}</span>
          <span>profile tick {profiler.simTick}</span>
          <span>fps {profiler.fps.toFixed(1)}</span>
          <span>frame {profiler.totalMs.toFixed(2)}ms</span>
          <span>terrain {profiler.terrainMs.toFixed(2)}ms</span>
          <span>territory {profiler.territoryMs.toFixed(2)}ms</span>
          <span>agents {profiler.agentsMs.toFixed(2)}ms</span>
          <span>settlements {profiler.settlementsMs.toFixed(2)}ms</span>
          <span>trails {profiler.trailsMs.toFixed(2)}ms</span>
          <span>cues+labels {(profiler.cuesMs + profiler.labelsMs).toFixed(2)}ms</span>
          <span>alive {profiler.aliveAgents}</span>
          <span>active settlements {profiler.activeSettlements}</span>
          <span>trail cells {profiler.trailCells}</span>
          {(() => {
            const step = getLastStepProfile();
            if (!step) {
              return null;
            }
            return (
              <>
                <strong>Sim Step</strong>
                <span>step tick {step.tick}</span>
                <span>step {step.totalMs.toFixed(2)}ms</span>
                <span>modules {step.modulesMs.toFixed(2)}ms</span>
                <span>needs {step.needsMs.toFixed(2)}ms</span>
                <span>decisions {step.decisionsMs.toFixed(2)}ms</span>
                <span>movement {step.movementMs.toFixed(2)}ms</span>
                <span>gather {step.gatherMs.toFixed(2)}ms</span>
                <span>settlements {step.settlementsMs.toFixed(2)}ms</span>
                <span>conflict {step.conflictMs.toFixed(2)}ms</span>
                <span>post {step.postMs.toFixed(2)}ms</span>
              </>
            );
          })()}
        </div>
      ) : null}
    </section>
  );
}

function pickSelection(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement | null,
  state: SimulationState,
  view: ViewTransform,
): Selection {
  if (!canvas) {
    return { agentId: null, settlementId: null };
  }

  const rect = canvas.getBoundingClientRect();
  const sx = ((clientX - rect.left) / rect.width) * CANVAS_WIDTH;
  const sy = ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT;

  const { wx, wy } = screenToWorld(sx, sy, view);

  const cellWidth = CANVAS_WIDTH / state.world.width;
  const cellHeight = CANVAS_HEIGHT / state.world.height;
  const cellX = Math.floor(wx / cellWidth);
  const cellY = Math.floor(wy / cellHeight);

  const pickRadius = Math.max(10, Math.min(cellWidth, cellHeight) * 0.42 * view.zoom);

  const nearestAgent = state.agents
    .filter((agent) => agent.alive)
    .map((agent) => {
      const ax = (agent.renderX + 0.5) * cellWidth;
      const ay = (agent.renderY + 0.5) * cellHeight;
      const dx = ax - wx;
      const dy = ay - wy;
      return { agent, distSq: dx * dx + dy * dy };
    })
    .sort((a, b) => a.distSq - b.distSq)[0];

  if (nearestAgent && nearestAgent.distSq <= pickRadius * pickRadius) {
    return {
      agentId: nearestAgent.agent.id,
      settlementId: nearestAgent.agent.settlementId,
    };
  }

  const settlement = state.settlements.find(
    (item) => item.status !== 'abandoned' && Math.abs(item.x - cellX) <= 1 && Math.abs(item.y - cellY) <= 1,
  );

  if (settlement) {
    return {
      agentId: null,
      settlementId: settlement.id,
    };
  }

  return { agentId: null, settlementId: null };
}

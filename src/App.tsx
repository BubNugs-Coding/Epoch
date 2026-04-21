import { useEffect, useState } from 'react';
import { ControlBar } from './app/layout/ControlBar';
import { DemoOverlay } from './app/layout/DemoOverlay';
import { EndScreen } from './app/layout/EndScreen';
import { SettingsPanel } from './app/layout/SettingsPanel';
import { WorldCanvas } from './app/layout/WorldCanvas';
import { InfoPanel } from './app/layout/InfoPanel';
import { setModuleEnabled } from './sim/modules';
import { initializeSimulation } from './sim/engine/simulation';
import { stepSimulation } from './sim/engine/tick';
import type { SimulationState } from './sim/types/simTypes';
import './App.css';

const DEFAULT_SEED = 1001;
const BASE_TICKS_PER_SECOND = 8;

const DEMO_PRESETS = {
  balanced: { seed: 1201, speed: 4, modules: [] as string[] },
  war: { seed: 1001, speed: 4, modules: ['intergalactic-invaders'] },
  settlement: { seed: 1004, speed: 2, modules: ['myths-and-magic'] },
} as const;

function App() {
  const [state, setState] = useState<SimulationState>(() => initializeSimulation(DEFAULT_SEED));
  const [paused, setPaused] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const effectiveSpeed = Number.isFinite(speedMultiplier) && speedMultiplier > 0 ? speedMultiplier : 1;

  useEffect(() => {
    if (paused) {
      return;
    }

    // RAF-driven fixed-step loop: more resilient than setInterval under UI/main-thread pressure.
    const stepMs = 1000 / (BASE_TICKS_PER_SECOND * effectiveSpeed);
    const maxCatchupSteps = 5;
    let rafId = 0;
    let lastTs = performance.now();
    let accumulator = 0;

    const frame = (ts: number) => {
      const delta = Math.min(250, Math.max(0, ts - lastTs));
      lastTs = ts;
      accumulator += delta;

      setState((prev) => {
        let next = prev;
        let steps = 0;
        while (accumulator >= stepMs && steps < maxCatchupSteps) {
          if (next.phase !== 'running') {
            accumulator = 0;
            break;
          }
          next = stepSimulation(next);
          accumulator -= stepMs;
          steps += 1;
        }
        return next;
      });

      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [paused, effectiveSpeed]);

  const handleContinueAfterMaxDay = () => {
    setState((prev) => {
      if (prev.phase !== 'ended' || prev.endReason !== 'max_day') {
        return prev;
      }

      return {
        ...prev,
        phase: 'running',
        endReason: null,
        config: {
          ...prev.config,
          maxDays: prev.config.maxDays + 200,
        },
      };
    });
    setPaused(false);
  };

  const restartWithSeed = (seed: number) => {
    setState(initializeSimulation(seed));
    setPaused(false);
  };

  const handleRestart = () => restartWithSeed(state.seed);

  const handleToggleModule = (moduleId: string, enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      moduleConfig: setModuleEnabled(prev.moduleConfig, moduleId, enabled),
    }));
  };

  const handleSelect = (selection: { agentId: number | null; settlementId: number | null }) => {
    setState((prev) => ({
      ...prev,
      selectedAgentId: selection.agentId,
      selectedSettlementId: selection.settlementId,
    }));
  };

  const applyDemoPreset = (presetId: string) => {
    const preset = DEMO_PRESETS[presetId as keyof typeof DEMO_PRESETS];
    if (!preset) {
      return;
    }

    const next = initializeSimulation(preset.seed);
    let moduleConfig = next.moduleConfig;

    for (const module of moduleConfig.modules) {
      moduleConfig = setModuleEnabled(moduleConfig, module.id, false);
    }

    for (const moduleId of preset.modules) {
      moduleConfig = setModuleEnabled(moduleConfig, moduleId, true);
    }

    setState({ ...next, moduleConfig });
    setSpeedMultiplier(preset.speed);
    setPaused(false);
  };

  return (
    <>
      <ControlBar
        seed={state.seed}
        paused={paused || state.phase === 'ended'}
        speed={speedMultiplier}
        onPauseToggle={() => setPaused((value) => !value)}
        onSpeedChange={setSpeedMultiplier}
        onRestartSameSeed={handleRestart}
        onStartWithSeed={restartWithSeed}
        onApplyDemoPreset={applyDemoPreset}
      />

      <SettingsPanel moduleConfig={state.moduleConfig} onToggleModule={handleToggleModule} />

      {state.phase === 'ended' ? (
        <main className="app-shell single-pane">
          <EndScreen state={state} onRestart={handleRestart} onContinueAfterMaxDay={handleContinueAfterMaxDay} />
        </main>
      ) : (
        <main className="app-shell">
          <section className="world-column">
            <WorldCanvas state={state} onSelect={handleSelect} />
            <DemoOverlay state={state} />
          </section>
          <InfoPanel state={state} onContinueAfterMaxDay={handleContinueAfterMaxDay} />
        </main>
      )}
    </>
  );
}

export default App;

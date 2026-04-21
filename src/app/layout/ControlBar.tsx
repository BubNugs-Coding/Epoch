import { useState } from 'react';

type Props = {
  seed: number;
  paused: boolean;
  speed: number;
  onPauseToggle: () => void;
  onSpeedChange: (speed: number) => void;
  onRestartSameSeed: () => void;
  onStartWithSeed: (seed: number) => void;
  onApplyDemoPreset: (presetId: string) => void;
};

export function ControlBar({
  seed,
  paused,
  speed,
  onPauseToggle,
  onSpeedChange,
  onRestartSameSeed,
  onStartWithSeed,
  onApplyDemoPreset,
}: Props) {
  const [seedInput, setSeedInput] = useState(`${seed}`);
  const [demoPreset, setDemoPreset] = useState('balanced');

  return (
    <section className="control-bar">
      <div className="control-row">
        <button type="button" className="continue-button" onClick={onPauseToggle}>
          {paused ? 'Resume' : 'Pause'}
        </button>

        <label className="speed-control">
          Speed
          <select value={speed} onChange={(event) => onSpeedChange(Number(event.target.value))}>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
            <option value={8}>8x</option>
          </select>
        </label>

        <button type="button" className="continue-button" onClick={onRestartSameSeed}>
          Restart Seed {seed}
        </button>

        <div className="seed-control">
          <input
            value={seedInput}
            onChange={(event) => setSeedInput(event.target.value)}
            aria-label="Simulation seed"
          />
          <button
            type="button"
            className="continue-button"
            onClick={() => {
              const next = Number(seedInput.trim());
              if (!Number.isFinite(next)) {
                return;
              }
              onStartWithSeed(Math.max(1, Math.floor(next)));
            }}
          >
            Start Seed
          </button>
        </div>
      </div>

      <div className="control-row">
        <label className="speed-control">
          Demo Preset
          <select value={demoPreset} onChange={(event) => setDemoPreset(event.target.value)}>
            <option value="balanced">Balanced Civ Rise</option>
            <option value="war">War-Heavy</option>
            <option value="settlement">Settlement-Heavy</option>
          </select>
        </label>
        <button type="button" className="continue-button" onClick={() => onApplyDemoPreset(demoPreset)}>
          Apply Demo Mode
        </button>
      </div>
    </section>
  );
}

import { generateChronicle } from '../../sim/recap/chronicle';
import type { SimulationState } from '../../sim/types/simTypes';

type Props = {
  state: SimulationState;
  onRestart: () => void;
  onContinueAfterMaxDay: () => void;
};

export function EndScreen({ state, onRestart, onContinueAfterMaxDay }: Props) {
  const chronicle = generateChronicle(state);

  return (
    <section className="end-screen">
      <header className="end-header">
        <h2>{chronicle.title}</h2>
        <p>{chronicle.subtitle}</p>
      </header>

      <div className="end-badges">
        <span className="badge">End: {formatEndReason(state.endReason)}</span>
        <span className="badge">Seed: {state.seed}</span>
        <span className="badge">Days: {state.day}</span>
      </div>

      <div className="end-actions">
        <button type="button" className="continue-button" onClick={onRestart}>
          Restart Same Seed
        </button>
        {state.endReason === 'max_day' ? (
          <button type="button" className="continue-button" onClick={onContinueAfterMaxDay}>
            Continue Simulation
          </button>
        ) : null}
      </div>

      <div className="chronicle-grid">
        <article className="chronicle-copy">
          <h3>The Early Struggle</h3>
          <p>{chronicle.opening}</p>

          <h3>The Rise of Settlements</h3>
          <p>{chronicle.rise}</p>

          <h3>Conflict and Change</h3>
          <p>{chronicle.conflict}</p>

          <h3>The Final Days</h3>
          <p>{chronicle.ending}</p>
        </article>

        <aside className="chronicle-side">
          <h3>Key Stats</h3>
          <ul className="stats-list">
            {chronicle.keyStats.map((entry) => (
              <li key={entry.label}>
                <strong>{entry.label}</strong>
                <span>{entry.value}</span>
              </li>
            ))}
          </ul>

          <h3>Notable Figures</h3>
          <ul className="stats-list">
            {chronicle.notableFigures.map((entry) => (
              <li key={entry.label}>
                <strong>{entry.label}</strong>
                <span>{entry.value}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <div className="chart-grid">
        <SimpleLineChart title="Population" values={state.stats.populationHistory} color="#8cd88a" />
        <SimpleLineChart title="Settlements" values={state.stats.settlementHistory} color="#e0ba72" />
        <SimpleLineChart title="Deaths" values={state.stats.deathHistory} color="#c97a7a" />
      </div>
    </section>
  );
}

type ChartProps = {
  title: string;
  values: number[];
  color: string;
};

function SimpleLineChart({ title, values, color }: ChartProps) {
  const width = 320;
  const height = 120;
  const padded = values.length > 1 ? values : [0, ...values, 0];
  const maxValue = Math.max(1, ...padded);
  const finalValue = padded[padded.length - 1] ?? 0;

  const points = padded
    .map((value, index) => {
      const x = (index / (padded.length - 1)) * (width - 24) + 12;
      const y = height - 14 - (value / maxValue) * (height - 28);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <article className="chart-card">
      <div className="chart-head">
        <h4>{title}</h4>
        <span>{finalValue}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} trend`}>
        <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </article>
  );
}

function formatEndReason(reason: SimulationState['endReason']) {
  if (reason === 'all_dead') return 'All Agents Dead';
  if (reason === 'settlement_dominance') return 'Settlement Dominance';
  if (reason === 'max_day') return 'Max Day Reached';
  if (reason === 'module') return 'Module End Condition';
  return 'Unknown';
}

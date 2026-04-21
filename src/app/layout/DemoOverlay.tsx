import { useMemo } from 'react';
import type { SimulationState } from '../../sim/types/simTypes';

type Props = {
  state: SimulationState;
};

// Lightweight presenter-facing overlay for quick storytelling cues.
export function DemoOverlay({ state }: Props) {
  const firstSettlementDay = useMemo(() => findFirstDay(state, 'settlement_founded'), [state]);
  const firstDominanceDay = useMemo(() => findFirstDay(state, 'dominant_settlement_emerged'), [state]);
  const majorBattles = useMemo(
    () => state.events.filter((event) => event.type === 'major_battle_occurred').length,
    [state.events],
  );
  const phaseLabel = useMemo(() => inferPhase(state), [state]);

  return (
    <section className="demo-overlay">
      <h4>Demo Metrics</h4>
      <div className="demo-metrics-grid">
        <Metric label="Phase" value={phaseLabel} />
        <Metric label="First Settlement" value={firstSettlementDay != null ? `Day ${firstSettlementDay}` : 'N/A'} />
        <Metric label="First Dominance" value={firstDominanceDay != null ? `Day ${firstDominanceDay}` : 'N/A'} />
        <Metric label="Major Battles" value={`${majorBattles}`} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="demo-metric">
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}

function findFirstDay(state: SimulationState, type: string) {
  const hit = state.events.find((event) => event.type === type);
  return hit?.day ?? null;
}

function inferPhase(state: SimulationState) {
  if (state.phase === 'ended') {
    return 'End State';
  }

  const day = state.day;
  if (day < 35) {
    return 'Early Struggle';
  }
  if (day < 90) {
    return 'Rise';
  }
  if (day < 150) {
    return 'Conflict';
  }

  return 'Late Stage';
}

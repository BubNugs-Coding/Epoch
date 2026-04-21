import { useMemo, useState } from 'react';
import type { SimulationState } from '../../sim/types/simTypes';

type InspectorTab = 'agent' | 'settlement' | 'world';
type EventFilter = 'all' | 'major';

type Props = {
  state: SimulationState;
  onContinueAfterMaxDay: () => void;
};

export function InfoPanel({ state, onContinueAfterMaxDay }: Props) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('agent');
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');

  const sampleAgents = state.agents.slice(0, 4);
  const aliveAgents = state.agents.filter((agent) => agent.alive);
  const activeSettlements = state.settlements.filter((item) => item.status !== 'abandoned');

  const selectedAgent =
    state.selectedAgentId != null ? state.agents.find((agent) => agent.id === state.selectedAgentId) ?? null : null;
  const selectedSettlement =
    state.selectedSettlementId != null
      ? state.settlements.find((settlement) => settlement.id === state.selectedSettlementId) ?? null
      : null;

  const settlementLeaderName = useMemo(() => {
    if (!selectedSettlement) {
      return null;
    }
    const leader = state.agents.find((a) => a.id === selectedSettlement.leaderId);
    return leader?.name ?? null;
  }, [selectedSettlement, state.agents]);

  const settlementFounderName = useMemo(() => {
    if (!selectedSettlement) {
      return null;
    }
    const founder = state.agents.find((a) => a.id === selectedSettlement.founderId);
    return founder?.name ?? null;
  }, [selectedSettlement, state.agents]);

  const dominantSettlementLabel = useMemo(() => {
    if (state.stats.dominantSettlementId == null) {
      return '-';
    }
    const s = state.settlements.find((x) => x.id === state.stats.dominantSettlementId);
    return s ? `${s.name} (#${s.id})` : `#${state.stats.dominantSettlementId}`;
  }, [state.settlements, state.stats.dominantSettlementId]);

  const avgHunger = useMemo(
    () =>
      aliveAgents.length === 0
        ? 0
        : aliveAgents.reduce((sum, agent) => sum + agent.hunger, 0) / aliveAgents.length,
    [aliveAgents],
  );
  const avgEnergy = useMemo(
    () =>
      aliveAgents.length === 0
        ? 0
        : aliveAgents.reduce((sum, agent) => sum + agent.energy, 0) / aliveAgents.length,
    [aliveAgents],
  );

  const filteredEvents =
    eventFilter === 'major'
      ? state.events.filter((event) => event.importance >= 3)
      : state.events;
  const recentEvents = filteredEvents.slice(-12).reverse();

  return (
    <aside className="info-panel">
      <h3>Simulation Status</h3>
      <p className="muted">
        {state.phase === 'running' ? 'Running survival + settlement loop.' : formatEndReason(state.endReason)}
      </p>

      {state.phase === 'ended' && state.endReason === 'max_day' ? (
        <button type="button" className="continue-button" onClick={onContinueAfterMaxDay}>
          Continue Beyond Max Day
        </button>
      ) : null}

      <div className="stats-grid">
        <div>
          <strong>Alive</strong>
          <span>{aliveAgents.length}</span>
        </div>
        <div>
          <strong>Avg Hunger</strong>
          <span>{avgHunger.toFixed(1)}</span>
        </div>
        <div>
          <strong>Avg Energy</strong>
          <span>{avgEnergy.toFixed(1)}</span>
        </div>
        <div>
          <strong>Settlements</strong>
          <span>{activeSettlements.length}</span>
        </div>
        <div>
          <strong>Dominant settlement</strong>
          <span>{dominantSettlementLabel}</span>
        </div>
      </div>

      <h4>Inspector</h4>
      <div className="tab-row">
        {(['agent', 'settlement', 'world'] as InspectorTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`tab-chip ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {capitalize(tab)}
          </button>
        ))}
      </div>

      <div className="inspector-card">
        {activeTab === 'agent' ? (
          selectedAgent ? (
            <>
              <strong>{selectedAgent.name}</strong>
              <small>
                action {selectedAgent.currentAction} | goal {selectedAgent.currentGoal}
              </small>
              <small>
                health {selectedAgent.health.toFixed(0)} | hunger {selectedAgent.hunger.toFixed(0)} | energy{' '}
                {selectedAgent.energy.toFixed(0)}
              </small>
              <small>
                traits {selectedAgent.traits.join(', ')} | inv f:{selectedAgent.inventory.food.toFixed(1)} w:
                {selectedAgent.inventory.wood.toFixed(1)}
              </small>
            </>
          ) : (
            <small className="muted">No agent selected. Click an agent on the map.</small>
          )
        ) : null}

        {activeTab === 'settlement' ? (
          selectedSettlement ? (
            <>
              <strong>{selectedSettlement.name}</strong>
              <small>
                pop {selectedSettlement.population} | status {selectedSettlement.status} | age{' '}
                {selectedSettlement.ageDays.toFixed(1)}d
              </small>
              <small>
                founder {settlementFounderName ?? `#${selectedSettlement.founderId}`} | leader{' '}
                {settlementLeaderName ?? `#${selectedSettlement.leaderId}`}
              </small>
              <small>
                stores f:{selectedSettlement.foodStored.toFixed(1)} w:{selectedSettlement.woodStored.toFixed(1)} s:
                {selectedSettlement.stoneStored.toFixed(1)}
              </small>
            </>
          ) : (
            <small className="muted">No settlement selected. Click a settlement on the map.</small>
          )
        ) : null}

        {activeTab === 'world' ? (
          <>
            <strong>World Overview</strong>
            <small>
              size {state.world.width}x{state.world.height} | day {state.day} | tick {state.tick}
            </small>
            <small>
              deaths {state.stats.totalDeaths} | settlements founded {state.stats.settlementsFounded}
            </small>
            <small>
              largest settlement {state.stats.largestSettlementPopulation} | peak population {state.stats.peakPopulation}
            </small>
          </>
        ) : null}
      </div>

      <h4>Live Trends</h4>
      <div className="mini-chart-grid">
        <MiniTrend title="Pop" values={state.stats.populationHistory} color="#8cd88a" />
        <MiniTrend title="Set" values={state.stats.settlementHistory} color="#e0ba72" />
        <MiniTrend title="Deaths" values={state.stats.deathHistory} color="#c97a7a" />
      </div>

      <h4>Sample Agents</h4>
      <ul className="sample-list">
        {sampleAgents.map((agent) => (
          <li key={agent.id}>
            <span>
              {agent.name} {agent.alive ? '' : '(dead)'}
            </span>
            <small>
              {agent.currentAction} | hunger {agent.hunger.toFixed(0)} | energy {agent.energy.toFixed(0)}
            </small>
          </li>
        ))}
      </ul>

      <h4 className="event-title">Live Event Feed</h4>
      <div className="tab-row">
        <button
          type="button"
          className={`tab-chip ${eventFilter === 'all' ? 'active' : ''}`}
          onClick={() => setEventFilter('all')}
        >
          All
        </button>
        <button
          type="button"
          className={`tab-chip ${eventFilter === 'major' ? 'active' : ''}`}
          onClick={() => setEventFilter('major')}
        >
          Major
        </button>
      </div>
      <ul className="event-list">
        {recentEvents.length === 0 ? (
          <li className="muted">No events yet.</li>
        ) : (
          recentEvents.map((event) => (
            <li key={event.id}>
              <span>
                D{event.day} {event.source === 'module' ? `(module:${event.moduleId ?? 'unknown'})` : ''}
              </span>
              <small>{event.summary}</small>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}

function formatEndReason(reason: SimulationState['endReason']) {
  if (reason === 'all_dead') return 'Simulation ended: all agents died.';
  if (reason === 'settlement_dominance') return 'Simulation ended: one settlement dominates.';
  if (reason === 'max_day') return 'Simulation paused at max day; you can continue.';
  if (reason === 'module') return 'Simulation ended by module condition.';
  return 'Simulation ended.';
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

type TrendProps = {
  title: string;
  values: number[];
  color: string;
};

function MiniTrend({ title, values, color }: TrendProps) {
  const width = 120;
  const height = 48;
  const series = values.length > 1 ? values : [0, ...values, 0];
  const max = Math.max(1, ...series);

  const points = series
    .map((value, index) => {
      const x = (index / (series.length - 1)) * (width - 10) + 5;
      const y = height - 5 - (value / max) * (height - 10);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <article className="mini-chart">
      <header>
        <strong>{title}</strong>
        <span>{series[series.length - 1] ?? 0}</span>
      </header>
      <svg viewBox={`0 0 ${width} ${height}`} aria-label={`${title} live trend`}>
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
      </svg>
    </article>
  );
}

import type { Agent, Settlement, SimEvent, SimulationState, WorldCue } from '../types/simTypes';
import { runDecisionSystem, updateSettlementVisitCounters } from '../systems/decisionSystem';
import { runSettlementMemberIntolerance } from '../systems/settlementIntolerance';
import { assignEventIds, createDayEvents, createDeathEvents } from '../systems/eventSystem';
import { runConflictSystem } from '../systems/conflictSystem';
import { runGatherSystem } from '../systems/gatherSystem';
import { runMigrationPlanningSystem, runMigrationResolutionSystem } from '../systems/migrationSystem';
import { runMovementSystem } from '../systems/movementSystem';
import { runNeedsSystem } from '../systems/needsSystem';
import { runSettlementSystem } from '../systems/settlementSystem';
import { cloneAgents, cloneSettlements, cloneWorld } from '../systems/simHelpers';
import { updateStats } from '../systems/statsSystem';
import { simModuleManager } from '../modules';

export type SimStepProfile = {
  tick: number;
  totalMs: number;
  modulesMs: number;
  needsMs: number;
  decisionsMs: number;
  movementMs: number;
  gatherMs: number;
  settlementsMs: number;
  conflictMs: number;
  postMs: number;
  alive: number;
  settlements: number;
};

let lastStepProfile: SimStepProfile | null = null;

export function getLastStepProfile() {
  return lastStepProfile;
}

// Runs one deterministic simulation tick.
export function stepSimulation(previous: SimulationState): SimulationState {
  if (previous.phase === 'ended') {
    return previous;
  }

  const tick = previous.tick + 1;
  const day = Math.floor(tick / previous.config.ticksPerDay);
  const stepStart = performance.now();
  let modulesMs = 0;
  let needsMs = 0;
  let decisionsMs = 0;
  let movementMs = 0;
  let gatherMs = 0;
  let settlementsMs = 0;
  let conflictMs = 0;
  let postMs = 0;

  const world = cloneWorld(previous.world);
  const agents = cloneAgents(previous.agents);
  const settlements = cloneSettlements(previous.settlements);
  const beforeAgents = cloneAgents(previous.agents);

  const mutable = {
    tick,
    day,
    seed: previous.seed,
    world,
    agents,
    settlements,
    moduleConfig: previous.moduleConfig,
    events: previous.events,
    pendingModuleEvents: [] as SimEvent[],
    moduleEndReason: previous.moduleEndReason,
  };

  let phaseStart = performance.now();
  const dayChanged = day > previous.day;
  if (dayChanged) {
    simModuleManager.runOnDayEnd(mutable);
    simModuleManager.runOnDayStart(mutable);
  }

  simModuleManager.runOnTick(mutable);
  modulesMs += performance.now() - phaseStart;

  // Stable system order keeps outcomes reproducible and easier to debug.
  phaseStart = performance.now();
  runNeedsSystem(mutable, previous.config);
  for (const agent of mutable.agents) {
    if (agent.combatCooldown > 0) {
      agent.combatCooldown -= 1;
    }
    if (agent.migrationCooldown > 0) {
      agent.migrationCooldown -= 1;
    }
  }
  needsMs += performance.now() - phaseStart;

  phaseStart = performance.now();
  updateSettlementVisitCounters(mutable);
  runSettlementMemberIntolerance(mutable);
  runDecisionSystem(mutable, previous.config);
  const migrationStartEvents = runMigrationPlanningSystem(mutable);
  decisionsMs += performance.now() - phaseStart;

  phaseStart = performance.now();
  runMovementSystem(mutable, previous.config);
  const migrationCompleteEvents = runMigrationResolutionSystem(mutable);
  movementMs += performance.now() - phaseStart;

  phaseStart = performance.now();
  const gatherEvents = runGatherSystem(mutable, previous.config);
  gatherMs += performance.now() - phaseStart;

  phaseStart = performance.now();
  const settlementEvents = runSettlementSystem(mutable, previous.config);
  settlementsMs += performance.now() - phaseStart;

  phaseStart = performance.now();
  const conflictEvents = runConflictSystem(mutable, previous.config);
  conflictMs += performance.now() - phaseStart;

  phaseStart = performance.now();
  for (const agent of agents) {
    if (!agent.alive) {
      continue;
    }

    // Keep renderer aligned with simulation ticks when frame interpolation is disabled.
    agent.renderX = agent.x;
    agent.renderY = agent.y;

    agent.ageDays += 1 / previous.config.ticksPerDay;

    if (agent.health <= 0) {
      agent.alive = false;
      agent.currentAction = 'dead';
      agent.currentGoal = 'none';
    }
  }

  const deathEvents = createDeathEvents(day, beforeAgents, agents);
  const dayEvents = tick % previous.config.ticksPerDay === 0 ? createDayEvents(day) : [];

  const aliveCount = agents.filter((agent) => agent.alive).length;
  const dominance = evaluateSettlementDominance(settlements, agents, aliveCount, previous.config.dominanceThreshold);
  const newlyDominant = dominance && previous.stats.dominantSettlementId !== dominance.id;
  const dominanceEvents = dominance
    ? newlyDominant
      ? [
        {
          id: 0,
          day,
          type: 'dominant_settlement_emerged',
          summary: `${dominance.name} now holds most of the living population under one banner.`,
          importance: 4,
          settlementIds: [dominance.id],
        } satisfies SimEvent,
      ]
      : []
    : [];

  const moduleEventsBeforeOnEvent = drainModuleEvents(mutable);
  const firstPassEvents = [
    ...withBaseSource(dayEvents),
    ...withBaseSource(deathEvents),
    ...withBaseSource(gatherEvents),
    ...withBaseSource(migrationStartEvents),
    ...withBaseSource(migrationCompleteEvents),
    ...withBaseSource(settlementEvents),
    ...withBaseSource(conflictEvents),
    ...withBaseSource(dominanceEvents),
    ...moduleEventsBeforeOnEvent,
  ];

  for (const event of firstPassEvents) {
    simModuleManager.runOnEvent(event, mutable);
  }

  const moduleEventsAfterOnEvent = drainModuleEvents(mutable);

  const decayedCues = (previous.worldCues ?? [])
    .map((cue) => ({ ...cue, ttl: cue.ttl - 1 }))
    .filter((cue) => cue.ttl > 0);

  const battleCues: WorldCue[] = conflictEvents
    .filter((e) => e.type === 'battle_occurred' || e.type === 'major_battle_occurred')
    .filter((e): e is typeof e & { x: number; y: number } => e.x != null && e.y != null)
    .map((e, i) => ({
      id: tick * 7919 + i,
      kind: e.type === 'major_battle_occurred' ? 'major_fight' : 'fight',
      x: e.x,
      y: e.y,
      ttl: e.type === 'major_battle_occurred' ? 56 : 40,
    }));

  const gatherPopCues: WorldCue[] = gatherEvents
    .filter((e) => e.type === 'food_gathered' || e.type === 'wood_gathered')
    .filter((e): e is typeof e & { x: number; y: number } => e.x != null && e.y != null)
    .map((e, i) => ({
      id: tick * 7927 + i + 4000,
      kind: e.type === 'food_gathered' ? 'gather_food' : 'gather_wood',
      x: e.x,
      y: e.y,
      ttl: 22,
    }));

  const worldCues = [...decayedCues, ...battleCues, ...gatherPopCues].slice(-400);

  const appendedEvents = assignEventIds(previous.events, [
    ...firstPassEvents,
    ...moduleEventsAfterOnEvent,
  ]);
  const events = [...previous.events, ...appendedEvents].slice(-1800);

  const stats = updateStats({
    previous: previous.stats,
    aliveCount,
    settlementCount: settlements.filter((s) => s.status !== 'abandoned').length,
    newDeaths: deathEvents.length,
    settlementsFoundedDelta: settlementEvents.filter((event) => event.type === 'settlement_founded').length,
    largestSettlementPopulation: settlements.reduce((best, s) => Math.max(best, s.population), 0),
    config: previous.config,
    tick,
    dominantSettlementId: dominance?.id ?? null,
  });

  const reachedMaxDay = day >= previous.config.maxDays;
  const allDead = aliveCount === 0;
  const hasDominance = Boolean(dominance);
  const baseEndResult = {
    phase: reachedMaxDay || allDead || hasDominance ? 'ended' : 'running',
    endReason: allDead ? 'all_dead' : hasDominance ? 'settlement_dominance' : reachedMaxDay ? 'max_day' : null,
    moduleEndReason: null,
  } as const;
  const finalEndResult = simModuleManager.applyEndConditionModifiers(mutable, baseEndResult);
  postMs += performance.now() - phaseStart;

  lastStepProfile = {
    tick,
    totalMs: performance.now() - stepStart,
    modulesMs,
    needsMs,
    decisionsMs,
    movementMs,
    gatherMs,
    settlementsMs,
    conflictMs,
    postMs,
    alive: aliveCount,
    settlements: settlements.filter((s) => s.status !== 'abandoned').length,
  };

  return {
    ...previous,
    tick,
    day,
    world,
    agents,
    settlements,
    events,
    stats,
    worldCues,
    phase: finalEndResult.phase,
    endReason: finalEndResult.endReason,
    moduleConfig: previous.moduleConfig,
    moduleEndReason: finalEndResult.moduleEndReason ?? null,
  };
}

// Visual-only smoothing: grid logic still uses integer cells; render floats ease toward targets.
export function interpolateSimulation(state: SimulationState): SimulationState {
  const agents = state.agents.map((agent) => {
    if (!agent.alive && agent.renderX === agent.x && agent.renderY === agent.y) {
      return agent;
    }

    const dx = agent.x - agent.renderX;
    const dy = agent.y - agent.renderY;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.0015) {
      return { ...agent, renderX: agent.x, renderY: agent.y };
    }

    // Ease-in/ease-out curve so movement feels chosen rather than mechanical.
    const eased = Math.min(0.58, 0.04 + Math.pow(Math.min(1.4, dist), 1.15) * 0.24);
    const nextRenderX = agent.renderX + dx * eased;
    const nextRenderY = agent.renderY + dy * eased;

    return {
      ...agent,
      renderX: nextRenderX,
      renderY: nextRenderY,
    };
  });

  return {
    ...state,
    agents,
  };
}

function evaluateSettlementDominance(
  settlementList: Settlement[],
  agentList: Agent[],
  aliveCount: number,
  threshold: number,
): Settlement | null {
  if (aliveCount === 0) {
    return null;
  }

  for (const settlement of settlementList) {
    if (settlement.status === 'abandoned') {
      continue;
    }

    const members = agentList.filter((agent) => agent.alive && agent.settlementId === settlement.id).length;
    const ratio = members / aliveCount;
    if (ratio >= threshold) {
      return settlement;
    }
  }

  return null;
}

function withBaseSource(events: SimEvent[]) {
  return events.map((event) => ({
    ...event,
    source: event.source ?? 'base',
  }));
}

function drainModuleEvents(state: { pendingModuleEvents: SimEvent[] }) {
  const queued = [...state.pendingModuleEvents];
  state.pendingModuleEvents.length = 0;
  return queued;
}

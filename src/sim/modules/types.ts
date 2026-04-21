import type { Agent, ModuleConfigState, SimEvent, SimulationState } from '../types/simTypes';
import type { MutableSimState } from '../systems/simHelpers';

export type ActionScoreMap = Record<string, number>;

export type EndConditionResult = {
  phase: 'running' | 'ended';
  endReason: SimulationState['endReason'];
  moduleEndReason?: string | null;
};

export type ModuleRuntimeState = SimulationState | MutableSimState;

export type SimModule = {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
  onInit?: (state: SimulationState) => void;
  onTick?: (state: ModuleRuntimeState) => void;
  onDayStart?: (state: ModuleRuntimeState) => void;
  onDayEnd?: (state: ModuleRuntimeState) => void;
  onEvent?: (event: SimEvent, state: ModuleRuntimeState) => void;
  modifyAgentActionScores?: (agent: Agent, scores: ActionScoreMap, state: ModuleRuntimeState) => void;
  modifyEndConditions?: (state: ModuleRuntimeState, currentResult: EndConditionResult) => EndConditionResult | void;
};

export type { ModuleConfigState };

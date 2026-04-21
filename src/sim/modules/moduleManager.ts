import type { Agent, SimEvent, SimulationState } from '../types/simTypes';
import type { MutableSimState } from '../systems/simHelpers';
import type {
  ActionScoreMap,
  EndConditionResult,
  ModuleConfigState,
  ModuleRuntimeState,
  SimModule,
} from './types';

export class ModuleManager {
  private registry = new Map<string, SimModule>();

  register(module: SimModule) {
    this.registry.set(module.id, module);
  }

  setEnabled(moduleId: string, enabled: boolean) {
    const existing = this.registry.get(moduleId);
    if (!existing) {
      return;
    }

    this.registry.set(moduleId, { ...existing, enabled });
  }

  createConfigState(): ModuleConfigState {
    return {
      modules: this.listRegistered().map((module) => ({
        id: module.id,
        name: module.name,
        description: module.description,
        enabled: module.enabled,
      })),
    };
  }

  setConfigEnabled(config: ModuleConfigState, moduleId: string, enabled: boolean): ModuleConfigState {
    return {
      modules: config.modules.map((entry) => (entry.id === moduleId ? { ...entry, enabled } : entry)),
    };
  }

  getActiveModules(config: ModuleConfigState): SimModule[] {
    const enabledSet = new Set(config.modules.filter((entry) => entry.enabled).map((entry) => entry.id));
    return this.listRegistered().filter((module) => enabledSet.has(module.id));
  }

  runOnInit(state: SimulationState) {
    const active = this.getActiveModules(state.moduleConfig);
    for (const module of active) {
      this.safeRun(module, 'onInit', () => module.onInit?.(state));
    }
  }

  runOnTick(state: ModuleRuntimeState) {
    const active = this.getActiveModules(state.moduleConfig);
    for (const module of active) {
      this.safeRun(module, 'onTick', () => module.onTick?.(state));
    }
  }

  runOnDayStart(state: ModuleRuntimeState) {
    const active = this.getActiveModules(state.moduleConfig);
    for (const module of active) {
      this.safeRun(module, 'onDayStart', () => module.onDayStart?.(state));
    }
  }

  runOnDayEnd(state: ModuleRuntimeState) {
    const active = this.getActiveModules(state.moduleConfig);
    for (const module of active) {
      this.safeRun(module, 'onDayEnd', () => module.onDayEnd?.(state));
    }
  }

  runOnEvent(event: SimEvent, state: ModuleRuntimeState) {
    const active = this.getActiveModules(state.moduleConfig);
    for (const module of active) {
      this.safeRun(module, 'onEvent', () => module.onEvent?.(event, state));
    }
  }

  applyActionScoreModifiers(agent: Agent, scores: ActionScoreMap, state: MutableSimState) {
    const active = this.getActiveModules(state.moduleConfig);
    for (const module of active) {
      this.safeRun(module, 'modifyAgentActionScores', () => module.modifyAgentActionScores?.(agent, scores, state));
    }
  }

  applyEndConditionModifiers(state: MutableSimState, base: EndConditionResult): EndConditionResult {
    const active = this.getActiveModules(state.moduleConfig);
    let current = base;

    for (const module of active) {
      this.safeRun(module, 'modifyEndConditions', () => {
        const next = module.modifyEndConditions?.(state, current);
        if (!next) {
          return;
        }

        // Base end conditions cannot be cancelled by modules.
        if (base.phase === 'ended') {
          return;
        }

        current = {
          phase: next.phase,
          endReason: next.endReason,
          moduleEndReason: next.moduleEndReason ?? null,
        };
      });
    }

    return current;
  }

  private listRegistered() {
    return Array.from(this.registry.values());
  }

  private safeRun(module: SimModule, hookName: string, runner: () => void) {
    try {
      runner();
    } catch (error) {
      console.error(`[module:${module.id}] hook ${hookName} failed`, error);
    }
  }
}

export function queueModuleEvent(
  state: ModuleRuntimeState,
  moduleId: string,
  event: Omit<SimEvent, 'id' | 'source' | 'moduleId'>,
) {
  const tagged: SimEvent = {
    ...event,
    id: 0,
    source: 'module',
    moduleId,
  };

  if ('pendingModuleEvents' in state) {
    state.pendingModuleEvents.push(tagged);
    return;
  }

  state.events.push(tagged);
}

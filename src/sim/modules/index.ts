import { ModuleManager } from './moduleManager';
import { intergalacticInvadersModule } from './intergalacticInvaders';
import { mythsAndMagicModule } from './mythsAndMagic';

export const simModuleManager = new ModuleManager();

simModuleManager.register(mythsAndMagicModule);
simModuleManager.register(intergalacticInvadersModule);

export const setModuleEnabled = (
  config: ReturnType<typeof simModuleManager.createConfigState>,
  moduleId: string,
  enabled: boolean,
) => simModuleManager.setConfigEnabled(config, moduleId, enabled);

export type { SimModule, ModuleConfigState } from './types';

import type { SimModule } from './types';
import { queueModuleEvent } from './moduleManager';
import { deterministicInt } from '../systems/simHelpers';

export const mythsAndMagicModule: SimModule = {
  id: 'myths-and-magic',
  name: 'Myths & Magic',
  enabled: false,
  description: 'Adds magical events and cult-like faction variations.',

  onDayStart(state) {
    if (state.day <= 2) {
      return;
    }

    const roll = deterministicInt(state.seed * 19 + state.day * 97, 1, 100);
    if (roll > 8) {
      return;
    }

    queueModuleEvent(state, 'myths-and-magic', {
      day: state.day,
      type: 'magic_omen',
      summary: 'A strange omen spread through nearby camps, fueling myths and unease.',
      importance: 2,
    });
  },
};

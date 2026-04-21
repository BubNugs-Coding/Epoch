import type { SimModule } from './types';
import { queueModuleEvent } from './moduleManager';
import { deterministicInt } from '../systems/simHelpers';

export const intergalacticInvadersModule: SimModule = {
  id: 'intergalactic-invaders',
  name: 'Intergalactic Invaders',
  enabled: false,
  description: 'Adds alien incursions and meteor events.',

  onDayEnd(state) {
    if (state.day < 4) {
      return;
    }

    const roll = deterministicInt(state.seed * 31 + state.day * 53, 1, 100);
    if (roll > 7) {
      return;
    }

    queueModuleEvent(state, 'intergalactic-invaders', {
      day: state.day,
      type: 'anomaly_detected',
      summary: 'A burning object crossed the sky and struck beyond the northern ridge.',
      importance: 2,
    });
  },
};

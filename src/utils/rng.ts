export type Rng = {
  next: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(values: T[]) => T;
};

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number) => {
    const span = max - min + 1;
    return Math.floor(next() * span) + min;
  };

  const pick = <T>(values: T[]) => values[int(0, values.length - 1)];

  return { next, int, pick };
}

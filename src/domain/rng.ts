export interface Rng {
  next(): number;
  int(bound: number): number;
}

/** Mulberry32. Same seed, same stream. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(bound: number): number {
      if (bound <= 0) return 0;
      return Math.floor(next() * bound);
    },
  };
}

// mulberry32 - a small, fast PRNG. A given seed always produces the exact same sequence of
// values, which is what lets generateTrianglifyMesh stay a pure function of its props: the same
// BannerTrianglifyConfig always jitters to the same mesh, with no flicker between re-renders.
export const createSeededRandom = (seed: number): (() => number) => {
  let state = seed;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

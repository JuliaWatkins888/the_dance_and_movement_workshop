// Deterministic 32-bit FNV-1a hash - turns an arbitrary string into a stable numeric seed, so
// the same input string always resolves to the same seed for createSeededRandom.
export const resolveStringHash = (value: string): number => {
  let hash = 0x811c9dc5;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
};

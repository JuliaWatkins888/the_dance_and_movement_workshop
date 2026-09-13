import type { AvatarDicebearSource } from '../tokens/avatar';

const DICEBEAR_BASE_URL = 'https://api.dicebear.com/9.x';

// Pure URL construction only - no fetching. DiceBear serves each generated avatar straight
// from this URL, so Avatar just points an <img> at it (see components/Avatar/Avatar.tsx).
export const resolveDicebearUrl = (source: Pick<AvatarDicebearSource, 'style' | 'seed' | 'options'>): string => {
  const params = new URLSearchParams({ seed: source.seed });
  Object.entries(source.options ?? {}).forEach(([key, value]) => params.set(key, String(value)));

  return `${DICEBEAR_BASE_URL}/${source.style}/svg?${params.toString()}`;
};

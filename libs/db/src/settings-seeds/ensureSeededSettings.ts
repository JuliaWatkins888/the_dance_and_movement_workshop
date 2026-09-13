import { settingSeeds } from './registry';
import { getSetting, upsertSetting } from '../index';

// Called once at API startup (apps/api/src/main.ts, right after ensureSeededPages), same
// "run on every boot" precedent - a plugin's newly added settings-seeds/registry.ts entry
// reaches a running deployment the same way any other code change does. Idempotent and
// non-destructive - a key that already has a stored value (whether from a previous seed run or
// an admin's own edit) is left alone, never overwritten.
export const ensureSeededSettings = async (): Promise<void> => {
  for (const seed of settingSeeds) {
    const existing = await getSetting(seed.key);
    if (existing) continue;

    await upsertSetting(seed);
    console.log(`Seeded setting "${seed.key}"`);
  }
};

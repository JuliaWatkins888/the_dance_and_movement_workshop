import { pageSeeds } from './registry';
import { createPage, findPageBySlug } from '../index';

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === 11000;

// Called once at API startup (apps/api/src/main.ts, right after connectDatabase). Runs on every
// boot, which is exactly what makes this safe under a Render-style deploy: a plugin's newly
// added page-seeds/registry.ts entries reach a running deployment the same way any other code
// change does (git push -> redeploy -> this runs again against the persistent MongoDB), with no
// need for CLI/filesystem access against the live instance itself. Idempotent and
// non-destructive - a page already present (by slug) is left alone, never updated.
export const ensureSeededPages = async (): Promise<void> => {
  for (const seed of pageSeeds) {
    const existing = await findPageBySlug(seed.slug);
    if (existing) continue;

    try {
      await createPage(seed);
      console.log(`Seeded page "${seed.slug}" (${seed.routePattern})`);
    } catch (error) {
      // A rolling deploy can briefly run the previous and new instance side by side - both can
      // see this page as missing and race to create it. The unique index on slug/routePattern is
      // the real safeguard against a duplicate; losing that race here is expected, not a
      // failure, so it's swallowed rather than crashing this instance's startup.
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
    }
  }
};

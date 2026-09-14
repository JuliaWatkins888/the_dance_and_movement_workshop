import { policySeeds } from './registry';
import { createPolicyCategory, createPolicyItem, listPolicyCategories } from '../index';

// Called once at API startup (apps/api/src/main.ts), alongside ensureSeededPages/
// ensureSeededSettings. Simpler than either of those: there's exactly one seed source (see
// registry.ts) and no plugin-merge concern, so this doesn't need their per-key reconcile loop -
// it only ever needs to run once, on a brand-new database. If any category already exists
// (whether from a previous run of this seed, or an admin who has since added their own policy
// content), the whole collection is left alone - this never re-seeds or overwrites.
export const ensureSeededPolicies = async (): Promise<void> => {
  const existing = await listPolicyCategories();
  if (existing.length > 0) return;

  for (const seed of policySeeds) {
    const category = await createPolicyCategory({ title: seed.title, icon: seed.icon, order: seed.order });
    for (const item of seed.items) {
      await createPolicyItem(category.id, item);
    }
  }
  console.log(`Seeded ${policySeeds.length} policy categories`);
};

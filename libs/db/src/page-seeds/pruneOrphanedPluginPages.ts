import { pageSeeds } from './registry';
import { findPluginPages, deletePage, updatePage } from '../index';

// Called once at API startup (apps/api/src/main.ts, right after ensureSeededPages) - the other
// direction of that function's reconciliation. ensureSeededPages only ever adds a missing page;
// nothing removes one when the plugin that seeded it is later uninstalled, so its page would
// otherwise linger forever - still published, still showing up in the nav - pointing at a route
// no installed plugin renders anymore.
//
// Deliberately conservative about *how* it removes one: a page whose updatedAt still equals its
// createdAt has never been touched since the seed created it, so deleting it outright is exactly
// "as if this plugin had never been installed". A page an admin has since edited (updatedAt
// advanced past createdAt) is left in the database and only unpublished - unpublished is enough
// to drop it from the nav (see page.repository.ts's own findByNavLocation), but never silently
// destroys real admin work. Re-installing the plugin later doesn't resurrect either case
// automatically - ensureSeededPages only fills in a slug that's missing entirely, so an
// unpublished page an admin edited is exactly the record they'll find waiting in the CMS.
export const pruneOrphanedPluginPages = async (): Promise<void> => {
  const registeredPluginOrigins = new Set(
    pageSeeds.filter((seed) => seed.isPluginPage && seed.pluginOrigin).map((seed) => seed.pluginOrigin as string)
  );

  const pluginPages = await findPluginPages();

  for (const page of pluginPages) {
    if (!page.pluginOrigin || registeredPluginOrigins.has(page.pluginOrigin)) continue;

    const wasNeverEdited = page.updatedAt.getTime() === page.createdAt.getTime();
    if (wasNeverEdited) {
      await deletePage(page.id);
      console.log(`Removed orphaned plugin page "${page.slug}" (plugin "${page.pluginOrigin}" no longer installed)`);
    } else if (page.isPublished) {
      await updatePage(page.id, { isPublished: false });
      console.log(
        `Unpublished orphaned plugin page "${page.slug}" (plugin "${page.pluginOrigin}" no longer installed, but this page has admin edits - left in place for review)`
      );
    }
  }
};

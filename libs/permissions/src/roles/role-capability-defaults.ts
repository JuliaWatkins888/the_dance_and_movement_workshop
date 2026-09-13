import type { Role } from '@inithium/db';

// Each plugin contributes its own capability keys to whichever role tier(s) make sense via a
// merge-strategy injection anchored at the end of that role's array - a capability key sitting
// unused here is inert (nothing ever checks it unless the plugin owning its routes is actually
// installed), so listing a key for an absent plugin never risks anything; the anchors exist
// purely so multiple plugins can append to the same role's array without clobbering each other.
export const ROLE_CAPABILITY_DEFAULTS: Record<Role, readonly string[]> = {
  user: [],
  contributor: [
// inithium:block:gallery:contributor:start
  'gallery:manage',
// inithium:block:gallery:contributor:end
// inithium:block:staff:contributor:start
  'staff:manage',
// inithium:block:staff:contributor:end
// inithium:block:time:contributor:start
  'time:track',
// inithium:block:time:contributor:end
    // inithium:anchor:contributor
  ],
  editor: [
// inithium:block:cms:editor:start
  'pages:manage',
// inithium:block:cms:editor:end
// inithium:block:gallery:editor:start
  'gallery:manage',
// inithium:block:gallery:editor:end
// inithium:block:contact:editor:start
  'contact:manageThreads',
// inithium:block:contact:editor:end
// inithium:block:staff:editor:start
  'staff:manage',
// inithium:block:staff:editor:end
// inithium:block:time:editor:start
  'time:track',
// inithium:block:time:editor:end
    // inithium:anchor:editor
  ],
  // users:managePermissions is deliberately absent even from admin - granting the ability to
  // edit *other users'* capability grants is a different trust tier than any content/admin
  // capability, so it's owner-granted-only by default (see libs/permissions/src/index.ts's
  // requireOwner and the Permissions module's own gating).
  admin: [
// inithium:block:cms:admin:start
  'users:manage',
  'settings:manage',
  'pages:manage',
// inithium:block:cms:admin:end
// inithium:block:gallery:admin:start
  'gallery:manage',
// inithium:block:gallery:admin:end
// inithium:block:contact:admin:start
  'contact:manageThreads',
// inithium:block:contact:admin:end
// inithium:block:staff:admin:start
  'staff:manage',
// inithium:block:staff:admin:end
// inithium:block:time:admin:start
  'time:track',
  'time:manage',
// inithium:block:time:admin:end
    // inithium:anchor:admin
  ],
};

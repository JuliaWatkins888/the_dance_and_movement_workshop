import type { UserEntity } from '@inithium/db';
import type { AuthTokenPayload } from '@inithium/auth';

declare global {
  namespace Express {
    interface Request {
      // Re-declares @inithium/auth's own Request.user augmentation - a type-only import (erased
      // at compile time, zero runtime dependency on @inithium/auth) so this package's own
      // compilation unit knows req.user's shape without pulling that package's global
      // augmentation file into the program graph. req.user is always actually set at runtime by
      // requireAuth, which every route composes before requirePermission/requireOwner.
      user?: AuthTokenPayload;
      // Set by requirePermission after its own DB re-fetch, so downstream handlers that also
      // need the full user (blog.route.ts's comment handler, contact.route.ts's thread routes,
      // storage.route.ts's asset delete) can reuse it instead of a second findById call.
      permissionUser?: UserEntity;
    }
  }
}

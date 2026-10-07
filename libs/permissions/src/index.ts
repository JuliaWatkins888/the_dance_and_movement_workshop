import type { Request, Response, NextFunction } from 'express';
import './types/express';
import { getUserRepository } from '@inithium/db';
import type { AuthTokenPayload } from '@inithium/auth';
import { hasCapability } from './resolveEffectiveCapabilities';

// Response style deliberately matches @inithium/auth's requireRole (plain res.status(...).json)
// rather than @inithium/api-utils's AppError/asyncHandler - keeps this package as
// dependency-light as @inithium/auth, and routes already compose requireAuth then
// requirePermission as two separate middlewares in sequence, the same two-step shape
// `requireAuth, requireRole(...)` already used.
export const requirePermission =
  (capability: string) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }
    try {
      const user = await getUserRepository().findById(req.user.sub);
      if (!user) {
        res.status(401).json({ error: 'User not found' });
        return;
      }
      req.permissionUser = user;
      if (!hasCapability(user, capability)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };

// Ownership can't be delegated via a capability - only the current owner may transfer it (see
// users.route.ts's POST /api/users/:id/transfer-ownership).
export const requireOwner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  try {
    const user = await getUserRepository().findById(req.user.sub);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    req.permissionUser = user;
    if (!user.isOwner) {
      res.status(403).json({ error: 'Owner only' });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};

// Registered with @inithium/auth's setSessionValidator by the API host. Rejects tokens for deleted
// accounts or ones issued before the account's last revokeSessions, and refreshes the payload's
// role/email so nothing downstream acts on claims that changed since the token was signed.
export const resolveSession = async (payload: AuthTokenPayload): Promise<AuthTokenPayload | null> => {
  const user = await getUserRepository().findById(payload.sub);
  if (!user || (payload.ver ?? 0) !== user.tokenVersion) return null;
  return { sub: user.id, email: user.email, role: user.role, ver: user.tokenVersion };
};

export { resolveEffectiveCapabilities, hasCapability } from './resolveEffectiveCapabilities';
export { canManageUser, canAssignRole } from './delegation';
export { ROLE_CAPABILITY_DEFAULTS } from './roles/role-capability-defaults';

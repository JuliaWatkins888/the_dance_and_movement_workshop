import type { NextFunction, Request, Response } from 'express';
import { hasCapability } from '@inithium/permissions';
import { getUserRepository } from '@inithium/db';
import type { UserEntity } from '@inithium/db';

// requirePermission (@inithium/permissions) only checks a single capability. The entry-types
// list and settings-GET routes need to accept either time:track or time:manage, and
// libs/permissions/src/index.ts has no inithium:anchor a plugin could merge a new export into -
// so this is a self-contained equivalent built on that package's own already-exported
// hasCapability/getUserRepository, matching requirePermission's exact response shape and
// req.permissionUser side effect.
export const requireAnyCapability =
  (...capabilities: string[]) =>
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
      if (!capabilities.some((capability) => hasCapability(user, capability))) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };

const EMPLOYEE_ROLES = ['contributor', 'editor', 'admin'];

// Who counts as "an employee" for this plugin - a plain 'user'-role account is never one,
// regardless of any capability override, since capabilities are only ever granted to the three
// employee-eligible roles by role-capability-defaults.fragment.ts.
export const isEmployee = (user: UserEntity): boolean => user.isOwner || EMPLOYEE_ROLES.includes(user.role);

// The one place the admin/owner hierarchy rule for time:manage actions lives (see this plugin's
// plan doc §4 for why this is a shared helper rather than inlined per-route): ~9 different
// endpoints need the identical check, so one canonical implementation for a security-critical
// rule beats nine copies that could quietly drift. Mirrors users.route.ts's own style of baking
// ownership/self-action rules directly into business logic rather than inventing a new
// capability tier for every nuance.
export const canActOnEmployee = (actor: UserEntity, target: UserEntity): boolean => {
  if (actor.isOwner) return true;
  if (actor.role !== 'admin') return false;
  if (target.isOwner || target.role === 'admin' || target.id === actor.id) return false;
  return target.role === 'contributor' || target.role === 'editor';
};

// Every timestamp this plugin ever writes is rounded to the nearest minute - avoids stray
// per-second noise on clock-in/out taps without pretending to a rounding precision (nearest 5 or
// 15 minutes) nobody asked for.
export const roundToNearestMinute = (date: Date): Date => new Date(Math.round(date.getTime() / 60_000) * 60_000);

export const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

// Intl.supportedValuesOf is ES2022+, ahead of this workspace's configured tsconfig `lib` target
// (es2020 - confirmed via tsconfig.base.json). A `declare global` ambient .d.ts doesn't reliably
// fix this everywhere: apps/api's webpack build compiles through its own ts-loader program,
// which doesn't pick up an ambient declaration scoped to a different project's own tsconfig
// (only `libs/api-core`'s isolated `tsc --noEmit` run saw it). Casting at this one call site
// works uniformly across every program that imports it. Runtime support is universal
// (Node 20+) regardless of the configured lib.
export const getSupportedTimeZones = (): string[] =>
  (Intl as unknown as { supportedValuesOf: (input: string) => string[] }).supportedValuesOf('timeZone');

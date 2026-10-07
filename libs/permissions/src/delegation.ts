import type { CapabilityOverrides, Role } from '@inithium/db';
import { resolveEffectiveCapabilities } from './resolveEffectiveCapabilities';

interface CapabilityHolder {
  role: Role;
  isOwner: boolean;
  capabilityOverrides: CapabilityOverrides;
}

const isSubset = (candidate: readonly string[], of: readonly string[]): boolean => {
  const allowed = new Set(of);
  return candidate.every((capability) => allowed.has(capability));
};

// A non-owner may only manage (edit, reset the password of, delete) an account whose effective
// capabilities they already hold themselves - otherwise a users:manage delegate could reset a
// more-privileged account's password and sign in as it.
export const canManageUser = (actor: CapabilityHolder, target: CapabilityHolder): boolean => {
  if (actor.isOwner) return true;
  if (target.isOwner) return false;
  return isSubset(
    resolveEffectiveCapabilities(target.role, target.capabilityOverrides),
    resolveEffectiveCapabilities(actor.role, actor.capabilityOverrides),
  );
};

// Same rule for handing out a role: a non-owner can't create or promote an account into a
// capability set larger than their own.
export const canAssignRole = (actor: CapabilityHolder, role: Role, targetOverrides: CapabilityOverrides = {}): boolean =>
  actor.isOwner ||
  isSubset(
    resolveEffectiveCapabilities(role, targetOverrides),
    resolveEffectiveCapabilities(actor.role, actor.capabilityOverrides),
  );

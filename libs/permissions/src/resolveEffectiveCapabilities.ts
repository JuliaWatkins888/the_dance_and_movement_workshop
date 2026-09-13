import type { CapabilityOverrides, Role } from '@inithium/db';
import { ROLE_CAPABILITY_DEFAULTS } from './roles/role-capability-defaults';

// A user's effective capability set is their role's default bundle with explicit per-key
// overrides layered on top - an absent key means "use the role default", true/false
// force-grants/force-revokes regardless of what the role would otherwise imply.
export const resolveEffectiveCapabilities = (role: Role, capabilityOverrides: CapabilityOverrides): string[] => {
  const effective = new Set(ROLE_CAPABILITY_DEFAULTS[role] ?? []);
  for (const [key, granted] of Object.entries(capabilityOverrides)) {
    if (granted) effective.add(key);
    else effective.delete(key);
  }
  return [...effective];
};

export const hasCapability = (
  user: { role: Role; isOwner: boolean; capabilityOverrides: CapabilityOverrides },
  capability: string
): boolean => user.isOwner || resolveEffectiveCapabilities(user.role, user.capabilityOverrides).includes(capability);

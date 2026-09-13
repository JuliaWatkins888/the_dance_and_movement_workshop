import { useState } from 'react';
import { Box, Button, Select, SelectItem, Switch, Text } from '@inithium/ui';
import { useUpdateUserMutation, useUpdateUserPermissionsMutation } from '@inithium/api-client';
import type { AdminUser } from '@inithium/api-client';
import { capabilityDefinitions } from '../../permissions/definitions/registry';

// Hardcoded local mirror of @inithium/db's CORE_ROLES - same precedent as UserFormDialog's own
// mirror and PageEditDialog's NAV_LOCATIONS/PAGE_LAYOUT_TEMPLATES.
const CORE_ROLES = ['user', 'contributor', 'editor', 'admin'] as const;
type CoreRole = (typeof CORE_ROLES)[number];
const ROLE_LABELS: Record<CoreRole, string> = {
  user: 'User',
  contributor: 'Contributor',
  editor: 'Editor',
  admin: 'Admin',
};

const UNGROUPED = 'General';

export interface PermissionsEditDialogProps {
  readonly user: AdminUser;
  readonly onDone: () => void;
}

// Edits both a user's role (a bulk-convenience default-capability template) and their individual
// capability overrides (explicit grants/revokes layered on top) in one dialog, submitted as two
// separate requests against two separately-gated routes - PATCH /api/users/:id (users:manage)
// for role, PATCH /api/users/:id/permissions (users:managePermissions) for overrides - since
// they're different trust tiers server-side.
export const PermissionsEditDialog = ({ user, onDone }: PermissionsEditDialogProps) => {
  const [updateUser, { isLoading: isSavingRole }] = useUpdateUserMutation();
  const [updateUserPermissions, { isLoading: isSavingOverrides }] = useUpdateUserPermissionsMutation();
  const isSubmitting = isSavingRole || isSavingOverrides;

  const [role, setRole] = useState<CoreRole>(user.role as CoreRole);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({ ...user.capabilityOverrides });
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const groups = new Map<string, typeof capabilityDefinitions>();
  for (const definition of capabilityDefinitions) {
    const group = definition.group ?? UNGROUPED;
    const existing = groups.get(group) ?? [];
    existing.push(definition);
    groups.set(group, existing);
  }

  const setOverride = (key: string, granted: boolean) => setOverrides((prev) => ({ ...prev, [key]: granted }));
  const clearOverride = (key: string) =>
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const handleSubmit = async () => {
    setSubmitError(undefined);
    try {
      if (role !== user.role) {
        await updateUser({ id: user.id, role }).unwrap();
      }
      if (JSON.stringify(overrides) !== JSON.stringify(user.capabilityOverrides)) {
        await updateUserPermissions({ id: user.id, capabilityOverrides: overrides }).unwrap();
      }
      onDone();
    } catch {
      setSubmitError('Could not save permissions. Check the fields and try again.');
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Select
        label="Role"
        value={role}
        onValueChange={(value) => setRole(value as CoreRole)}
        disabled={user.isOwner}
        helperText={user.isOwner ? "The owner's role can't be changed here." : undefined}
      >
        {CORE_ROLES.map((coreRole) => (
          <SelectItem key={coreRole} value={coreRole}>
            {ROLE_LABELS[coreRole]}
          </SelectItem>
        ))}
      </Select>

      {user.isOwner ? (
        <Text as="p" className="text-sm text-surface-500">
          The owner bypasses every capability check unconditionally - individual grants below have
          no effect on this account.
        </Text>
      ) : (
        <Box flex={{ direction: 'col', gap: 20 }}>
          {[...groups.entries()].map(([group, definitions]) => (
            <Box key={group} flex={{ direction: 'col', gap: 8 }}>
              <Text as="h2" className="text-sm font-semibold text-surface-700">
                {group}
              </Text>
              <Box
                flex={{ direction: 'col' }}
                borderColor={{ color: 'surface', intensity: 200 }}
                className="rounded border"
              >
                {definitions.map((definition) => {
                  const roleDefault = definition.defaultRoles?.includes(role) ?? false;
                  const override = overrides[definition.key];
                  const effective = override ?? roleDefault;
                  return (
                    <Box
                      key={definition.key}
                      flex={{ direction: 'row', justify: 'between', align: 'center', gap: 12 }}
                      padding={{ base: 12 }}
                      borderColor={{ color: 'surface', intensity: 200 }}
                      className="border-b last:border-b-0"
                    >
                      <Box flex={{ direction: 'col' }}>
                        <Text as="span" className="text-sm font-medium text-surface-950">
                          {definition.label}
                        </Text>
                        {definition.description ? (
                          <Text as="span" className="text-xs text-surface-500">
                            {definition.description}
                          </Text>
                        ) : null}
                        <Text as="span" className="text-xs text-surface-400">
                          {override !== undefined
                            ? `Overridden (role default: ${roleDefault ? 'granted' : 'revoked'})`
                            : `Role default: ${roleDefault ? 'granted' : 'revoked'}`}
                        </Text>
                      </Box>
                      <Box flex={{ direction: 'row', align: 'center', gap: 8 }}>
                        {override !== undefined ? (
                          <Button
                            variant={{ kind: 'ghost', color: 'surface' }}
                            className="text-xs"
                            onClick={() => clearOverride(definition.key)}
                          >
                            Reset
                          </Button>
                        ) : null}
                        <Switch checked={effective} onCheckedChange={(checked) => setOverride(definition.key, checked)} />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {submitError ? (
        <Text as="p" className="text-sm text-red-600">
          {submitError}
        </Text>
      ) : null}

      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onDone} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save Changes'}
        </Button>
      </Box>
    </Box>
  );
};

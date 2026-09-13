import { Box, Text } from '@inithium/ui';
import { useListSettingsQuery } from '@inithium/api-client';
import { settingDefinitions } from '../../settings/definitions/registry';
import { SettingRow } from './SettingRow';

const UNGROUPED = 'General';

// The Mongo collection only ever holds settings that have actually been changed at least once -
// no upsert-on-read, no "ensure every known default exists" step. This module is what performs
// the merge: known definition + no stored doc -> show the definition's default, unsaved; known
// definition + stored doc -> show the stored value. A future plugin's own backend code does the
// same merge via @inithium/db's getSetting(key), falling back to its own default on null.
export const SettingsModule = () => {
  const { data: stored, isLoading } = useListSettingsQuery();

  if (isLoading) {
    return (
      <Box padding={{ base: 24 }}>
        <Text as="p" className="text-surface-500">
          Loading settings...
        </Text>
      </Box>
    );
  }

  const storedByKey = new Map((stored ?? []).map((setting) => [setting.key, setting]));

  const groups = new Map<string, typeof settingDefinitions>();
  for (const definition of settingDefinitions) {
    const group = definition.group ?? UNGROUPED;
    const existing = groups.get(group) ?? [];
    existing.push(definition);
    groups.set(group, existing);
  }

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 24 }}>
      <Text textColor={{ color: 'surface', intensity: 950 }} as="h1" className="text-2xl font-bold">
        Settings
      </Text>

      {groups.size === 0 ? (
        <Text as="p" className="text-surface-500">
          No settings are registered yet.
        </Text>
      ) : (
        [...groups.entries()].map(([group, definitions]) => (
          <Box key={group} flex={{ direction: 'col', gap: 8 }}>
            <Text as="h2" className="text-lg font-semibold text-surface-700">
              {group}
            </Text>
            <Box flex={{ direction: 'col' }} borderColor={{ color: 'surface', intensity: 400 }} className="rounded border">
              {definitions.map((definition) => (
                <SettingRow key={definition.key} definition={definition} stored={storedByKey.get(definition.key)} />
              ))}
            </Box>
          </Box>
        ))
      )}
    </Box>
  );
};

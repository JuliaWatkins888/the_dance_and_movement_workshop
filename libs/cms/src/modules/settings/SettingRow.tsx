import { useState } from 'react';
import { Box, Button, IconButton, Input, ListRow, Switch, Text, Textarea, HEX_COLOR_PATTERN } from '@inithium/ui';
import { useUpsertSettingMutation } from '@inithium/api-client';
import type { SettingEntity, UpsertSettingInput } from '@inithium/api-client';
import type { SettingDefinition } from '../../settings/definitions/registry';

export interface SettingRowProps {
  readonly definition: SettingDefinition;
  readonly stored?: SettingEntity;
}

const resolveInitialValue = (definition: SettingDefinition, stored?: SettingEntity): unknown =>
  stored && stored.type === definition.type ? stored.value : definition.default;

interface StringListEditorProps {
  readonly value: string[];
  readonly onChange: (next: string[]) => void;
}

// AutoIncrementingList (libs/ui) manages add/remove of opaque id slots but exposes no way to
// read back the actual values - not usable here without fighting it, so this is a small direct
// list editor instead. Index-as-key is safe: every row is a fully controlled Input with no
// per-item internal state, and there's no reordering, only add/remove-by-index.
const StringListEditor = ({ value, onChange }: StringListEditorProps) => {
  const updateItem = (index: number, next: string) => {
    const copy = [...value];
    copy[index] = next;
    onChange(copy);
  };
  const removeItem = (index: number) => onChange(value.filter((_, i) => i !== index));
  const addItem = () => onChange([...value, '']);

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      {value.map((item, index) => (
        <Box key={index} flex={{ direction: 'row', gap: 8, align: 'end' }}>
          <Input value={item} onChange={(event) => updateItem(index, event.target.value)} className="flex-1" />
          <IconButton icon="Trash" label="Remove item" onClick={() => removeItem(index)} />
        </Box>
      ))}
      <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={addItem}>
        Add Item
      </Button>
    </Box>
  );
};

// One row per registered setting. Every hook is called unconditionally up top; the switch below
// only ever controls what gets rendered, never which hooks run.
export const SettingRow = ({ definition, stored }: SettingRowProps) => {
  const [upsertSetting, { isLoading }] = useUpsertSettingMutation();
  const [draft, setDraft] = useState<unknown>(() => resolveInitialValue(definition, stored));
  const [jsonError, setJsonError] = useState<string | undefined>(undefined);
  // Raw text buffer for the json editor, separate from `draft` (last successfully parsed
  // value) - lets an admin type invalid-but-in-progress JSON without losing their place.
  const [jsonText, setJsonText] = useState(() =>
    definition.type === 'json' ? JSON.stringify(resolveInitialValue(definition, stored), null, 2) : '',
  );

  const save = async (value: unknown) => {
    // Cross-field validity (value's shape matches definition.type) is guaranteed by how each
    // case below constructs `value` - this cast reflects that, not a skipped check.
    const input = { key: definition.key, type: definition.type, value } as UpsertSettingInput;
    await upsertSetting(input).unwrap();
  };

  const handleSaveJson = async () => {
    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      setJsonError(undefined);
      setDraft(parsed);
      await save(parsed);
    } catch {
      setJsonError('Invalid JSON.');
    }
  };

  const renderControl = () => {
    switch (definition.type) {
      case 'boolean':
        return (
          <Switch
            checked={draft as boolean}
            onCheckedChange={(checked) => {
              setDraft(checked);
              save(checked);
            }}
          />
        );
      case 'string':
        return (
          <Input value={draft as string} onChange={(event) => setDraft(event.target.value)} className="max-w-full" />
        );
      case 'number':
        return (
          <Input
            type="number"
            value={draft as number}
            onChange={(event) => setDraft(Number(event.target.value))}
            className="max-w-full"
          />
        );
      case 'date':
        return (
          <Input
            type="date"
            value={draft as string}
            onChange={(event) => setDraft(event.target.value)}
            className="max-w-full"
          />
        );
      case 'stringList':
        return <StringListEditor value={draft as string[]} onChange={setDraft} />;
      case 'color': {
        const hexValue = draft as string;
        const trimmed = hexValue.trim();
        const isValidHex = HEX_COLOR_PATTERN.test(trimmed);
        return (
          <Box flex={{ direction: 'row', gap: 8, align: 'center' }}>
            <Box
              style={{ backgroundColor: isValidHex ? trimmed : undefined }}
              bgColor={isValidHex ? undefined : { color: 'surface', intensity: 200 }}
              borderColor={{ color: 'surface', intensity: 300 }}
              className="h-10 w-10 shrink-0 rounded border"
            />
            <Input
              value={hexValue}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="#000000"
              error={trimmed.length > 0 && !isValidHex}
              helperText={trimmed.length > 0 && !isValidHex ? 'Enter a valid hex color, e.g. #006a8e.' : undefined}
              className="max-w-40"
            />
          </Box>
        );
      }
      case 'json':
        return (
          <Textarea
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            error={Boolean(jsonError)}
            helperText={jsonError}
            rows={6}
            className="max-w-full font-mono text-sm"
          />
        );
    }
  };

  const needsExplicitSave = definition.type !== 'boolean';
  const isColorInvalid = definition.type === 'color' && !HEX_COLOR_PATTERN.test((draft as string).trim());

  return (
    <ListRow
      trailing={
        needsExplicitSave ? (
          <Button
            variant={{ kind: 'filled', color: 'primary' }}
            disabled={isLoading || isColorInvalid}
            onClick={definition.type === 'json' ? handleSaveJson : () => save(draft)}
          >
            {isLoading ? 'Saving…' : 'Save'}
          </Button>
        ) : null
      }
    >
      <Text as="span" className="font-medium text-surface-950">
        {definition.label}
      </Text>
      {definition.description ? (
        <Text as="span" className="text-sm text-surface-500">
          {definition.description}
        </Text>
      ) : null}
      <Box padding={{ top: 8 }}>{renderControl()}</Box>
    </ListRow>
  );
};

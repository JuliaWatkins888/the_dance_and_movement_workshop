export interface SettingDefinitionBase {
  key: string;
  label: string;
  description?: string;
  group?: string;
  order?: number;
}

// A definition is pure data - key/type/default/label - never a component, unlike CmsModule or
// DashboardWidget. That's why this glob targets *.setting.ts, not *.setting.tsx.
export type SettingDefinition =
  | (SettingDefinitionBase & { type: 'string'; default: string })
  | (SettingDefinitionBase & { type: 'boolean'; default: boolean })
  | (SettingDefinitionBase & { type: 'number'; default: number })
  | (SettingDefinitionBase & { type: 'date'; default: string })
  | (SettingDefinitionBase & { type: 'stringList'; default: string[] })
  | (SettingDefinitionBase & { type: 'json'; default: Record<string, unknown> })
  | (SettingDefinitionBase & { type: 'color'; default: string });

// Every plugin that wants to push a new setting (a future blog plugin's "allow comments"
// toggle, etc.) drops its own uniquely-named *.setting.ts file here, default-exporting a
// SettingDefinition - the same zero-shared-file-edit convention modules/registry.ts and
// dashboard/widgets/registry.ts already established, just scoped to app configuration instead
// of nav entries or dashboard widgets.
const definitionFiles = import.meta.glob<SettingDefinition>('./*.setting.ts', { eager: true, import: 'default' });

export const settingDefinitions: SettingDefinition[] = Object.values(definitionFiles).sort(
  (a, b) => (a.order ?? 0) - (b.order ?? 0),
);

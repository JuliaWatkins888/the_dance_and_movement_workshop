export const SETTING_TYPES = ['string', 'boolean', 'number', 'date', 'stringList', 'json', 'color'] as const;
export type SettingType = (typeof SETTING_TYPES)[number];

interface SettingBase {
  id: string;
  key: string;
  updatedAt: Date;
}

// A real discriminated union on `type`, not `value: unknown` - lets both the API layer's Zod
// validation and any consumer's TypeScript narrowing treat `value`'s shape as determined by
// `type`, rather than everyone re-deriving that relationship by hand at every call site.
export type SettingEntity =
  | (SettingBase & { type: 'string'; value: string })
  | (SettingBase & { type: 'boolean'; value: boolean })
  | (SettingBase & { type: 'number'; value: number })
  | (SettingBase & { type: 'date'; value: string })
  | (SettingBase & { type: 'stringList'; value: string[] })
  | (SettingBase & { type: 'json'; value: Record<string, unknown> })
  | (SettingBase & { type: 'color'; value: string });

export type UpsertSettingInput =
  | { key: string; type: 'string'; value: string }
  | { key: string; type: 'boolean'; value: boolean }
  | { key: string; type: 'number'; value: number }
  | { key: string; type: 'date'; value: string }
  | { key: string; type: 'stringList'; value: string[] }
  | { key: string; type: 'json'; value: Record<string, unknown> }
  | { key: string; type: 'color'; value: string };

export interface SettingsRepository {
  findAll: () => Promise<SettingEntity[]>;
  findByKey: (key: string) => Promise<SettingEntity | null>;
  upsert: (input: UpsertSettingInput) => Promise<SettingEntity>;
}

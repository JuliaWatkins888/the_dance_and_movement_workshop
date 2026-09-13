// A singleton document - see time-settings.schema.ts's hidden singletonKey field for the
// DB-level guarantee that only one of these can ever exist. Deliberately not layered on top of
// core's generic Setting key/value store (@inithium/db's getSetting/upsertSetting): that store's
// write route is gated on the unrelated settings:manage capability, which would force a
// time:manage actor to also hold general app-settings access just to configure the time plugin -
// this plugin owns its config end-to-end instead, matching its standalone (CMS-independent)
// requirement.
export interface TimeSettingsEntity {
  id: string;
  // IANA zone (e.g. "America/Chicago"), configured once by a time:manage actor and applied
  // uniformly to every display/aggregation/day-bucketing calculation regardless of where an
  // employee physically clocks in from. Entries themselves are always stored as UTC instants -
  // only display/bucketing ever uses this.
  timezone: string;
  // If an entry has been open longer than this, timeSweep.ts's lazy check auto-closes it.
  autoClockoutThresholdMinutes: number;
  updatedAt: Date;
}

export type UpdateTimeSettingsInput = Partial<Pick<TimeSettingsEntity, 'timezone' | 'autoClockoutThresholdMinutes'>>;

export interface TimeSettingsRepository {
  // Null until the first call to upsert - there is no apps/api/src/main.ts boot hook a plugin can
  // inject into (it has zero inithium:anchor markers), so this is never pre-seeded at startup.
  get: () => Promise<TimeSettingsEntity | null>;
  // Creates the singleton with defaults layered under `input` on the very first call, merges
  // `input` into the existing document on every call after that.
  upsert: (input: UpdateTimeSettingsInput) => Promise<TimeSettingsEntity>;
}

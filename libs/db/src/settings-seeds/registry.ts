import type { UpsertSettingInput } from '../contracts/settings.contract';
import appNameSettingSeed from './app-name.setting-seed';
import notificationsPersistentCenterSettingSeed from './notifications-persistent-center.setting-seed';
import profileEnabledSettingSeed from './profile-enabled.setting-seed';
import darkModeEnabledSettingSeed from './dark-mode-enabled.setting-seed';
import appearancePrimaryColorSettingSeed from './appearance-primary-color.setting-seed';
import appearanceSecondaryColorSettingSeed from './appearance-secondary-color.setting-seed';
import appearanceTertiaryColorSettingSeed from './appearance-tertiary-color.setting-seed';
import appearanceQuaternaryColorSettingSeed from './appearance-quaternary-color.setting-seed';
import appearanceAccentColorSettingSeed from './appearance-accent-color.setting-seed';
import appearanceSurfaceColorSettingSeed from './appearance-surface-color.setting-seed';
// inithium:anchor:imports

// Every setting a fresh project's settings collection should already hold a value for,
// reconciled once at API startup by ensureSeededSettings() - the exact same idempotent,
// seed-once-then-leave-admin-edits-alone pattern page-seeds/registry.ts already established for
// Page. Keyed by `key` at reconcile time: a key already present is left completely alone, even
// if its value has since been changed by an admin.
//
// Every entry here is a setting some core-baseline feature reads unconditionally (see
// libs/api-client/src/endpoints/settings.endpoints.ts's useAppName/useIsProfileEnabled/
// useIsDarkModeFeatureEnabled/useCustomBrandColors) - that's what makes it core's job to seed a
// real value rather than leaving the collection empty and relying on each hook's own in-code
// fallback. The cms plugin's settings/definitions/registry.ts independently declares the same
// keys with matching `default`s purely for its own admin-editing UI (what a still-unsaved field
// shows before an admin ever touches it) - the two lists must be kept in sync by hand, the same
// documented duplication page-seeds/registry.ts and apps/web/pageComponents.ts already accept.
//
// A plugin that wants its own setting seeded (rather than just registering an admin-editable
// definition) appends its own seed(s) here via a merge-strategy injection anchored below - there
// is no Vite-style import.meta.glob equivalent on the Node-run backend for zero-edit
// auto-discovery, so this stays an explicit list rather than a directory scan.
export const settingSeeds: UpsertSettingInput[] = [
  appNameSettingSeed,
  notificationsPersistentCenterSettingSeed,
  profileEnabledSettingSeed,
  darkModeEnabledSettingSeed,
  appearancePrimaryColorSettingSeed,
  appearanceSecondaryColorSettingSeed,
  appearanceTertiaryColorSettingSeed,
  appearanceQuaternaryColorSettingSeed,
  appearanceAccentColorSettingSeed,
  appearanceSurfaceColorSettingSeed,
  // inithium:anchor:seeds
];

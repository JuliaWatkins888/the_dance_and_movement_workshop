import { useGetTimeSettingsQuery, useUpdateTimeSettingsMutation } from '@inithium/api-client';
import { TimezoneCombobox } from './TimezoneCombobox';

// Populated from the native Intl.supportedValuesOf('timeZone') list - no timezone library needed
// (every evergreen browser ships full ICU).
//
// Cast rather than relying on a `declare global` ambient .d.ts - this workspace's tsconfig `lib`
// target (es2020) predates Intl.supportedValuesOf's TS types (ES2022+), and an ambient
// declaration scoped to this package doesn't reliably reach every build pipeline that might
// bundle it. Runtime support is universal regardless of the configured lib.
const TIME_ZONES = (Intl as unknown as { supportedValuesOf: (input: string) => string[] }).supportedValuesOf('timeZone');

export const TimezonePicker = () => {
  const { data: settings } = useGetTimeSettingsQuery();
  const [updateSettings] = useUpdateTimeSettingsMutation();

  return (
    <TimezoneCombobox
      label="Business Timezone"
      helperText="Applied to every display and calculation, regardless of where an employee physically clocks in from. Type to filter."
      value={settings?.timezone ?? 'America/New_York'}
      onChange={(timezone) => updateSettings({ timezone })}
      options={TIME_ZONES}
    />
  );
};

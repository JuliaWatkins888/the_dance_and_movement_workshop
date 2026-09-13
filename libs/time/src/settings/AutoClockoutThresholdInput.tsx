import { useState } from 'react';
import { Box, Button, Input, Text } from '@inithium/ui';
import { useGetTimeSettingsQuery, useUpdateTimeSettingsMutation } from '@inithium/api-client';

// Configures timeSweep.ts's lazy auto-clockout threshold - there is no cron/job runner in this
// codebase, so this value is only ever checked opportunistically on read (see this plugin's
// api-core/routes/time/timeSweep.ts), not on a schedule.
export const AutoClockoutThresholdInput = () => {
  const { data: settings } = useGetTimeSettingsQuery();
  const [updateSettings, { isLoading }] = useUpdateTimeSettingsMutation();
  const [draftHours, setDraftHours] = useState<string>('');

  const currentHours = Math.round((settings?.autoClockoutThresholdMinutes ?? 720) / 60);
  const displayValue = draftHours !== '' ? draftHours : String(currentHours);

  const handleSave = async () => {
    const hours = Number(displayValue);
    if (!Number.isFinite(hours) || hours <= 0) return;
    await updateSettings({ autoClockoutThresholdMinutes: Math.round(hours * 60) }).unwrap();
    setDraftHours('');
  };

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
        Auto Clock-Out
      </Text>
      <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
        If an employee forgets to clock out, they'll be automatically clocked out after this many hours.
      </Text>
      <Box flex={{ direction: 'row', gap: 8, align: 'end' }}>
        <Input
          label="Hours"
          type="number"
          min={1}
          max={24}
          value={displayValue}
          onChange={(event) => setDraftHours(event.target.value)}
          className="w-32"
        />
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSave} disabled={isLoading}>
          Save
        </Button>
      </Box>
    </Box>
  );
};

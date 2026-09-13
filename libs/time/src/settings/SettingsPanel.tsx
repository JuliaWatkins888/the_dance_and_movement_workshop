import { Box, Divider } from '@inithium/ui';
import { EntryTypesManager } from './EntryTypesManager';
import { TimezonePicker } from './TimezonePicker';
import { AutoClockoutThresholdInput } from './AutoClockoutThresholdInput';
import { ArchiveExportSection } from './ArchiveExportSection';

export const SettingsPanel = () => (
  <Box flex={{ direction: 'col', gap: 24 }} className="mx-auto max-w-2xl">
    <EntryTypesManager />
    <Divider />
    <TimezonePicker />
    <Divider />
    <AutoClockoutThresholdInput />
    <Divider />
    <ArchiveExportSection />
  </Box>
);

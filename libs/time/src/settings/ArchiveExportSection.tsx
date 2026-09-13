import { useState } from 'react';
import { Box, Button, Select, SelectItem, Text, alert, dialog } from '@inithium/ui';
import { useArchiveTimeYearMutation } from '@inithium/api-client';
import { downloadTimeExportCsv } from '../downloadTimeExportCsv';
import { useTimeCurrentUser } from '../TimeCurrentUserContext';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

// Archiving is destructive and hard to reverse, so it is a deliberate owner-triggered action
// (requireOwner-gated server-side, see time-settings.route.ts) rather than a silent scheduled
// deletion - this section deliberately pairs it tightly with the CSV export and a confirm step
// that names exporting first, per CLAUDE.md's "actions with care" guidance.
export const ArchiveExportSection = () => {
  const currentUser = useTimeCurrentUser();
  const [archiveYear, { isLoading: isArchiving }] = useArchiveTimeYearMutation();
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await downloadTimeExportCsv({ from: `${year}-01-01T00:00:00.000Z`, to: `${Number(year) + 1}-01-01T00:00:00.000Z` });
    } catch {
      alert.danger('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleArchive = async () => {
    const confirmed = await dialog.confirm({
      title: `Archive ${year}?`,
      description: `This permanently deletes every time entry from ${year}. Export a CSV backup first if you haven't already - this cannot be undone.`,
      confirmLabel: `Delete ${year} data`,
      cancelLabel: 'Cancel',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    try {
      const result = await archiveYear({ year: Number(year) }).unwrap();
      alert.success(`Deleted ${result.deletedCount} entries from ${year}.`);
    } catch {
      alert.danger('Could not archive this year. Please try again.');
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 12 }}>
      <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
        Export & Archive
      </Text>
      <Box flex={{ direction: 'row', gap: 8, align: 'end' }} className="flex-wrap">
        <Select label="Year" value={year} onValueChange={setYear} className="w-32">
          {YEAR_OPTIONS.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {option}
            </SelectItem>
          ))}
        </Select>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleExport} disabled={isExporting}>
          {isExporting ? 'Exporting…' : 'Export CSV'}
        </Button>
        {currentUser.isOwner ? (
          <Button variant={{ kind: 'filled', color: 'red' }} onClick={handleArchive} disabled={isArchiving}>
            {isArchiving ? 'Archiving…' : `Archive ${year}`}
          </Button>
        ) : null}
      </Box>
      {!currentUser.isOwner ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
          Only the owner can archive a year's data.
        </Text>
      ) : null}
    </Box>
  );
};

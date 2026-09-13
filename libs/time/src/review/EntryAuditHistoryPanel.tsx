import { Box, Divider, Text } from '@inithium/ui';
import { useGetTimeEntryAuditLogQuery } from '@inithium/api-client';
import { formatClockTime, formatZonedDate } from '../timeDateUtils';

export interface EntryAuditHistoryPanelProps {
  readonly entryId: string;
  readonly timeZone: string;
}

const ACTION_LABELS: Record<string, string> = {
  clock_in: 'Clocked in',
  clock_out: 'Clocked out',
  type_switch: 'Switched type',
  created: 'Created',
  updated: 'Edited',
  deleted: 'Deleted',
  locked: 'Locked',
  unlocked: 'Unlocked',
  auto_closed: 'Auto-closed (inactivity)',
};

// Surfaces the audit trail every state-changing action on this entry writes (see
// api-core/routes/time/time-clock.route.ts and time-admin.route.ts) - required per this plugin's
// requirements given it touches payroll-adjacent data admins can adjust/remove/backfill.
export const EntryAuditHistoryPanel = ({ entryId, timeZone }: EntryAuditHistoryPanelProps) => {
  const { data: logs = [], isLoading } = useGetTimeEntryAuditLogQuery(entryId);

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      <Divider />
      <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm font-medium">
        History
      </Text>
      {isLoading ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
          Loading…
        </Text>
      ) : logs.length === 0 ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
          No history yet.
        </Text>
      ) : (
        <Box flex={{ direction: 'col', gap: 4 }} className="max-h-40 overflow-y-auto">
          {logs.map((log) => (
            <Text key={log.id} as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-xs">
              {ACTION_LABELS[log.action] ?? log.action} · {formatZonedDate(log.createdAt, timeZone)}{' '}
              {formatClockTime(log.createdAt, timeZone)}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
};

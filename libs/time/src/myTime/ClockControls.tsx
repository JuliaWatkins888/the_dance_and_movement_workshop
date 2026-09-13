import { useEffect, useState } from 'react';
import { Box, Button, Card, Select, SelectItem, Text, alert } from '@inithium/ui';
import { useClockInMutation, useClockOutMutation, useSwitchTimeEntryTypeMutation } from '@inithium/api-client';
import type { TimeEntryDto, TimeEntryTypeDto } from '@inithium/api-client';
import { formatClockTime, formatDurationMinutes } from '../timeDateUtils';

export interface ClockControlsProps {
  readonly openEntry: TimeEntryDto | undefined;
  readonly types: TimeEntryTypeDto[];
  readonly timeZone: string;
}

// Ticks a re-render every 30s so the elapsed-time display keeps moving - purely cosmetic client
// state, never the source of truth for a duration (the server always recomputes from startAt/now
// at read time).
const useElapsedMinutes = (startAt: string | undefined): number => {
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!startAt) return undefined;
    const interval = setInterval(() => forceTick((tick) => tick + 1), 30_000);
    return () => clearInterval(interval);
  }, [startAt]);
  if (!startAt) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(startAt).getTime()) / 60_000));
};

// Employees only ever clock themselves in/out live - there is no way to hand-set a time here.
// Switching type while clocked in closes the current entry and opens a new one atomically
// server-side (see time-clock.route.ts's switch-type), never leaving a gap or overlap.
export const ClockControls = ({ openEntry, types, timeZone }: ClockControlsProps) => {
  const [clockIn, { isLoading: isClockingIn }] = useClockInMutation();
  const [clockOut, { isLoading: isClockingOut }] = useClockOutMutation();
  const [switchType, { isLoading: isSwitching }] = useSwitchTimeEntryTypeMutation();
  const [selectedTypeId, setSelectedTypeId] = useState<string | undefined>(undefined);

  const defaultTypeId = types[0]?.id;
  const elapsedMinutes = useElapsedMinutes(openEntry?.startAt);
  const isBusy = isClockingIn || isClockingOut || isSwitching;

  const handleClockIn = async () => {
    const typeId = selectedTypeId ?? defaultTypeId;
    if (!typeId) return;
    try {
      await clockIn({ typeId }).unwrap();
    } catch {
      alert.danger('Could not clock in. Please try again.');
    }
  };

  const handleClockOut = async () => {
    try {
      await clockOut().unwrap();
    } catch {
      alert.danger('Could not clock out. Please try again.');
    }
  };

  const handleSwitchType = async (typeId: string) => {
    try {
      await switchType({ typeId }).unwrap();
    } catch {
      alert.danger('Could not switch type. Please try again.');
    }
  };

  return (
    <Card padding={{ base: 24 }}>
      <Box flex={{ direction: 'col', gap: 16, align: 'center' }}>
      {openEntry ? (
        <>
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
            Clocked in since {formatClockTime(openEntry.startAt, timeZone)}
          </Text>
          <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-3xl font-bold tabular-nums">
            {formatDurationMinutes(elapsedMinutes)}
          </Text>

          <Select value={openEntry.typeId} onValueChange={handleSwitchType} disabled={isBusy} className="w-full max-w-xs">
            {types.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.label}
              </SelectItem>
            ))}
          </Select>

          <Button variant={{ kind: 'filled', color: 'red' }} onClick={handleClockOut} disabled={isBusy} className="w-full max-w-xs">
            {isClockingOut ? 'Clocking out…' : 'Clock Out'}
          </Button>
        </>
      ) : (
        <>
          <Select
            value={selectedTypeId ?? defaultTypeId}
            onValueChange={setSelectedTypeId}
            disabled={isBusy || types.length === 0}
            className="w-full max-w-xs"
          >
            {types.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.label}
              </SelectItem>
            ))}
          </Select>

          <Button
            variant={{ kind: 'filled', color: 'primary' }}
            onClick={handleClockIn}
            disabled={isBusy || types.length === 0}
            className="w-full max-w-xs"
          >
            {isClockingIn ? 'Clocking in…' : 'Clock In'}
          </Button>
        </>
      )}
      </Box>
    </Card>
  );
};

import { useState } from 'react';
import { Box, Select, SelectItem, Text } from '@inithium/ui';
import { useGetMyTimeEntriesQuery, useGetMyTimeSummaryQuery, useGetTimeEntryTypesQuery, useGetTimeSettingsQuery } from '@inithium/api-client';
import { ClockControls } from './ClockControls';
import { MyHistoryList } from './MyHistoryList';
import { TotalsByTypeSummary } from '../shared/TotalsByTypeSummary';
import { getMonthRangeUtc, getTodayRangeUtc, getWeekRangeUtc, getYearRangeUtc } from '../timeDateUtils';

type RangeWindow = 'today' | 'week' | 'month' | 'year';

const rangeForWindow = (rangeWindow: RangeWindow, timeZone: string) => {
  if (rangeWindow === 'today') return getTodayRangeUtc(timeZone);
  if (rangeWindow === 'month') return getMonthRangeUtc(timeZone);
  if (rangeWindow === 'year') return getYearRangeUtc(timeZone);
  return getWeekRangeUtc(timeZone);
};

export const MyTimePanel = () => {
  const { data: settings } = useGetTimeSettingsQuery();
  const { data: types = [] } = useGetTimeEntryTypesQuery();
  // Defaults to "week", not "today" - the open-entry indicator below is derived from whichever
  // range is currently fetched, and a week-wide window reliably still includes an overnight open
  // entry that started the previous day, where a "today"-only window could miss it.
  const [rangeWindow, setRangeWindow] = useState<RangeWindow>('week');

  const timeZone = settings?.timezone ?? 'America/New_York';
  const range = rangeForWindow(rangeWindow, timeZone);

  const { data: entries = [], isLoading: entriesLoading } = useGetMyTimeEntriesQuery(range, { skip: !settings });
  const { data: totals = [] } = useGetMyTimeSummaryQuery(range, { skip: !settings });

  const openEntry = entries.find((entry) => !entry.endAt);

  return (
    <Box flex={{ direction: 'col', gap: 24 }} className="mx-auto max-w-2xl">
      <ClockControls openEntry={openEntry} types={types} timeZone={timeZone} />

      <Box flex={{ direction: 'row', justify: 'between', align: 'center' }}>
        <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-semibold">
          My Hours
        </Text>
        <Select value={rangeWindow} onValueChange={(value) => setRangeWindow(value as RangeWindow)} className="w-36">
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="week">This Week</SelectItem>
          <SelectItem value="month">This Month</SelectItem>
          <SelectItem value="year">This Year</SelectItem>
        </Select>
      </Box>

      <TotalsByTypeSummary totals={totals} types={types} title="My Totals" />

      <MyHistoryList entries={entries} types={types} timeZone={timeZone} isLoading={entriesLoading} />
    </Box>
  );
};

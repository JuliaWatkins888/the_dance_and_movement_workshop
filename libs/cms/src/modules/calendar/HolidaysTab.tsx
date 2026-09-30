import { useState } from 'react';
import { Box, IconButton, Switch, Text, alert } from '@inithium/ui';
import { readApiError, useListHolidaysAdminQuery, useSetHolidayStudioOpenMutation } from '@inithium/api-client';
import type { HolidayDto } from '@inithium/api-client';
import { EmptyState } from '../ecommerce/shared';
import { ALERT_POSITION } from '../classes/classAdmin.shared';

// Holiday dates are "YYYY-MM-DD" - format in UTC so they never shift a day.
const holidayDateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

const HolidayRow = ({ holiday }: { readonly holiday: HolidayDto }) => {
  const [setStudioOpen, { isLoading }] = useSetHolidayStudioOpenMutation();

  const handleChange = async (isStudioClosed: boolean) => {
    try {
      await setStudioOpen({ date: holiday.date, isStudioOpen: !isStudioClosed }).unwrap();
    } catch (error) {
      alert.danger(readApiError(error, `Could not update ${holiday.name}.`).message, { position: ALERT_POSITION });
    }
  };

  return (
    <Box
      flex={{ direction: 'row', justify: 'between', align: 'center', gap: 12 }}
      borderColor={{ color: 'surface', intensity: 300 }}
      className="flex-wrap rounded-lg border p-4"
    >
      <Box flex={{ direction: 'col', gap: 2 }}>
        <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
          {holiday.name}
        </Text>
        <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
          {holidayDateFormatter.format(new Date(`${holiday.date}T00:00:00.000Z`))}
        </Text>
      </Box>
      <Switch label="Studio closed" checked={holiday.isStudioClosed} disabled={isLoading} onCheckedChange={handleChange} />
    </Box>
  );
};

export const HolidaysTab = () => {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const { data: holidays = [], isLoading } = useListHolidaysAdminQuery(year);

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="max-w-2xl text-sm">
        The studio is closed on every US federal holiday unless you open it here, which hides that day’s classes. Opening a
        holiday only applies to that year - the next one starts out closed again.
      </Text>
      <Box flex={{ direction: 'row', align: 'center', gap: 8 }}>
        <IconButton icon="CaretLeft" label="Previous year" onClick={() => setYear((current) => current - 1)} />
        <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="min-w-16 text-center text-lg font-bold">
          {year}
        </Text>
        <IconButton icon="CaretRight" label="Next year" onClick={() => setYear((current) => current + 1)} />
      </Box>
      {isLoading ? <EmptyState message="Loading holidays..." /> : null}
      <Box flex={{ direction: 'col', gap: 8 }}>
        {holidays.map((holiday) => (
          <HolidayRow key={holiday.date} holiday={holiday} />
        ))}
      </Box>
    </Box>
  );
};

import { Box, Select, SelectItem, Text } from '@inithium/ui';

export interface TimePickerProps {
  readonly label?: string;
  // Always a 24-hour "HH:mm" string in and out - this component only changes how the value is
  // *picked*, never its shape, so callers combine it with a date the same way they always have.
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
}

const HOURS_12 = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);

type Period = 'AM' | 'PM';

const to24Hour = (hour12: number, period: Period): number => {
  if (period === 'AM') return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
};

const from24Hour = (hour24: number): { hour12: number; period: Period } => {
  const period: Period = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, period };
};

// Three plain Selects (hour/minute/period) rather than a native <input type="time"> or a new
// third-party dependency - reuses only core @inithium/ui primitives (per this plugin's design
// preference) while still being a clear step up from typing raw numbers, and full 1-minute
// precision matters here since this feeds payroll-adjacent data.
export const TimePicker = ({ label, value, onChange, disabled }: TimePickerProps) => {
  const [hourPart, minutePart] = value ? value.split(':') : ['9', '0'];
  const parsedHour24 = Number(hourPart);
  const parsedMinute = Number(minutePart);
  const { hour12, period } = from24Hour(Number.isFinite(parsedHour24) ? parsedHour24 : 9);
  const minute = Number.isFinite(parsedMinute) ? parsedMinute : 0;

  const emit = (nextHour12: number, nextMinute: number, nextPeriod: Period) => {
    const hour24 = to24Hour(nextHour12, nextPeriod);
    onChange(`${String(hour24).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`);
  };

  return (
    <Box flex={{ direction: 'col', gap: 4 }}>
      {label ? (
        <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
          {label}
        </Text>
      ) : null}
      <Box flex={{ direction: 'row', gap: 8 }}>
        <Select value={String(hour12)} onValueChange={(next) => emit(Number(next), minute, period)} disabled={disabled} className="w-20">
          {HOURS_12.map((hour) => (
            <SelectItem key={hour} value={String(hour)}>
              {hour}
            </SelectItem>
          ))}
        </Select>
        <Select value={String(minute)} onValueChange={(next) => emit(hour12, Number(next), period)} disabled={disabled} className="w-20">
          {MINUTES.map((m) => (
            <SelectItem key={m} value={String(m)}>
              {String(m).padStart(2, '0')}
            </SelectItem>
          ))}
        </Select>
        <Select value={period} onValueChange={(next) => emit(hour12, minute, next as Period)} disabled={disabled} className="w-24">
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </Select>
      </Box>
    </Box>
  );
};

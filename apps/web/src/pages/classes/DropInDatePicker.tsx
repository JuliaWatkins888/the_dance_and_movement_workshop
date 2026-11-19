import { Loader, Text } from '@inithium/ui';
import { useListDropInDatesQuery } from '@inithium/api-client';
import { ChoiceCard } from './registrationChoices';
import { formatClassDate, formatOpenings } from './classFormat';

export interface DropInDatePickerProps {
  readonly sectionId: string;
  readonly selectedDate: string | undefined;
  readonly onSelect: (date: string) => void;
}

// The section's upcoming class dates (next six weeks) a drop-in can still be bought for.
export const DropInDatePicker = ({ sectionId, selectedDate, onSelect }: DropInDatePickerProps) => {
  const { data, isLoading, isError } = useListDropInDatesQuery({ sectionId });

  if (isLoading) return <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />;
  if (isError || !data) {
    return (
      <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
        Couldn’t load drop-in dates. Please try again.
      </Text>
    );
  }
  if (data.dates.length === 0) {
    return (
      <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
        No upcoming classes to drop in on in the next six weeks.
      </Text>
    );
  }

  return (
    <div role="radiogroup" aria-label="Drop-in date" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {data.dates.map(({ date, seatsLeft }) => (
        <ChoiceCard key={date} name="drop-in-date" value={date} checked={date === selectedDate} disabled={seatsLeft <= 0} onSelect={onSelect}>
          <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
            {formatClassDate(date)}
          </Text>
          <Text
            as="span"
            textColor={seatsLeft <= 0 ? { color: 'red', intensity: 600 } : { color: 'surface', intensity: 600 }}
            className="text-xs font-medium"
          >
            {formatOpenings(seatsLeft)}
          </Text>
        </ChoiceCard>
      ))}
    </div>
  );
};

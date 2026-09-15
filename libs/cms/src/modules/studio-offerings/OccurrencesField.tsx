import { Box, Button, IconButton, Input, Text } from '@inithium/ui';

export interface OccurrenceInput {
  date: string;
  startTime: string;
  endTime: string;
}

export interface OccurrencesFieldProps {
  readonly values: OccurrenceInput[];
  readonly onChange: (values: OccurrenceInput[]) => void;
}

const EMPTY_OCCURRENCE: OccurrenceInput = { date: '', startTime: '', endTime: '' };

// A Workshop's schedule is a list of specific dated blocks ("Fri-Sun 5-8pm" is 3 rows here), not
// a recurring weekly pattern - this is the field that makes that structural difference from Class
// concrete in the admin form, modeled on ClassEditDialog's own local-composite fields
// (TagListField/DaysOfWeekField) rather than a shared @inithium/ui primitive.
export const OccurrencesField = ({ values, onChange }: OccurrencesFieldProps) => {
  const updateOccurrence = (index: number, patch: Partial<OccurrenceInput>) => {
    onChange(values.map((occurrence, i) => (i === index ? { ...occurrence, ...patch } : occurrence)));
  };

  const removeOccurrence = (index: number) => onChange(values.filter((_, i) => i !== index));

  const addOccurrence = () => onChange([...values, { ...EMPTY_OCCURRENCE }]);

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
        Dates <span className="text-red-500">*</span>
      </Text>

      <Box flex={{ direction: 'col', gap: 8 }}>
        {values.map((occurrence, index) => (
          <Box key={index} flex={{ direction: 'row', gap: 8, align: 'center' }}>
            <Input
              type="date"
              value={occurrence.date}
              onChange={(event) => updateOccurrence(index, { date: event.target.value })}
              className="flex-1"
            />
            <Input
              type="time"
              value={occurrence.startTime}
              onChange={(event) => updateOccurrence(index, { startTime: event.target.value })}
              className="flex-1"
            />
            <Input
              type="time"
              value={occurrence.endTime}
              onChange={(event) => updateOccurrence(index, { endTime: event.target.value })}
              className="flex-1"
            />
            <IconButton
              icon="Trash"
              label="Remove date"
              textColor={{ color: 'red', intensity: 600 }}
              onClick={() => removeOccurrence(index)}
            />
          </Box>
        ))}
      </Box>

      <Button type="button" variant={{ kind: 'outlined', color: 'primary' }} onClick={addOccurrence} className="self-start">
        Add Date
      </Button>
    </Box>
  );
};

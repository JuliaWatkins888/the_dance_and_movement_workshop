import { useMemo, useState } from 'react';
import { Box, Button, Loader, Select, SelectItem, Text } from '@inithium/ui';
import { useListPublicWorkshopsQuery } from '@inithium/api-client';
import type { WorkshopDto } from '@inithium/api-client';

const ALL_FILTER_VALUE = 'all';

interface AgeGroupFilter {
  readonly label: string;
  readonly min: number;
  readonly max: number;
}

const AGE_GROUPS: AgeGroupFilter[] = [
  { label: 'Under 3', min: 0, max: 2.99 },
  { label: '3-5', min: 3, max: 5.99 },
  { label: '6-10', min: 6, max: 10.99 },
  { label: '11-14', min: 11, max: 14.99 },
  { label: '15-17', min: 15, max: 17.99 },
  { label: 'Adult (18+)', min: 18, max: 120 },
];

const workshopMatchesAgeGroup = (workshop: WorkshopDto, group: AgeGroupFilter): boolean => {
  const workshopMin = workshop.minAgeYears ?? 0;
  const workshopMax = workshop.maxAgeYears ?? 120;
  return workshopMin <= group.max && workshopMax >= group.min;
};

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const timeFormatter = (time: string): string => {
  const [hoursRaw, minutes] = time.split(':');
  const hours = Number(hoursRaw);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${minutes} ${period}`;
};

const formatDateRange = (workshop: WorkshopDto): string => {
  if (workshop.occurrences.length === 0) return 'Dates to be announced';
  const first = workshop.occurrences[0];
  const last = workshop.occurrences[workshop.occurrences.length - 1];
  return first.date === last.date
    ? dateFormatter.format(new Date(first.date))
    : `${dateFormatter.format(new Date(first.date))} – ${dateFormatter.format(new Date(last.date))}`;
};

const formatAgeRange = (min?: number, max?: number): string => {
  if (min === undefined && max === undefined) return 'All ages';
  if (min !== undefined && max === undefined) return `Ages ${min}+`;
  if (min === undefined && max !== undefined) return `Up to age ${max}`;
  return `Ages ${min}–${max}`;
};

const formatOpenings = (openings: number): string => (openings <= 0 ? 'Workshop full' : `${openings} spot${openings === 1 ? '' : 's'} open`);

// A workshop hasn't already happened as long as at least one of its dated occurrences is still
// upcoming - unlike a Class's ongoing recurring schedule, a Workshop's relevance genuinely expires
// once its last date passes.
const isUpcoming = (workshop: WorkshopDto): boolean => {
  if (workshop.occurrences.length === 0) return true;
  const lastOccurrence = workshop.occurrences[workshop.occurrences.length - 1];
  return new Date(lastOccurrence.date).getTime() >= Date.now() - 24 * 60 * 60 * 1000;
};

interface WorkshopCardProps {
  readonly workshop: WorkshopDto;
}

// Framed like an event, not an ongoing weekly commitment - dated, one-time price, "grab your
// spot" urgency via the openings count, distinct from a Class's "meets every Tuesday" card shape.
const WorkshopCard = ({ workshop }: WorkshopCardProps) => (
  <Box borderColor={{ color: 'surface', intensity: 300 }} padding={{ base: 16 }} flex={{ direction: 'col', gap: 8 }} className="rounded-lg border">
    <Box flex={{ direction: 'row', justify: 'between', align: 'start', gap: 8 }}>
      <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-bold leading-tight">
        {workshop.name}
      </Text>
      <Text as="p" textColor={{ color: 'primary', intensity: 600 }} className="shrink-0 text-sm font-semibold">
        ${workshop.priceAmount}
      </Text>
    </Box>

    <Text as="p" textColor={{ color: 'primary', intensity: 700 }} className="text-sm font-semibold">
      {formatDateRange(workshop)}
    </Text>

    {workshop.occurrences.length > 0 ? (
      <Box flex={{ direction: 'col', gap: 2 }}>
        {workshop.occurrences.map((occurrence) => (
          <Text key={occurrence.id} as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
            {dateFormatter.format(new Date(occurrence.date))} · {timeFormatter(occurrence.startTime)} – {timeFormatter(occurrence.endTime)}
          </Text>
        ))}
      </Box>
    ) : null}

    {workshop.description ? (
      <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="line-clamp-3 text-sm">
        {workshop.description}
      </Text>
    ) : null}

    <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
      {formatAgeRange(workshop.minAgeYears, workshop.maxAgeYears)}
      {workshop.instructors.length > 0 ? ` · ${workshop.instructors.map((instructor) => instructor.name).join(', ')}` : ''}
    </Text>
    <Text
      as="p"
      textColor={workshop.openings <= 0 ? { color: 'red', intensity: 600 } : { color: 'surface', intensity: 700 }}
      className="text-xs font-medium"
    >
      {formatOpenings(workshop.openings)}
    </Text>

    <Button variant={{ kind: 'filled', color: 'primary' }} className="mt-2 w-full" disabled>
      Registration Opening Soon
    </Button>
  </Box>
);

export const WorkshopsPage = () => {
  const { data: workshops, isLoading } = useListPublicWorkshopsQuery();
  const [ageGroupFilter, setAgeGroupFilter] = useState(ALL_FILTER_VALUE);

  const upcomingWorkshops = useMemo(() => (workshops ?? []).filter(isUpcoming), [workshops]);

  const ageGroupOptions = useMemo(
    () => AGE_GROUPS.filter((group) => upcomingWorkshops.some((workshop) => workshopMatchesAgeGroup(workshop, group))),
    [upcomingWorkshops],
  );

  const filteredWorkshops = useMemo(() => {
    const activeAgeGroup = AGE_GROUPS.find((group) => group.label === ageGroupFilter);
    if (!activeAgeGroup) return upcomingWorkshops;
    return upcomingWorkshops.filter((workshop) => workshopMatchesAgeGroup(workshop, activeAgeGroup));
  }, [upcomingWorkshops, ageGroupFilter]);

  return (
    <Box flex={{ direction: 'col', gap: 24 }} padding={{ base: 32 }}>
      <Box flex={{ direction: 'col', gap: 4 }}>
        <Text textColor={{ color: 'surface', intensity: 950 }} as="h1" className="text-3xl font-bold">
          Workshops
        </Text>
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
          Special one-time and short-run offerings - guest instructors, intensives, and more. Not part of the regular weekly class schedule.
        </Text>
      </Box>

      {ageGroupOptions.length > 0 ? (
        <Box className="max-w-xs">
          <Select value={ageGroupFilter} onValueChange={setAgeGroupFilter} placeholder="Age Group">
            <SelectItem value={ALL_FILTER_VALUE}>All Ages</SelectItem>
            {ageGroupOptions.map((group) => (
              <SelectItem key={group.label} value={group.label}>
                {group.label}
              </SelectItem>
            ))}
          </Select>
        </Box>
      ) : null}

      {isLoading ? (
        <Box flex={{ justify: 'center' }} padding={{ base: 32 }}>
          <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
        </Box>
      ) : filteredWorkshops.length === 0 ? (
        <Text textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
          No upcoming workshops right now - check back soon.
        </Text>
      ) : (
        <Box className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredWorkshops.map((workshop) => (
            <WorkshopCard key={workshop.id} workshop={workshop} />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default WorkshopsPage;

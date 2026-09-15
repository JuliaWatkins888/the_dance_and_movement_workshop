import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Box, Button, Divider, Icon, Input, Loader, Pagination, Pill, Select, SelectItem, Text, dialog } from '@inithium/ui';
import { useListPublicClassesQuery } from '@inithium/api-client';
import type { ClassDto } from '@inithium/api-client';
import type { DayOfWeek } from '@inithium/db';

const PAGE_SIZE = 12;
const ALL_FILTER_VALUE = 'all';

// Monday-first display order - not imported from @inithium/db's own DAYS_OF_WEEK (a runtime
// value, unlike the DayOfWeek type above) since apps/web never pulls runtime code from that
// package (it depends on mongoose) - see ProfilePage.tsx's identical type-only precedent.
const WEEKDAY_ORDER: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ABBREVIATIONS: Record<DayOfWeek, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

interface AgeGroupFilter {
  readonly label: string;
  readonly min: number;
  readonly max: number;
}

// Friendly buckets a parent searches by, rather than exposing the raw minAgeYears/maxAgeYears a
// class is stored with. A class matches a bucket whenever its accepted age range overlaps the
// bucket's range at all, so e.g. an "Ages 6-10" class shows up under both "3-5" and "6-10"... no:
// only where the ranges actually overlap (6-10 overlaps 3-5 at nothing, so it correctly shows
// only under 6-10 and 11-14 doesn't overlap either) - see classMatchesAgeGroup below.
const AGE_GROUPS: AgeGroupFilter[] = [
  { label: 'Under 3', min: 0, max: 2.99 },
  { label: '3-5', min: 3, max: 5.99 },
  { label: '6-10', min: 6, max: 10.99 },
  { label: '11-14', min: 11, max: 14.99 },
  { label: '15-17', min: 15, max: 17.99 },
  { label: 'Adult (18+)', min: 18, max: 120 },
];

const classMatchesAgeGroup = (classItem: ClassDto, group: AgeGroupFilter): boolean => {
  const classMin = classItem.minAgeYears ?? 0;
  const classMax = classItem.maxAgeYears ?? 120;
  return classMin <= group.max && classMax >= group.min;
};

const matchesSearch = (classItem: ClassDto, query: string): boolean => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const haystack = `${classItem.name} ${classItem.categories.join(' ')} ${classItem.instructors.join(' ')}`.toLowerCase();
  return haystack.includes(trimmed);
};

const formatTime12h = (time: string): string => {
  const [hoursRaw, minutes] = time.split(':');
  const hours = Number(hoursRaw);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${minutes} ${period}`;
};

const formatSchedule = (daysOfWeek: DayOfWeek[], startTime: string, endTime: string): string => {
  const days = daysOfWeek.map((day) => DAY_ABBREVIATIONS[day]).join('/');
  return `${days} · ${formatTime12h(startTime)} – ${formatTime12h(endTime)}`;
};

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatDateRange = (startDate: string, endDate: string): string =>
  `${dateFormatter.format(new Date(startDate))} – ${dateFormatter.format(new Date(endDate))}`;

const formatAgeRange = (min?: number, max?: number): string => {
  if (min === undefined && max === undefined) return 'All ages';
  if (min !== undefined && max === undefined) return `Ages ${min}+`;
  if (min === undefined && max !== undefined) return `Up to age ${max}`;
  return `Ages ${min}–${max}`;
};

const formatPrice = (amount: number, billingCycle: string): string => {
  const formatted = `$${amount % 1 === 0 ? amount : amount.toFixed(2)}`;
  return billingCycle.toLowerCase() === 'monthly' ? `${formatted}/mo` : `${formatted} (${billingCycle})`;
};

const formatOpenings = (openings: number): string => (openings <= 0 ? 'Class full' : `${openings} spot${openings === 1 ? '' : 's'} open`);

interface DetailFieldProps {
  readonly label: string;
  readonly value: string;
}

const DetailField = ({ label, value }: DetailFieldProps) => (
  <Box flex={{ direction: 'col', gap: 2 }}>
    <Text as="span" textColor={{ color: 'surface', intensity: 500 }} className="text-xs font-semibold uppercase tracking-wide">
      {label}
    </Text>
    <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm">
      {value}
    </Text>
  </Box>
);

interface ClassDetailDialogContentProps {
  readonly classItem: ClassDto;
}

// Everything the card leaves out (description, instructors, age range, registration date,
// capacity) alongside the fields the card already showed, plus the same no-op Register button -
// see ClassCard's own note on why Register does nothing yet.
const ClassDetailDialogContent = ({ classItem }: ClassDetailDialogContentProps) => (
  <Box flex={{ direction: 'col', gap: 16 }}>
    <Box flex={{ direction: 'row', gap: 6 }} className="flex-wrap">
      {classItem.categories.map((category) => (
        <Pill key={category} color={{ color: 'secondary', intensity: 500 }} className="text-surface-100">
          {category}
        </Pill>
      ))}
    </Box>

    <Text as="p" textColor={{ color: 'primary', intensity: 600 }} className="text-lg font-semibold">
      {formatPrice(classItem.priceAmount, classItem.billingCycle)}
    </Text>

    {classItem.description ? (
      <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="whitespace-pre-line text-sm">
        {classItem.description}
      </Text>
    ) : null}

    <Divider />

    <Box className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
      <DetailField label="Schedule" value={formatSchedule(classItem.daysOfWeek, classItem.startTime, classItem.endTime)} />
      <DetailField label="Session" value={classItem.session} />
      <DetailField label="Dates" value={formatDateRange(classItem.startDate, classItem.endDate)} />
      {classItem.registrationStartDate ? (
        <DetailField label="Registration Opens" value={dateFormatter.format(new Date(classItem.registrationStartDate))} />
      ) : null}
      <DetailField label="Age Range" value={formatAgeRange(classItem.minAgeYears, classItem.maxAgeYears)} />
      {classItem.instructors.length > 0 ? <DetailField label="Instructor(s)" value={classItem.instructors.join(', ')} /> : null}
      <DetailField label="Capacity" value={`${classItem.capacity} students`} />
      <DetailField label="Openings" value={formatOpenings(classItem.openings)} />
    </Box>

    <Button variant={{ kind: 'filled', color: 'primary' }} className="w-full" onClick={() => undefined}>
      Register
    </Button>
  </Box>
);

interface ClassCardProps {
  readonly classItem: ClassDto;
  readonly onOpen: (classItem: ClassDto) => void;
}

// Hand-rolled rather than @inithium/ui's Card composite - Card's onClick prop renders the whole
// element as a <button>, which can't contain the real <button> this card also needs for
// Register; a plain div with role="button" keeps the whole card clickable (mouse and keyboard)
// while Register stays a real, independently-clickable button via stopPropagation. Mirrors
// StaffPage's own precedent of hand-rolling its card rather than reaching for Card.
const ClassCard = ({ classItem, onOpen }: ClassCardProps) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(classItem);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(classItem)}
      onKeyDown={handleKeyDown}
      className="flex h-full cursor-pointer flex-col gap-3 rounded-lg border border-surface-300 p-4 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <Box flex={{ direction: 'row', justify: 'between', align: 'start', gap: 8 }}>
        <Box flex={{ direction: 'col', gap: 2 }}>
          <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-bold leading-tight">
            {classItem.name}
          </Text>
          <Text as="p" textColor={{ color: 'primary', intensity: 600 }} className="text-sm font-semibold">
            {formatPrice(classItem.priceAmount, classItem.billingCycle)}
          </Text>
        </Box>

        <Box flex={{ direction: 'row', gap: 6 }} className="flex-wrap justify-end shrink-0">
          {classItem.categories.map((category) => (
            <Pill key={category} color={{ color: 'secondary', intensity: 500 }} className="text-surface-100">
              {category}
            </Pill>
          ))}
        </Box>
      </Box>

      <Box flex={{ direction: 'col', gap: 2 }}>
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
          {formatSchedule(classItem.daysOfWeek, classItem.startTime, classItem.endTime)}
        </Text>
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
          {classItem.session} · {formatDateRange(classItem.startDate, classItem.endDate)}
        </Text>
      </Box>

      <Text
        as="p"
        textColor={classItem.openings <= 0 ? { color: 'red', intensity: 600 } : { color: 'surface', intensity: 700 }}
        className="text-xs font-medium"
      >
        {formatOpenings(classItem.openings)}
      </Text>

      <Box className="mt-auto pt-1">
        <Button
          variant={{ kind: 'filled', color: 'primary' }}
          className="w-full"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          Register
        </Button>
      </Box>
    </div>
  );
};

export const ClassesPage = () => {
  const { data: classes, isLoading } = useListPublicClassesQuery();
  const [searchInput, setSearchInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(ALL_FILTER_VALUE);
  const [dayFilter, setDayFilter] = useState(ALL_FILTER_VALUE);
  const [ageGroupFilter, setAgeGroupFilter] = useState(ALL_FILTER_VALUE);
  const [page, setPage] = useState(1);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    (classes ?? []).forEach((classItem) => classItem.categories.forEach((category) => set.add(category)));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [classes]);

  const dayOptions = useMemo(() => {
    const set = new Set<DayOfWeek>();
    (classes ?? []).forEach((classItem) => classItem.daysOfWeek.forEach((day) => set.add(day)));
    return WEEKDAY_ORDER.filter((day) => set.has(day));
  }, [classes]);

  const ageGroupOptions = useMemo(
    () => AGE_GROUPS.filter((group) => (classes ?? []).some((classItem) => classMatchesAgeGroup(classItem, group))),
    [classes],
  );

  const filteredClasses = useMemo(() => {
    const activeAgeGroup = AGE_GROUPS.find((group) => group.label === ageGroupFilter);
    return (classes ?? []).filter((classItem) => {
      if (!matchesSearch(classItem, searchInput)) return false;
      if (categoryFilter !== ALL_FILTER_VALUE && !classItem.categories.includes(categoryFilter)) return false;
      if (dayFilter !== ALL_FILTER_VALUE && !classItem.daysOfWeek.includes(dayFilter as DayOfWeek)) return false;
      if (activeAgeGroup && !classMatchesAgeGroup(classItem, activeAgeGroup)) return false;
      return true;
    });
  }, [classes, searchInput, categoryFilter, dayFilter, ageGroupFilter]);

  useEffect(() => {
    setPage(1);
  }, [searchInput, categoryFilter, dayFilter, ageGroupFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredClasses.length / PAGE_SIZE));
  const pageItems = filteredClasses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openClassDetail = (classItem: ClassDto) => {
    dialog.show(() => <ClassDetailDialogContent classItem={classItem} />, { title: classItem.name, width: 560 });
  };

  return (
    <Box flex={{ direction: 'col', gap: 24 }} padding={{ base: 32 }}>
      <Box flex={{ direction: 'col', gap: 4 }}>
        <Text textColor={{ color: 'surface', intensity: 950 }} as="h1" className="text-3xl font-bold">
          Classes
        </Text>
      </Box>

      <Box flex={{ direction: 'col', gap: 12 }}>
        <Input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search by class name, category, or instructor..."
          entryAdornment={<Icon as="span" name="MagnifyingGlass" size={16} />}
        />

        <Box className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select value={categoryFilter} onValueChange={setCategoryFilter} placeholder="Category">
            <SelectItem value={ALL_FILTER_VALUE}>All Categories</SelectItem>
            {categoryOptions.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </Select>

          <Select value={dayFilter} onValueChange={setDayFilter} placeholder="Day">
            <SelectItem value={ALL_FILTER_VALUE}>All Days</SelectItem>
            {dayOptions.map((day) => (
              <SelectItem key={day} value={day}>
                {day}
              </SelectItem>
            ))}
          </Select>

          <Select value={ageGroupFilter} onValueChange={setAgeGroupFilter} placeholder="Age Group">
            <SelectItem value={ALL_FILTER_VALUE}>All Ages</SelectItem>
            {ageGroupOptions.map((group) => (
              <SelectItem key={group.label} value={group.label}>
                {group.label}
              </SelectItem>
            ))}
          </Select>
        </Box>
      </Box>

      {isLoading ? (
        <Box flex={{ justify: 'center' }} padding={{ base: 32 }}>
          <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
        </Box>
      ) : pageItems.length === 0 ? (
        <Text textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
          No classes match your search.
        </Text>
      ) : (
        <Box className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((classItem) => (
            <ClassCard key={classItem.id} classItem={classItem} onOpen={openClassDetail} />
          ))}
        </Box>
      )}

      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={setPage} /> : null}
    </Box>
  );
};

export default ClassesPage;

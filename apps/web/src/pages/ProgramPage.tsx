import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Breadcrumbs, Button, Icon, Input, Loader, Pill, Select, SelectItem, Text } from '@inithium/ui';
import { useGetClassProgramBySlugQuery, usePageParams } from '@inithium/api-client';
import type { DayOfWeek } from '@inithium/db';
import {
  LEVEL_LABELS,
  formatAgeRange,
  formatCents,
  formatDateRange,
  formatInstructors,
  formatOpenings,
  formatTimeRange,
  runsSingleSemester,
} from './classes/classFormat';
import { collectDays, filterSectionListings } from './classes/catalogFilters';
import type { SectionListing } from './classes/catalogFilters';
import { ProgramBanner } from './classes/ProgramBanner';

const ALL_DAYS = 'all';

const SectionCard = ({ listing: { course, section } }: { listing: SectionListing }) => {
  const isFull = section.openings <= 0;

  return (
    <Link
      to={`/classes/${course.slug}?section=${section.id}`}
      className="flex h-full flex-col gap-3 rounded-lg border border-surface-300 bg-surface-100 p-5 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
    >
      <Box flex={{ direction: 'col', gap: 4 }}>
        <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-bold leading-tight">
          {course.name}
        </Text>
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
          {formatAgeRange(course.minAgeYears, course.maxAgeYears)}
          {course.level ? ` · ${LEVEL_LABELS[course.level].split(' · ')[0]}` : ''}
        </Text>
      </Box>

      <Box flex={{ direction: 'col', gap: 2 }}>
        <Text as="p" textColor={{ color: 'surface', intensity: 950 }} className="text-base font-semibold">
          {section.daysOfWeek.join(' & ')}
        </Text>
        <Text as="p" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
          {formatTimeRange(section.startTime, section.endTime)}
        </Text>
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
          with {formatInstructors(section.instructors)}
          {runsSingleSemester(section) ? ` · ${formatDateRange(section.startDate, section.endDate)} only` : ''}
        </Text>
      </Box>

      {course.styles.length > 0 ? (
        <Box flex={{ direction: 'row', gap: 6 }} className="flex-wrap">
          {course.styles.map((style) => (
            <Pill key={style} color={{ color: 'secondary', intensity: 500 }} className="text-secondary-foreground-500">
              {style}
            </Pill>
          ))}
        </Box>
      ) : null}

      <Box flex={{ direction: 'row', justify: 'between', align: 'end', gap: 8 }} className="mt-auto pt-2">
        <Text as="p" textColor={{ color: 'surface', intensity: 950 }} className="text-base font-semibold">
          {formatCents(course.monthlyPriceCents)}
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm font-normal">
            /month
          </Text>
        </Text>
        <Text
          as="span"
          textColor={isFull ? { color: 'red', intensity: 600 } : { color: 'surface', intensity: 600 }}
          className="text-xs font-medium"
        >
          {formatOpenings(section.openings)}
        </Text>
      </Box>
    </Link>
  );
};

export const ProgramPage = () => {
  const { slug } = usePageParams();
  const { data: program, isLoading, isError } = useGetClassProgramBySlugQuery(slug ?? '', { skip: !slug });
  const [search, setSearch] = useState('');
  const [ageInput, setAgeInput] = useState('');
  const [dayFilter, setDayFilter] = useState(ALL_DAYS);

  const parsedAge = ageInput.trim() === '' ? undefined : Number(ageInput);
  const age = parsedAge !== undefined && Number.isFinite(parsedAge) && parsedAge >= 0 ? parsedAge : undefined;
  const day = dayFilter === ALL_DAYS ? undefined : (dayFilter as DayOfWeek);

  const dayOptions = useMemo(() => (program ? collectDays([program]) : []), [program]);
  const listings = useMemo(() => (program ? filterSectionListings(program, { search, age, day }) : []), [program, search, age, day]);
  const hasFilters = Boolean(search.trim()) || age !== undefined || day !== undefined;
  const hasSections = Boolean(program?.courses.some((course) => course.sections.length > 0));

  const clearFilters = () => {
    setSearch('');
    setAgeInput('');
    setDayFilter(ALL_DAYS);
  };

  if (isLoading) {
    return (
      <Box flex={{ justify: 'center' }} padding={{ base: 48 }}>
        <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
      </Box>
    );
  }

  if (!program || isError) {
    return (
      <Box flex={{ direction: 'col', align: 'start', gap: 12 }} padding={{ base: 32 }}>
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
          Program not found
        </Text>
        <Button asChild variant={{ kind: 'outlined', color: 'primary' }}>
          <Link to="/classes">Browse all classes</Link>
        </Button>
      </Box>
    );
  }

  return (
    <Box flex={{ direction: 'col' }} className="w-full">
      <ProgramBanner program={program} />

      <Box flex={{ direction: 'col', gap: 24 }} padding={{ base: 32 }}>
        <Breadcrumbs items={[{ label: 'Classes', to: '/classes' }, { label: program.name }]} />

        <Box flex={{ direction: 'col', gap: 8 }}>
          <Box flex={{ direction: 'row', align: 'center', gap: 12 }} className="flex-wrap">
            <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-3xl font-bold">
              {program.name}
            </Text>
            {program.minAgeYears !== undefined || program.maxAgeYears !== undefined ? (
              <Pill color={{ color: 'primary', intensity: 500 }} className="text-primary-foreground-500">
                {formatAgeRange(program.minAgeYears, program.maxAgeYears)}
              </Pill>
            ) : null}
          </Box>
          {program.description ? (
            <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="max-w-3xl">
              {program.description}
            </Text>
          ) : null}
        </Box>

        {hasSections ? (
          <Box className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr]">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by class, style, or instructor..."
              entryAdornment={<Icon as="span" name="MagnifyingGlass" size={16} />}
            />
            <Input
              type="number"
              min={0}
              max={120}
              value={ageInput}
              onChange={(event) => setAgeInput(event.target.value)}
              placeholder="Dancer's age"
            />
            <Select value={dayFilter} onValueChange={setDayFilter} placeholder="Day">
              <SelectItem value={ALL_DAYS}>Any day</SelectItem>
              {dayOptions.map((weekday) => (
                <SelectItem key={weekday} value={weekday}>
                  {weekday}
                </SelectItem>
              ))}
            </Select>
          </Box>
        ) : null}

        {listings.length === 0 ? (
          <Box flex={{ direction: 'col', align: 'start', gap: 8 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
              {hasFilters ? 'No classes match those filters.' : 'No classes in this program are open for registration right now.'}
            </Text>
            {hasFilters ? (
              <Button variant={{ kind: 'ghost', color: 'primary' }} onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
          </Box>
        ) : (
          <Box className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {listings.map((listing) => (
              <SectionCard key={listing.section.id} listing={listing} />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ProgramPage;

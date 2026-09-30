import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Button, Icon, Input, Loader, Pill, Text } from '@inithium/ui';
import { useListWorkshopsQuery } from '@inithium/api-client';
import type { PublicWorkshopDto } from '@inithium/api-client';
import { LEVEL_LABELS, formatAgeRange, formatCents } from './classes/classFormat';
import { ProgramBanner } from './classes/ProgramBanner';
import {
  availabilityLabel,
  filterWorkshops,
  formatDateSpan,
  formatDayCount,
  formatWorkshopInstructors,
  fullWorkshopSummary,
  hasFullWorkshopDiscount,
} from './workshops/workshopFormat';

const CARD_IMAGE_HEIGHT = 180;

const WorkshopCard = ({ workshop }: { workshop: PublicWorkshopDto }) => {
  const isPast = workshop.status === 'past';
  const isFull = workshop.status === 'open' && workshop.days.every((day) => day.openings <= 0);

  return (
    <Link
      to={`/workshops/${workshop.slug}`}
      className={[
        'group flex h-full flex-col overflow-hidden rounded-lg border border-surface-300 bg-surface-100 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500',
        isPast ? 'opacity-60 grayscale' : '',
      ].join(' ')}
    >
      <ProgramBanner
        program={{
          id: workshop.id,
          name: workshop.title,
          imageUrl: workshop.imageUrl,
          banner: workshop.banner,
        }}
        height={CARD_IMAGE_HEIGHT}
        className="transition-transform duration-300 group-hover:scale-[1.02]"
      />
      <Box flex={{ direction: 'col', gap: 10 }} className="flex-1 p-5">
        <Box flex={{ direction: 'col', gap: 4 }}>
          <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-bold leading-tight">
            {workshop.title}
          </Text>
          <Text as="p" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
            {formatDateSpan(workshop.days)} · {formatDayCount(workshop.days.length)}
          </Text>
          <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
            with {formatWorkshopInstructors(workshop.instructors)}
          </Text>
        </Box>

        <Box flex={{ direction: 'row', gap: 6 }} className="flex-wrap">
          <Pill color={{ color: 'primary', intensity: 500 }} className="text-primary-foreground-500">
            {formatAgeRange(workshop.minAgeYears, workshop.maxAgeYears)}
          </Pill>
          {workshop.level ? (
            <Pill color={{ color: 'surface', intensity: 300 }} className="text-surface-950">
              {LEVEL_LABELS[workshop.level].split(' · ')[0]}
            </Pill>
          ) : null}
          {workshop.styles.map((style) => (
            <Pill key={style} color={{ color: 'secondary', intensity: 500 }} className="text-secondary-foreground-500">
              {style}
            </Pill>
          ))}
        </Box>

        {workshop.description ? (
          <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="line-clamp-3 text-sm">
            {workshop.description}
          </Text>
        ) : null}

        <Box flex={{ direction: 'row', justify: 'between', align: 'end', gap: 8 }} className="mt-auto pt-2">
          <Box flex={{ direction: 'col', gap: 2 }}>
            <Text as="p" textColor={{ color: 'surface', intensity: 950 }} className="text-base font-semibold">
              {formatCents(workshop.pricePerDayCents)}
              <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm font-normal">
                /day
              </Text>
            </Text>
            {hasFullWorkshopDiscount(workshop) ? (
              <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-xs">
                {fullWorkshopSummary(workshop)}
              </Text>
            ) : null}
          </Box>
          <Text
            as="span"
            textColor={isFull ? { color: 'red', intensity: 600 } : { color: 'surface', intensity: 600 }}
            className="text-right text-xs font-medium"
          >
            {availabilityLabel(workshop)}
          </Text>
        </Box>
      </Box>
    </Link>
  );
};

const WorkshopGrid = ({ workshops }: { workshops: PublicWorkshopDto[] }) => (
  <Box className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
    {workshops.map((workshop) => (
      <WorkshopCard key={workshop.id} workshop={workshop} />
    ))}
  </Box>
);

export const WorkshopsPage = () => {
  const { data: workshops = [], isLoading } = useListWorkshopsQuery();
  const [search, setSearch] = useState('');
  const [ageInput, setAgeInput] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const parsedAge = ageInput.trim() === '' ? undefined : Number(ageInput);
  const age = parsedAge !== undefined && Number.isFinite(parsedAge) && parsedAge >= 0 ? parsedAge : undefined;
  const hasFilters = Boolean(search.trim()) || age !== undefined || Boolean(from) || Boolean(to);

  const filtered = useMemo(
    () =>
      filterWorkshops(workshops, {
        search,
        age,
        from: from || undefined,
        to: to || undefined,
      }),
    [workshops, search, age, from, to],
  );
  const current = filtered.filter((workshop) => workshop.status !== 'past');
  const past = filtered.filter((workshop) => workshop.status === 'past');

  const clearFilters = () => {
    setSearch('');
    setAgeInput('');
    setFrom('');
    setTo('');
  };

  return (
    <Box flex={{ direction: 'col', gap: 24 }} padding={{ base: 32 }}>
      <Box flex={{ direction: 'col', gap: 8 }}>
        <Text textColor={{ color: 'surface', intensity: 950 }} as="h1" className="text-3xl font-bold">
          Workshops
        </Text>
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="max-w-3xl text-sm">
          Special one-time workshops and intensives, often with visiting instructors. Sign up for the days that work for you, or save by
          joining for the whole workshop.
        </Text>
      </Box>

      {isLoading ? (
        <Box flex={{ justify: 'center' }} padding={{ base: 32 }}>
          <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
        </Box>
      ) : workshops.length === 0 ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
          No workshops are scheduled right now. Check back soon!
        </Text>
      ) : (
        <>
          <Box className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
            <Input
              label="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Workshop, style, or instructor..."
              entryAdornment={<Icon as="span" name="MagnifyingGlass" size={16} />}
            />
            <Input
              label="Dancer's age"
              type="number"
              min={0}
              max={120}
              value={ageInput}
              onChange={(event) => setAgeInput(event.target.value)}
              placeholder="Any age"
            />
            <Input label="From" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <Input label="To" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
          </Box>

          {filtered.length === 0 ? (
            <Box flex={{ direction: 'col', align: 'start', gap: 8 }}>
              <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
                No workshops match those filters.
              </Text>
              {hasFilters ? (
                <Button variant={{ kind: 'ghost', color: 'primary' }} onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
            </Box>
          ) : null}

          {current.length > 0 ? <WorkshopGrid workshops={current} /> : null}

          {past.length > 0 ? (
            <Box flex={{ direction: 'col', gap: 12 }}>
              <Text as="h2" textColor={{ color: 'surface', intensity: 700 }} className="text-sm font-semibold uppercase tracking-wide">
                Past workshops
              </Text>
              <WorkshopGrid workshops={past} />
            </Box>
          ) : null}
        </>
      )}
    </Box>
  );
};

export default WorkshopsPage;

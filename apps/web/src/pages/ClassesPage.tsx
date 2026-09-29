import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Box, Loader, Pill, Text } from '@inithium/ui';
import { useListClassCatalogQuery } from '@inithium/api-client';
import type { CatalogProgramDto } from '@inithium/api-client';
import { formatAgeRange } from './classes/classFormat';
import { summarizeSchoolYear } from './classes/catalogFilters';
import { ProgramBanner } from './classes/ProgramBanner';

const CARD_IMAGE_HEIGHT = 180;

const hasAgeRange = (program: CatalogProgramDto): boolean => program.minAgeYears !== undefined || program.maxAgeYears !== undefined;

const ProgramCard = ({ program }: { program: CatalogProgramDto }) => (
  <Link
    to={`/programs/${program.slug}`}
    className="group flex h-full flex-col overflow-hidden rounded-lg border border-surface-300 bg-surface-100 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
  >
    <ProgramBanner program={program} height={CARD_IMAGE_HEIGHT} className="transition-transform duration-300 group-hover:scale-[1.02]" />
    <Box flex={{ direction: 'col', gap: 8 }} className="flex-1 p-5">
      <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-bold leading-tight">
        {program.name}
      </Text>
      {hasAgeRange(program) ? (
        <Box>
          <Pill color={{ color: 'primary', intensity: 500 }} className="text-primary-foreground-500">
            {formatAgeRange(program.minAgeYears, program.maxAgeYears)}
          </Pill>
        </Box>
      ) : null}
      {program.description ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="line-clamp-4 text-sm">
          {program.description}
        </Text>
      ) : null}
      <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="mt-auto pt-2 text-sm font-semibold group-hover:underline">
        View classes &rarr;
      </Text>
    </Box>
  </Link>
);

export const ClassesPage = () => {
  const { data: programs = [], isLoading } = useListClassCatalogQuery();
  const schoolYearSummary = useMemo(() => summarizeSchoolYear(programs), [programs]);

  return (
    <Box flex={{ direction: 'col', gap: 32 }} padding={{ base: 32 }}>
      <Box flex={{ direction: 'col', gap: 8 }}>
        <Text textColor={{ color: 'surface', intensity: 950 }} as="h1" className="text-3xl font-bold">
          Classes
        </Text>
        {schoolYearSummary ? (
          <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
            {schoolYearSummary.name} school year · {schoolYearSummary.semesters.join(' · ')}
          </Text>
        ) : null}
      </Box>

      {isLoading ? (
        <Box flex={{ justify: 'center' }} padding={{ base: 32 }}>
          <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
        </Box>
      ) : programs.length === 0 ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
          No classes are open for registration right now.
        </Text>
      ) : (
        <Box className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {programs.map((program) => (
            <ProgramCard key={program.id} program={program} />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ClassesPage;

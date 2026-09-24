import { useEffect, useState } from 'react';
import { Box, Select, SelectItem, Text } from '@inithium/ui';
import { pickCurrentAcademicYear, useGetStudioOfferingsStatsQuery, useListAcademicYearsAdminQuery } from '@inithium/api-client';

interface StatTileProps {
  readonly label: string;
  readonly value: number;
  readonly loading?: boolean;
}

// Styled the same way DashboardPage's own widget cards already are (Box/Text, no dedicated Card
// component exists in @inithium/ui) - a "1000-foot view" of rollup counts, deliberately not a
// schedule/calendar preview or a registration stat (registration doesn't exist yet).
const StatTile = ({ label, value, loading }: StatTileProps) => (
  <Box bgColor={{ color: 'surface', intensity: 100 }} borderColor={{ color: 'surface', intensity: 200 }} padding={{ base: 16 }} className="rounded border">
    <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm font-medium">
      {label}
    </Text>
    <Text as="p" textColor={{ color: 'surface', intensity: 950 }} className="text-3xl font-bold">
      {loading ? '…' : value}
    </Text>
  </Box>
);

const ACADEMIC_YEAR_PAGE_SIZE = 100;

export const StudioOfferingsDashboard = () => {
  const { data: academicYearOptions } = useListAcademicYearsAdminQuery({ page: 1, pageSize: ACADEMIC_YEAR_PAGE_SIZE });
  const [academicYearId, setAcademicYearId] = useState('');

  // Defaults to "the current academic year" (see pickCurrentAcademicYear) the first time years load -
  // there's no stored isCurrent flag, so this is derived the same way the public site derives which
  // year its dropdown starts on.
  useEffect(() => {
    if (academicYearId || !academicYearOptions?.items.length) return;
    const current = pickCurrentAcademicYear(academicYearOptions.items);
    if (current) setAcademicYearId(current.id);
  }, [academicYearOptions, academicYearId]);

  const { data: stats, isLoading: isLoadingStats } = useGetStudioOfferingsStatsQuery(
    { academicYearId: academicYearId || undefined },
    { skip: !academicYearId },
  );
  const selectedAcademicYearTitle = academicYearOptions?.items.find((academicYear) => academicYear.id === academicYearId)?.title;
  const scopeSuffix = selectedAcademicYearTitle ? ` · ${selectedAcademicYearTitle}` : '';

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }} className="flex-wrap">
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
          Studio Offerings
        </Text>
        {academicYearOptions && academicYearOptions.items.length > 0 ? (
          <Box className="w-64">
            <Select value={academicYearId} onValueChange={setAcademicYearId} placeholder="Select an academic year">
              {academicYearOptions.items.map((academicYear) => (
                <SelectItem key={academicYear.id} value={academicYear.id}>
                  {academicYear.title}
                </SelectItem>
              ))}
            </Select>
          </Box>
        ) : null}
      </Box>

      {academicYearOptions && academicYearOptions.items.length === 0 ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
          No academic years yet - create one under Academic Years to start planning courses, classes, and workshops.
        </Text>
      ) : (
        <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Academic Years" value={academicYearOptions?.total ?? 0} />
          <StatTile label={`Courses${scopeSuffix}`} value={stats?.courseCount ?? 0} loading={isLoadingStats} />
          <StatTile label={`Classes${scopeSuffix}`} value={stats?.classCount ?? 0} loading={isLoadingStats} />
          <StatTile label={`Workshops${scopeSuffix}`} value={stats?.workshopCount ?? 0} loading={isLoadingStats} />
        </Box>
      )}
    </Box>
  );
};

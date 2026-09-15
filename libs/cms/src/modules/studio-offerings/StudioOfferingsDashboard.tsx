import { useEffect, useState } from 'react';
import { Box, Select, SelectItem, Text } from '@inithium/ui';
import { pickCurrentSemester, useGetStudioOfferingsStatsQuery, useListSemestersAdminQuery } from '@inithium/api-client';

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

const SEMESTER_PAGE_SIZE = 100;

export const StudioOfferingsDashboard = () => {
  const { data: semesterOptions } = useListSemestersAdminQuery({ page: 1, pageSize: SEMESTER_PAGE_SIZE });
  const [semesterId, setSemesterId] = useState('');

  // Defaults to "the current semester" (see pickCurrentSemester) the first time semesters load -
  // there's no stored isCurrent flag, so this is derived the same way the public site will derive
  // its own "now enrolling" section.
  useEffect(() => {
    if (semesterId || !semesterOptions?.items.length) return;
    const current = pickCurrentSemester(semesterOptions.items);
    if (current) setSemesterId(current.id);
  }, [semesterOptions, semesterId]);

  const { data: stats, isLoading: isLoadingStats } = useGetStudioOfferingsStatsQuery({ semesterId: semesterId || undefined }, { skip: !semesterId });
  const selectedSemesterName = semesterOptions?.items.find((semester) => semester.id === semesterId)?.name;

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }} className="flex-wrap">
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
          Studio Offerings
        </Text>
        {semesterOptions && semesterOptions.items.length > 0 ? (
          <Box className="w-64">
            <Select value={semesterId} onValueChange={setSemesterId} placeholder="Select a semester">
              {semesterOptions.items.map((semester) => (
                <SelectItem key={semester.id} value={semester.id}>
                  {semester.name}
                </SelectItem>
              ))}
            </Select>
          </Box>
        ) : null}
      </Box>

      {semesterOptions && semesterOptions.items.length === 0 ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
          No semesters yet - create one under Semesters to start planning courses, classes, and workshops.
        </Text>
      ) : (
        <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Semesters" value={semesterOptions?.total ?? 0} />
          <StatTile
            label={`Courses${selectedSemesterName ? ` · ${selectedSemesterName}` : ''}`}
            value={stats?.courseCount ?? 0}
            loading={isLoadingStats}
          />
          <StatTile
            label={`Classes${selectedSemesterName ? ` · ${selectedSemesterName}` : ''}`}
            value={stats?.classCount ?? 0}
            loading={isLoadingStats}
          />
          <StatTile
            label={`Workshops${selectedSemesterName ? ` · ${selectedSemesterName}` : ''}`}
            value={stats?.workshopCount ?? 0}
            loading={isLoadingStats}
          />
        </Box>
      )}
    </Box>
  );
};

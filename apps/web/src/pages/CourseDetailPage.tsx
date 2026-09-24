import { useEffect, useMemo, useState } from 'react';
import { Banner, Box, Loader, Pill, Select, SelectItem, Text, useElementSize } from '@inithium/ui';
import { useListPublicClassesQuery, useListPublicCoursesQuery, usePageParams } from '@inithium/api-client';
import type { ClassDto } from '@inithium/api-client';
import type { DayOfWeek } from '@inithium/db';
import { NotFoundPage } from './NotFoundPage';
import { generateCourseBannerConfig } from './courseBannerConfig';
import { RegistrationButton } from './RegistrationButton';
import { buildClassClosedContactMessage, buildClassFullContactMessage, getClassRegistrationStatus } from './registrationStatus';

const ALL_FILTER_VALUE = 'all';
const DETAIL_BANNER_HEIGHT = 500;

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

// Friendly buckets a parent searches by, rather than exposing raw minAgeYears/maxAgeYears - see
// the identical precedent this was ported from in the old ClassesPage.tsx.
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

const formatAgeRange = (min?: number, max?: number): string => {
  if (min === undefined && max === undefined) return 'All ages';
  if (min !== undefined && max === undefined) return `Ages ${min}+`;
  if (min === undefined && max !== undefined) return `Up to age ${max}`;
  return `Ages ${min}–${max}`;
};

// The card shows the month-to-month rate; the semester/year-in-full totals (classItem.pricing) are
// what the registration flow will offer as billing options.
const formatMonthlyPrice = (amount: number): string => `$${amount % 1 === 0 ? amount : amount.toFixed(2)}/mo`;

// "Summer/Fall 2026 & Winter/Spring 2027" - which term(s) something runs in, for prefilled contact copy.
const formatSemesterNames = (semesters: readonly { readonly name: string }[]): string => semesters.map((semester) => semester.name).join(' & ');

const formatOpenings = (openings: number): string => (openings <= 0 ? 'Class full' : `${openings} spot${openings === 1 ? '' : 's'} open`);

const termDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
// Two class records can share an identical variantLabel/day/time (e.g. one still carrying an old
// term's dates, one carrying the next term's) and read as duplicates with nothing to tell them
// apart - showing each one's own term span makes clear they're different offering windows.
const formatTermRange = (startIso: string, endIso: string): string =>
  `${termDateFormatter.format(new Date(startIso))} – ${termDateFormatter.format(new Date(endIso))}`;

interface ClassVariantCardProps {
  readonly classItem: ClassDto;
}

// A "pick your time" card - everything a parent needs to choose between this Course's sections,
// without a further detail dialog (unlike the old flat ClassesPage, there's no name/description
// left to elaborate on here - that's already shown once, above, for the whole Course).
const ClassVariantCard = ({ classItem }: ClassVariantCardProps) => {
  const displayName = `${classItem.courseName} - ${classItem.variantLabel ?? formatSchedule(classItem.daysOfWeek, classItem.startTime, classItem.endTime)}`;

  return (
    <Box
      borderColor={{ color: 'surface', intensity: 300 }}
      bgColor={{ color: 'surface', intensity: 100 }}
      padding={{ base: 16 }}
      flex={{ direction: 'col', gap: 8 }}
      className="rounded-lg border"
    >
      <Box flex={{ direction: 'row', justify: 'between', align: 'start', gap: 8 }}>
        <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className="text-base font-bold leading-tight">
          {displayName}
        </Text>
        <Text as="p" textColor={{ color: 'primary', intensity: 600 }} className="shrink-0 text-sm font-semibold">
          {formatMonthlyPrice(classItem.priceAmount)}
        </Text>
      </Box>

      <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
        {formatSchedule(classItem.daysOfWeek, classItem.startTime, classItem.endTime)}
      </Text>
      <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
        {formatTermRange(classItem.startDate, classItem.endDate)}
      </Text>
      <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
        {formatAgeRange(classItem.minAgeYears, classItem.maxAgeYears)}
        {classItem.instructors.length > 0 ? ` · ${classItem.instructors.map((instructor) => instructor.name).join(', ')}` : ''}
      </Text>
      <Text
        as="p"
        textColor={classItem.openings <= 0 ? { color: 'red', intensity: 600 } : { color: 'surface', intensity: 700 }}
        className="text-xs font-medium"
      >
        {formatOpenings(classItem.openings)}
      </Text>

      <RegistrationButton
        status={getClassRegistrationStatus(classItem)}
        opensAt={classItem.effectiveRegistrationOpensAt}
        registerPath={`/register/class/${classItem.id}`}
        fullContactMessage={buildClassFullContactMessage(displayName, classItem.courseName, formatSemesterNames(classItem.semesters))}
        closedContactMessage={buildClassClosedContactMessage(displayName, classItem.courseName, formatSemesterNames(classItem.semesters))}
        className="mt-2 w-full"
      />
    </Box>
  );
};

export const CourseDetailPage = () => {
  const { courseId } = usePageParams();
  // Full-bleed banner, so it spans a wide range of viewport widths - measures its own real
  // rendered width and feeds it back into Banner's mesh generation to avoid the triangle
  // stretching/distortion a fluid 100%-width Banner gets by default (see Banner.tsx's own
  // comment, and ProfilePage.tsx's identical use of useElementSize for its own full-width banner).
  const { ref: bannerSizeRef, size: bannerSize } = useElementSize();

  const { data: courses, isLoading: isLoadingCourses } = useListPublicCoursesQuery();
  const course = useMemo(() => courses?.find((candidate) => candidate.id === courseId), [courses, courseId]);

  const { data: classes, isLoading: isLoadingClasses } = useListPublicClassesQuery(courseId ? { courseId } : undefined, { skip: !courseId });

  const [dayFilter, setDayFilter] = useState(ALL_FILTER_VALUE);
  const [ageGroupFilter, setAgeGroupFilter] = useState(ALL_FILTER_VALUE);

  useEffect(() => {
    setDayFilter(ALL_FILTER_VALUE);
    setAgeGroupFilter(ALL_FILTER_VALUE);
  }, [courseId]);

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
      if (dayFilter !== ALL_FILTER_VALUE && !classItem.daysOfWeek.includes(dayFilter as DayOfWeek)) return false;
      if (activeAgeGroup && !classMatchesAgeGroup(classItem, activeAgeGroup)) return false;
      return true;
    });
  }, [classes, dayFilter, ageGroupFilter]);

  if (isLoadingCourses) {
    return (
      <Box flex={{ justify: 'center' }} padding={{ base: 64 }}>
        <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
      </Box>
    );
  }

  if (!course) {
    return <NotFoundPage />;
  }

  return (
    <Box flex={{ direction: 'col' }}>
      <div ref={bannerSizeRef} className="w-full" style={{ height: `${DETAIL_BANNER_HEIGHT}px` }}>
        <Banner
          imageUrl={course.imageUrl}
          imageAlt={course.name}
          trianglifyConfig={generateCourseBannerConfig(course.id)}
          width={bannerSize?.width}
          height={DETAIL_BANNER_HEIGHT}
        />
      </div>

      <Box flex={{ direction: 'col', gap: 24 }} padding={{ base: 32 }}>
        <Box flex={{ direction: 'col', gap: 12 }}>
          <Box flex={{ direction: 'row', align: 'center', gap: 10 }} className="flex-wrap">
            <Text textColor={{ color: 'surface', intensity: 950 }} as="h1" className="text-3xl font-bold">
              {course.name}
            </Text>
            {course.categories.map((category) => (
              <Pill key={category} color={{ color: 'secondary', intensity: 500 }} className="text-surface-100">
                {category}
              </Pill>
            ))}
          </Box>
          <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm font-medium">
            {course.spansFullYear ? course.academicYearTitle : `${course.academicYearTitle} · ${formatSemesterNames(course.semesters)}`}
          </Text>
          {course.description ? (
            <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="whitespace-pre-line text-sm">
              {course.description}
            </Text>
          ) : null}
        </Box>

        <Box flex={{ direction: 'col', gap: 16 }}>
          <Text textColor={{ color: 'surface', intensity: 950 }} as="h2" className="text-xl font-bold">
            Available Times
          </Text>

          {dayOptions.length > 0 || ageGroupOptions.length > 0 ? (
            <Box className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          ) : null}

          {isLoadingClasses ? (
            <Box flex={{ justify: 'center' }} padding={{ base: 32 }}>
              <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
            </Box>
          ) : filteredClasses.length === 0 ? (
            <Text textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
              No times match your search.
            </Text>
          ) : (
            <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredClasses.map((classItem) => (
                <ClassVariantCard key={classItem.id} classItem={classItem} />
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default CourseDetailPage;

import { useMemo, useState } from 'react';
import { Banner, Box, Icon, Loader, Pill, Select, SelectItem, Text, useNavigateWithTransition } from '@inithium/ui';
import { pickCurrentAcademicYear, useListPublicAcademicYearsQuery, useListPublicCoursesQuery } from '@inithium/api-client';
import type { AcademicYearDto, CourseDto, SemesterSummaryDto } from '@inithium/api-client';
import { generateCourseBannerConfig } from './courseBannerConfig';

const TILE_BANNER_HEIGHT = 144;

// Public copy deliberately never says "Course" or "Semester" - those are internal vocabulary for
// how the studio plans a term (see CLAUDE.md-adjacent design notes carried over from planning).
// A visitor sees style tiles ("Ballet") grouped under plain-language section headers instead.
type SemesterStatus = 'in-session' | 'enrolling' | 'upcoming' | 'past';

const STATUS_LABEL: Record<SemesterStatus, string> = {
  'in-session': 'In session',
  enrolling: 'Now enrolling',
  // Fallback only - buildStatusLabel prefers a concrete "Enrollment opens <date>" whenever the
  // semester's registrationOpensAt is known, since "opens soon" told a parent nothing actionable
  // when the real date is already known. This only surfaces if that date is somehow missing.
  upcoming: 'Enrollment opens soon',
  past: 'Past',
};

const STATUS_PRIORITY: Record<SemesterStatus, number> = {
  enrolling: 0,
  'in-session': 1,
  upcoming: 2,
  past: 3,
};

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatDateRange = (startIso: string, endIso: string): string => `${dateFormatter.format(new Date(startIso))} – ${dateFormatter.format(new Date(endIso))}`;

const buildStatusLabel = (status: SemesterStatus, registrationOpensAt?: string): string =>
  status === 'upcoming' && registrationOpensAt ? `Enrollment opens ${dateFormatter.format(new Date(registrationOpensAt))}` : STATUS_LABEL[status];

const describeSemesterStatus = (semester: SemesterSummaryDto): SemesterStatus => {
  const now = Date.now();
  const start = new Date(semester.startDate).getTime();
  const end = new Date(semester.endDate).getTime();
  if (now > end) return 'past';
  if (now >= start) return 'in-session';
  const registrationOpensAt = semester.registrationOpensAt ? new Date(semester.registrationOpensAt).getTime() : undefined;
  return registrationOpensAt !== undefined && now >= registrationOpensAt ? 'enrolling' : 'upcoming';
};

interface SemesterSection {
  readonly semester: SemesterSummaryDto;
  readonly status: SemesterStatus;
  readonly courses: CourseDto[];
}

// One accordion per semester of the chosen year, each listing the courses that run in it - a
// full-year course therefore appears under both semesters, a single-semester course under only its
// own. A semester with nothing running in it is left out rather than shown as an empty accordion.
const buildSections = (academicYear: AcademicYearDto, courses: CourseDto[]): SemesterSection[] =>
  academicYear.semesters
    .map((semester) => ({
      semester,
      status: describeSemesterStatus(semester),
      courses: courses.filter((course) => course.academicYearId === academicYear.id && course.semesterIds.includes(semester.id)),
    }))
    .filter((section) => section.courses.length > 0)
    .sort((a, b) => {
      const priorityDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.semester.startDate).getTime() - new Date(b.semester.startDate).getTime();
    });

interface CourseTileProps {
  readonly course: CourseDto;
  readonly onOpen: (course: CourseDto) => void;
}

const CourseTile = ({ course, onOpen }: CourseTileProps) => (
  <div
    role="button"
    tabIndex={0}
    onClick={() => onOpen(course)}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpen(course);
      }
    }}
    className="flex h-full cursor-pointer flex-col overflow-hidden rounded-lg border border-surface-300 bg-surface-100 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
  >
    <Banner
      imageUrl={course.imageUrl}
      imageAlt={course.name}
      trianglifyConfig={generateCourseBannerConfig(course.id)}
      height={TILE_BANNER_HEIGHT}
    />

    <Box flex={{ direction: 'col', gap: 8 }} padding={{ base: 16 }} className="flex-1">
      <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-bold leading-tight">
        {course.name}
      </Text>
      {course.description ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="line-clamp-3 text-sm">
          {course.description}
        </Text>
      ) : null}
      <Box flex={{ direction: 'row', gap: 6 }} className="mt-auto flex-wrap pt-2">
        {course.categories.map((category) => (
          <Pill key={category} color={{ color: 'secondary', intensity: 500 }} className="text-surface-100">
            {category}
          </Pill>
        ))}
      </Box>
    </Box>
  </div>
);

export const CourseBrowsePage = () => {
  const { data: courses, isLoading: isLoadingCourses } = useListPublicCoursesQuery();
  const { data: academicYears, isLoading: isLoadingAcademicYears } = useListPublicAcademicYearsQuery();
  const isLoading = isLoadingCourses || isLoadingAcademicYears;
  const navigate = useNavigateWithTransition();

  // The API only returns years that are in session or still to come. Starts on the one in session
  // now (else the soonest upcoming) until the visitor picks another.
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('');
  const selectedAcademicYear = useMemo(
    () =>
      (academicYears ?? []).find((academicYear) => academicYear.id === selectedAcademicYearId) ??
      pickCurrentAcademicYear(academicYears ?? []) ??
      academicYears?.[0],
    [academicYears, selectedAcademicYearId],
  );

  const sections = useMemo(
    () => (selectedAcademicYear ? buildSections(selectedAcademicYear, courses ?? []) : []),
    [selectedAcademicYear, courses],
  );
  const openCourse = (course: CourseDto) => navigate(`/courses/${course.id}`);

  // Every section starts collapsed - a visitor opens whichever term(s) they actually want to
  // browse rather than scrolling past every course in every semester by default.
  const [expandedSemesterIds, setExpandedSemesterIds] = useState<Set<string>>(new Set());

  const toggleSemester = (semesterId: string) => {
    setExpandedSemesterIds((prev) => {
      const next = new Set(prev);
      if (next.has(semesterId)) {
        next.delete(semesterId);
      } else {
        next.add(semesterId);
      }
      return next;
    });
  };

  return (
    <Box flex={{ direction: 'col', gap: 32 }} padding={{ base: 32 }}>
      <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 16 }} className="flex-wrap">
        <Text textColor={{ color: 'surface', intensity: 950 }} as="h1" className="text-3xl font-bold">
          Find a class that's right for you
        </Text>
        {academicYears && academicYears.length > 0 && selectedAcademicYear ? (
          <Box className="w-full sm:w-64">
            <Select value={selectedAcademicYear.id} onValueChange={setSelectedAcademicYearId} placeholder="Choose a year">
              {academicYears.map((academicYear) => (
                <SelectItem key={academicYear.id} value={academicYear.id}>
                  {academicYear.title}
                </SelectItem>
              ))}
            </Select>
          </Box>
        ) : null}
      </Box>

      {isLoading ? (
        <Box flex={{ justify: 'center' }} padding={{ base: 32 }}>
          <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
        </Box>
      ) : sections.length === 0 ? (
        <Text textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
          No classes are open for browsing right now - check back soon.
        </Text>
      ) : (
        sections.map((section) => {
          const semesterId = section.semester.id;
          const isExpanded = expandedSemesterIds.has(semesterId);
          const isEnrolling = section.status === 'enrolling';
          return (
            <Box
              key={semesterId}
              borderColor={{ color: isEnrolling ? 'primary' : 'surface', intensity: isEnrolling ? 400 : 300 }}
              bgColor={{ color: 'surface', intensity: 200 }}
              className="overflow-hidden rounded-xl border shadow-sm transition-shadow duration-200 hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => toggleSemester(semesterId)}
                aria-expanded={isExpanded}
                className="flex w-full flex-col items-start gap-1 px-5 py-4 text-left transition-colors duration-150 hover:bg-surface-300/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
              >
                <Box flex={{ direction: 'row', align: 'center', gap: 10 }} className="w-full">
                  <Icon
                    name="CaretRight"
                    size={18}
                    textColor={{ color: 'surface', intensity: 600 }}
                    className={`shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                  />
                  <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="text-xl font-bold">
                    {section.semester.name}
                  </Text>
                  <Pill color={{ color: isEnrolling ? 'primary' : 'surface', intensity: isEnrolling ? 500 : 300 }}>
                    {buildStatusLabel(section.status, section.semester.registrationOpensAt)}
                  </Pill>
                  <Text as="span" textColor={{ color: 'surface', intensity: 500 }} className="ml-auto text-sm">
                    {section.courses.length} class{section.courses.length === 1 ? '' : 'es'}
                  </Text>
                </Box>
                <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="pl-7 text-sm">
                  {formatDateRange(section.semester.startDate, section.semester.endDate)}
                </Text>
              </button>

              {/* CSS-only accordion: animating grid-template-rows between 0fr/1fr (with the inner
                  wrapper clipped via overflow-hidden) slides the content open/closed without
                  measuring its height in JS - a plain conditional render can't be animated this
                  way since the content isn't there to transition until after it already is. */}
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
              >
                <div className="overflow-hidden">
                  <Box
                    borderColor={{ color: 'surface', intensity: 300 }}
                    className="grid grid-cols-1 gap-6 border-t px-5 py-5 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    {section.courses.map((course) => (
                      <CourseTile key={course.id} course={course} onOpen={openCourse} />
                    ))}
                  </Box>
                </div>
              </div>
            </Box>
          );
        })
      )}
    </Box>
  );
};

export default CourseBrowsePage;

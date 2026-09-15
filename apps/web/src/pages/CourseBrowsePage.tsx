import { useMemo } from 'react';
import { Banner, Box, Loader, Pill, Text, useNavigateWithTransition } from '@inithium/ui';
import { useListPublicCoursesQuery } from '@inithium/api-client';
import type { CourseDto } from '@inithium/api-client';
import { generateCourseBannerConfig } from './courseBannerConfig';

const TILE_BANNER_HEIGHT = 144;

// Public copy deliberately never says "Course" or "Semester" - those are internal vocabulary for
// how the studio plans a term (see CLAUDE.md-adjacent design notes carried over from planning).
// A visitor sees style tiles ("Ballet") grouped under plain-language section headers instead.
type SemesterStatus = 'in-session' | 'enrolling' | 'upcoming' | 'past';

const STATUS_LABEL: Record<SemesterStatus, string> = {
  'in-session': 'In session',
  enrolling: 'Now enrolling',
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

const describeSemesterStatus = (course: CourseDto): SemesterStatus => {
  if (!course.semesterStartDate || !course.semesterEndDate) return 'upcoming';
  const now = Date.now();
  const start = new Date(course.semesterStartDate).getTime();
  const end = new Date(course.semesterEndDate).getTime();
  if (now > end) return 'past';
  if (now >= start) return 'in-session';
  const registrationOpensAt = course.semesterRegistrationOpensAt ? new Date(course.semesterRegistrationOpensAt).getTime() : undefined;
  return registrationOpensAt !== undefined && now >= registrationOpensAt ? 'enrolling' : 'upcoming';
};

interface SemesterSection {
  readonly semesterId: string;
  readonly semesterName: string;
  readonly status: SemesterStatus;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly courses: CourseDto[];
}

const groupBySemester = (courses: CourseDto[]): SemesterSection[] => {
  const bySemesterId = new Map<string, SemesterSection>();

  for (const course of courses) {
    const existing = bySemesterId.get(course.semesterId);
    if (existing) {
      existing.courses.push(course);
      continue;
    }
    bySemesterId.set(course.semesterId, {
      semesterId: course.semesterId,
      semesterName: course.semesterName,
      status: describeSemesterStatus(course),
      startDate: course.semesterStartDate,
      endDate: course.semesterEndDate,
      courses: [course],
    });
  }

  return [...bySemesterId.values()].sort((a, b) => {
    const priorityDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (priorityDiff !== 0) return priorityDiff;
    return (a.startDate ? new Date(a.startDate).getTime() : 0) - (b.startDate ? new Date(b.startDate).getTime() : 0);
  });
};

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
    className="flex h-full cursor-pointer flex-col overflow-hidden rounded-lg border border-surface-300 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
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
  const { data: courses, isLoading } = useListPublicCoursesQuery();
  const navigate = useNavigateWithTransition();

  const sections = useMemo(() => groupBySemester(courses ?? []), [courses]);
  const openCourse = (course: CourseDto) => navigate(`/courses/${course.id}`);

  return (
    <Box flex={{ direction: 'col', gap: 32 }} padding={{ base: 32 }}>
      <Text textColor={{ color: 'surface', intensity: 950 }} as="h1" className="text-3xl font-bold">
        Classes
      </Text>

      {isLoading ? (
        <Box flex={{ justify: 'center' }} padding={{ base: 32 }}>
          <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
        </Box>
      ) : sections.length === 0 ? (
        <Text textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
          No classes are open for browsing right now - check back soon.
        </Text>
      ) : (
        sections.map((section) => (
          <Box key={section.semesterId} flex={{ direction: 'col', gap: 16 }}>
            <Box flex={{ direction: 'col', gap: 4 }}>
              <Box flex={{ direction: 'row', align: 'center', gap: 10 }}>
                <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="text-xl font-bold">
                  {section.semesterName}
                </Text>
                <Pill color={{ color: section.status === 'enrolling' ? 'primary' : 'surface', intensity: section.status === 'enrolling' ? 500 : 300 }}>
                  {STATUS_LABEL[section.status]}
                </Pill>
              </Box>
              {section.startDate && section.endDate ? (
                <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
                  {formatDateRange(section.startDate, section.endDate)}
                </Text>
              ) : null}
            </Box>

            <Box className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {section.courses.map((course) => (
                <CourseTile key={course.id} course={course} onOpen={openCourse} />
              ))}
            </Box>
          </Box>
        ))
      )}
    </Box>
  );
};

export default CourseBrowsePage;

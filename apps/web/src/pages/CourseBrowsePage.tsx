import { useMemo, useState } from 'react';
import { Banner, Box, Icon, Loader, Pill, Text, useNavigateWithTransition } from '@inithium/ui';
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
  readonly registrationOpensAt?: string;
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
      registrationOpensAt: course.semesterRegistrationOpensAt,
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
  const { data: courses, isLoading } = useListPublicCoursesQuery();
  const navigate = useNavigateWithTransition();

  const sections = useMemo(() => groupBySemester(courses ?? []), [courses]);
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
      <Text textColor={{ color: 'surface', intensity: 950 }} as="h1" className="text-3xl font-bold">
        Find a class that's right for you
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
        sections.map((section) => {
          const isExpanded = expandedSemesterIds.has(section.semesterId);
          const isEnrolling = section.status === 'enrolling';
          return (
            <Box
              key={section.semesterId}
              borderColor={{ color: isEnrolling ? 'primary' : 'surface', intensity: isEnrolling ? 400 : 300 }}
              bgColor={{ color: 'surface', intensity: 200 }}
              className="overflow-hidden rounded-xl border shadow-sm transition-shadow duration-200 hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => toggleSemester(section.semesterId)}
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
                    {section.semesterName}
                  </Text>
                  <Pill color={{ color: isEnrolling ? 'primary' : 'surface', intensity: isEnrolling ? 500 : 300 }}>
                    {buildStatusLabel(section.status, section.registrationOpensAt)}
                  </Pill>
                  <Text as="span" textColor={{ color: 'surface', intensity: 500 }} className="ml-auto text-sm">
                    {section.courses.length} class{section.courses.length === 1 ? '' : 'es'}
                  </Text>
                </Box>
                {section.startDate && section.endDate ? (
                  <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="pl-7 text-sm">
                    {formatDateRange(section.startDate, section.endDate)}
                  </Text>
                ) : null}
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

import { Avatar, Box, Loader, Text, useNavigateWithTransition } from '@inithium/ui';
import { useGetPublicStaffMemberQuery, useListPublicClassesQuery, useListPublicWorkshopsQuery, usePageParams } from '@inithium/api-client';
import type { ClassDto, WorkshopDto } from '@inithium/api-client';
import type { DayOfWeek } from '@inithium/db';
import { NotFoundPage } from './NotFoundPage';

const DAY_ABBREVIATIONS: Record<DayOfWeek, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

const formatTime12h = (time: string): string => {
  const [hoursRaw, minutes] = time.split(':');
  const hours = Number(hoursRaw);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${minutes} ${period}`;
};

const formatClassSchedule = (classItem: ClassDto): string => {
  const days = classItem.daysOfWeek.map((day) => DAY_ABBREVIATIONS[day]).join('/');
  return `${days} · ${formatTime12h(classItem.startTime)} – ${formatTime12h(classItem.endTime)}`;
};

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatWorkshopDates = (workshop: WorkshopDto): string => {
  if (workshop.occurrences.length === 0) return 'Dates to be announced';
  const first = workshop.occurrences[0];
  const last = workshop.occurrences[workshop.occurrences.length - 1];
  return first.date === last.date ? dateFormatter.format(new Date(first.date)) : `${dateFormatter.format(new Date(first.date))} – ${dateFormatter.format(new Date(last.date))}`;
};

const fullNameOf = (firstName: string, lastName?: string): string => (lastName ? `${firstName} ${lastName}` : firstName);

interface TeachingRowProps {
  readonly title: string;
  readonly subtitle: string;
  readonly onOpen: () => void;
}

// Deliberately a compact, single-line-per-offering list rather than the full variant/workshop
// cards CourseDetailPage/WorkshopsPage already render - this page's job is "here's what they
// teach, go look at the real listing for schedule/price/registration," not a second copy of that
// UI. Keeps an instructor who teaches many sections from turning this page into clutter.
const TeachingRow = ({ title, subtitle, onOpen }: TeachingRowProps) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onOpen}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpen();
      }
    }}
    className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-surface-300 bg-surface-100 px-4 py-3 transition-colors hover:bg-surface-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
  >
    <Box flex={{ direction: 'col' }} className="min-w-0">
      <Text as="p" textColor={{ color: 'surface', intensity: 950 }} className="truncate text-sm font-semibold">
        {title}
      </Text>
      <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="truncate text-xs">
        {subtitle}
      </Text>
    </Box>
  </div>
);

export const StaffDetailPage = () => {
  const { staffId } = usePageParams();
  const navigate = useNavigateWithTransition();

  const { data: member, isLoading: isLoadingMember, isError } = useGetPublicStaffMemberQuery(staffId, { skip: !staffId });
  const { data: classes, isLoading: isLoadingClasses } = useListPublicClassesQuery(staffId ? { instructorId: staffId } : undefined, {
    skip: !staffId,
  });
  const { data: workshops, isLoading: isLoadingWorkshops } = useListPublicWorkshopsQuery(staffId ? { instructorId: staffId } : undefined, {
    skip: !staffId,
  });

  if (isLoadingMember) {
    return (
      <Box flex={{ justify: 'center' }} padding={{ base: 64 }}>
        <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
      </Box>
    );
  }

  if (isError || !member) {
    return <NotFoundPage />;
  }

  const name = fullNameOf(member.firstName, member.lastName);
  const isLoadingTeaching = isLoadingClasses || isLoadingWorkshops;
  const hasTeaching = (classes?.length ?? 0) > 0 || (workshops?.length ?? 0) > 0;

  return (
    <Box flex={{ direction: 'col', gap: 32 }} padding={{ base: 32 }} className="mx-auto w-full max-w-3xl">
      <Box flex={{ direction: 'row', gap: 20, align: 'center' }} className="flex-wrap">
        {member.photoUrl ? (
          <img src={member.photoUrl} alt={name} className="h-32 w-32 shrink-0 rounded-full object-cover" />
        ) : (
          <Avatar
            source={{ variant: 'initials', name }}
            size={128}
            styleConfig={{ bgColor: { color: 'primary', intensity: 500 }, shape: 'circle' }}
          />
        )}
        <Box flex={{ direction: 'col', gap: 4 }}>
          <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-3xl font-bold">
            {name}
          </Text>
          <Text as="p" textColor={{ color: 'primary', intensity: 600 }} className="text-sm font-semibold uppercase tracking-wide">
            {member.title}
          </Text>
        </Box>
      </Box>

      {member.bio ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="whitespace-pre-line text-sm">
          {member.bio}
        </Text>
      ) : null}

      {isLoadingTeaching ? (
        <Box flex={{ justify: 'center' }} padding={{ base: 16 }}>
          <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
        </Box>
      ) : hasTeaching ? (
        <Box flex={{ direction: 'col', gap: 20 }}>
          <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="text-xl font-bold">
            What {member.firstName} Teaches
          </Text>

          {classes && classes.length > 0 ? (
            <Box flex={{ direction: 'col', gap: 8 }}>
              <Text as="h3" textColor={{ color: 'surface', intensity: 700 }} className="text-xs font-semibold uppercase tracking-wide">
                Classes
              </Text>
              {classes.map((classItem) => (
                <TeachingRow
                  key={classItem.id}
                  title={`${classItem.courseName}${classItem.variantLabel ? ` - ${classItem.variantLabel}` : ''}`}
                  subtitle={formatClassSchedule(classItem)}
                  onOpen={() => navigate(`/courses/${classItem.courseId}`)}
                />
              ))}
            </Box>
          ) : null}

          {workshops && workshops.length > 0 ? (
            <Box flex={{ direction: 'col', gap: 8 }}>
              <Text as="h3" textColor={{ color: 'surface', intensity: 700 }} className="text-xs font-semibold uppercase tracking-wide">
                Workshops
              </Text>
              {workshops.map((workshop) => (
                <TeachingRow
                  key={workshop.id}
                  title={workshop.name}
                  subtitle={formatWorkshopDates(workshop)}
                  onOpen={() => navigate('/workshops')}
                />
              ))}
            </Box>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
};

export default StaffDetailPage;

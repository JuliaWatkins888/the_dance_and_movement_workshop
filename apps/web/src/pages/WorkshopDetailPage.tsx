import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { alert, Box, Breadcrumbs, Button, Divider, Loader, Pill, Text, useNavigateWithTransition } from '@inithium/ui';
import {
  WORKSHOP_SOURCE_TYPE,
  readApiError,
  toWorkshopLineOptions,
  useAddCartLineMutation,
  useGetWorkshopBySlugQuery,
  useListEligibleWorkshopAttendeesQuery,
} from '@inithium/api-client';
import type { PublicWorkshopDayDto, PublicWorkshopDto, WorkshopInstructorDto } from '@inithium/api-client';
import { useCurrentUser } from '../app/useCurrentUser';
import { loginPathFor } from './ecommerce/SignInPrompt';
import { LEVEL_LABELS, formatAgeRange, formatCents, formatTime12h, formatTimeRange } from './classes/classFormat';
import { ProgramBanner } from './classes/ProgramBanner';
import { AttendeeChoices, ChoiceCard, DetailBlock, attendeeKeyOf } from './classes/registrationChoices';
import { useRouteSlug } from './classes/useRouteSlug';
import {
  formatDateSpan,
  formatDayCount,
  formatDayLong,
  formatDayShort,
  formatWorkshopInstructors,
  hasFullWorkshopDiscount,
  selectionPriceCents,
} from './workshops/workshopFormat';

const ALERT_POSITION = 'bottom-right' as const;

const formatSpots = (day: PublicWorkshopDayDto): string =>
  day.openings <= 0 ? 'Full' : `${day.openings} spot${day.openings === 1 ? '' : 's'} left`;

// The contact page reads these to prefill its form - the admin decides whether to add room.
const requestSpotPath = (workshop: PublicWorkshopDto, fullDays: PublicWorkshopDayDto[], dancerName: string | undefined): string => {
  const days = fullDays.map((day) => formatDayShort(day.date)).join(', ');
  const params = new URLSearchParams({
    subject: `Additional spot request: ${workshop.title}`,
    message: `Hello! ${workshop.title} is showing as full on ${days}. I'd like to request an additional spot for ${dancerName ?? 'my dancer'}. Please let me know if room can be made. Thank you!`,
  });
  return `/contact?${params}`;
};

const InstructorCard = ({ instructor }: { instructor: WorkshopInstructorDto }) => (
  <Box flex={{ direction: 'row', gap: 12, align: 'start' }}>
    {instructor.photoUrl ? (
      <img src={instructor.photoUrl} alt={instructor.name} className="h-16 w-16 shrink-0 rounded-full object-cover" />
    ) : null}
    <Box flex={{ direction: 'col', gap: 2 }} className="min-w-0">
      <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
        {instructor.name}
      </Text>
      <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
        {instructor.isGuest ? 'Guest instructor' : instructor.title}
      </Text>
      {instructor.bio ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="whitespace-pre-line pt-1 text-sm">
          {instructor.bio}
        </Text>
      ) : null}
    </Box>
  </Box>
);

const ScheduleDay = ({ day }: { day: PublicWorkshopDayDto }) => (
  <Box flex={{ direction: 'col', gap: 4 }} borderColor={{ color: 'surface', intensity: 300 }} className="rounded-lg border p-4">
    <Box flex={{ direction: 'row', justify: 'between', align: 'baseline', gap: 8 }} className="flex-wrap">
      <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
        {formatDayLong(day.date)}
      </Text>
      <Text as="span" textColor={{ color: 'surface', intensity: 800 }} className="text-sm font-medium">
        {formatTimeRange(day.startTime, day.endTime)}
      </Text>
    </Box>
    {day.agenda ? (
      <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="whitespace-pre-line text-sm">
        {day.agenda}
      </Text>
    ) : null}
  </Box>
);

export const WorkshopDetailPage = () => {
  const slug = useRouteSlug('/workshops/');
  const { data: workshop, isLoading, isError } = useGetWorkshopBySlugQuery(slug ?? '', { skip: !slug });
  const [selectedDayIds, setSelectedDayIds] = useState<string[]>([]);
  const [selectedAttendeeKey, setSelectedAttendeeKey] = useState<string | undefined>(undefined);
  const { currentUser } = useCurrentUser();
  const navigate = useNavigateWithTransition();
  const location = useLocation();
  const [addCartLine, { isLoading: isAdding }] = useAddCartLineMutation();

  const isOpen = workshop?.status === 'open';
  const { data: attendees = [], isFetching: isLoadingAttendees } = useListEligibleWorkshopAttendeesQuery(workshop?.id ?? '', {
    skip: !currentUser || !workshop || !isOpen,
  });
  const selectedAttendee = attendees.find((attendee) => attendeeKeyOf(attendee) === selectedAttendeeKey);

  // Keeps a still-eligible pick; preselects the only choice.
  useEffect(() => {
    setSelectedAttendeeKey((current) =>
      attendees.some((attendee) => attendeeKeyOf(attendee) === current)
        ? current
        : attendees.length === 1 && attendees[0]
          ? attendeeKeyOf(attendees[0])
          : undefined,
    );
  }, [attendees]);

  // Drops any picked day that has since filled up (e.g. after a refetch).
  useEffect(() => {
    if (!workshop) return;
    setSelectedDayIds((current) => current.filter((id) => workshop.days.some((day) => day.id === id && day.openings > 0)));
  }, [workshop]);

  if (isLoading) {
    return (
      <Box flex={{ justify: 'center' }} padding={{ base: 48 }}>
        <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
      </Box>
    );
  }

  if (!workshop || isError) {
    return (
      <Box flex={{ direction: 'col', align: 'start', gap: 12 }} padding={{ base: 32 }}>
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
          Workshop not found
        </Text>
        <Button asChild variant={{ kind: 'outlined', color: 'primary' }}>
          <Link to="/workshops">Browse all workshops</Link>
        </Button>
      </Box>
    );
  }

  const currentPath = `${location.pathname}${location.search}`;
  const openDays = workshop.days.filter((day) => day.openings > 0);
  const fullDays = workshop.days.filter((day) => day.openings <= 0);
  const canSelectAll = openDays.length === workshop.days.length;
  const allSelected = selectedDayIds.length === workshop.days.length;
  const fullPriceCents = workshop.pricePerDayCents * selectedDayIds.length;
  const totalCents = selectionPriceCents(workshop, selectedDayIds.length);
  const firstDay = workshop.days[0];

  const toggleDay = (dayId: string) =>
    setSelectedDayIds((current) => (current.includes(dayId) ? current.filter((id) => id !== dayId) : [...current, dayId]));

  const handleAddToCart = async () => {
    if (!currentUser) {
      navigate(loginPathFor(currentPath));
      return;
    }
    if (selectedDayIds.length === 0 || !selectedAttendee) return;
    try {
      await addCartLine({
        sourceType: WORKSHOP_SOURCE_TYPE,
        sourceId: workshop.id,
        options: toWorkshopLineOptions(selectedAttendee, workshop, selectedDayIds),
        quantity: 1,
      }).unwrap();
      alert.success(`${workshop.title} for ${selectedAttendee.name} added to your cart.`, { position: ALERT_POSITION });
      setSelectedDayIds([]);
    } catch (error) {
      alert.danger(readApiError(error, 'Could not add this workshop to your cart.').message, { position: ALERT_POSITION });
    }
  };

  const renderAction = () => {
    if (!currentUser) {
      return (
        <Button
          variant={{ kind: 'filled', color: 'primary' }}
          className="w-full"
          onClick={handleAddToCart}
          disabled={openDays.length === 0}
        >
          Log in to register
        </Button>
      );
    }
    return (
      <Button
        variant={{ kind: 'filled', color: 'primary' }}
        className="w-full"
        onClick={handleAddToCart}
        disabled={isAdding || selectedDayIds.length === 0 || !selectedAttendee}
      >
        {isAdding
          ? 'Adding…'
          : selectedDayIds.length === 0
            ? 'Choose at least one day'
            : !selectedAttendee
              ? 'Choose a dancer'
              : 'Add to cart'}
      </Button>
    );
  };

  const renderAttendees = () => {
    if (!currentUser) {
      return (
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
          Log in to choose which dancer to register.
        </Text>
      );
    }
    if (isLoadingAttendees && attendees.length === 0) {
      return <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />;
    }
    if (attendees.length === 0) {
      return (
        <Box flex={{ direction: 'col', align: 'start', gap: 6 }}>
          <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
            None of your dancers are in this workshop’s age range ({formatAgeRange(workshop.minAgeYears, workshop.maxAgeYears)}).
          </Text>
          <Link to={`/profile/${currentUser.id}?tab=child-accounts`} className="text-sm font-medium text-primary-600 hover:underline">
            Add a child profile
          </Link>
        </Box>
      );
    }
    return <AttendeeChoices attendees={attendees} selectedKey={selectedAttendeeKey} onSelect={setSelectedAttendeeKey} />;
  };

  const renderRegistration = () => {
    if (workshop.status !== 'open') {
      return (
        <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
          {workshop.status === 'past'
            ? 'This workshop has ended. Keep an eye on our Workshops page for upcoming ones!'
            : 'This workshop is underway, so registration has closed.'}
        </Text>
      );
    }

    return (
      <>
        <DetailBlock title="1. Choose your days">
          <Box flex={{ direction: 'col', gap: 8 }}>
            {workshop.days.length > 1 && canSelectAll ? (
              <Box
                flex={{
                  direction: 'row',
                  justify: 'between',
                  align: 'center',
                  gap: 8,
                }}
                className="flex-wrap"
              >
                <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
                  {hasFullWorkshopDiscount(workshop)
                    ? `Save ${workshop.fullWorkshopDiscountPercent}% when you join all ${workshop.days.length} days.`
                    : `Join one day or all ${workshop.days.length}.`}
                </Text>
                <Button
                  variant={{ kind: 'ghost', color: 'primary' }}
                  onClick={() => setSelectedDayIds(allSelected ? [] : workshop.days.map((day) => day.id))}
                >
                  {allSelected ? 'Clear' : 'Select all days'}
                </Button>
              </Box>
            ) : null}
            <div role="group" aria-label="Workshop days" className="flex flex-col gap-2">
              {workshop.days.map((day) => (
                <ChoiceCard
                  key={day.id}
                  type="checkbox"
                  name="day"
                  value={day.id}
                  checked={selectedDayIds.includes(day.id)}
                  disabled={day.openings <= 0}
                  onSelect={toggleDay}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
                      {formatDayLong(day.date)}
                    </Text>
                    <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
                      {formatCents(workshop.pricePerDayCents)}
                    </Text>
                  </span>
                  <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
                    {formatTimeRange(day.startTime, day.endTime)}
                  </Text>
                  <Text
                    as="span"
                    textColor={day.openings <= 0 ? { color: 'red', intensity: 600 } : { color: 'surface', intensity: 600 }}
                    className="text-xs font-medium"
                  >
                    {formatSpots(day)}
                  </Text>
                </ChoiceCard>
              ))}
            </div>
          </Box>
        </DetailBlock>

        <Divider />

        <DetailBlock title="2. Who’s dancing?">{renderAttendees()}</DetailBlock>

        <Divider />

        <DetailBlock title="3. Total">
          <Box flex={{ direction: 'col', gap: 4 }}>
            <Box flex={{ direction: 'row', justify: 'between', gap: 8 }}>
              <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
                {formatDayCount(selectedDayIds.length)} × {formatCents(workshop.pricePerDayCents)}
              </Text>
              <Text as="span" textColor={{ color: 'surface', intensity: 800 }} className="text-sm tabular-nums">
                {formatCents(fullPriceCents)}
              </Text>
            </Box>
            {allSelected && totalCents < fullPriceCents ? (
              <Box flex={{ direction: 'row', justify: 'between', gap: 8 }}>
                <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
                  Whole-workshop discount ({workshop.fullWorkshopDiscountPercent}%)
                </Text>
                <Text as="span" textColor={{ color: 'surface', intensity: 800 }} className="text-sm tabular-nums">
                  −{formatCents(fullPriceCents - totalCents)}
                </Text>
              </Box>
            ) : null}
            <Box flex={{ direction: 'row', justify: 'between', gap: 8 }} className="pt-1">
              <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
                Total
              </Text>
              <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold tabular-nums">
                {formatCents(totalCents)}
              </Text>
            </Box>
          </Box>
          {firstDay ? (
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
              Paid once at checkout. Registration closes when the workshop begins on {formatDayShort(firstDay.date)} at{' '}
              {formatTime12h(firstDay.startTime)}.
            </Text>
          ) : null}
        </DetailBlock>

        {renderAction()}
        {fullDays.length > 0 ? (
          <Box flex={{ direction: 'col', gap: 6 }}>
            <Button
              variant={{ kind: 'outlined', color: 'primary' }}
              className="w-full"
              onClick={() => navigate(requestSpotPath(workshop, fullDays, selectedAttendee?.name))}
            >
              Request an additional spot
            </Button>
            <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
              {fullDays.length === workshop.days.length ? 'Every day is full.' : 'Some days are full.'} Send the studio a request and
              they’ll let you know if they can make room.
            </Text>
          </Box>
        ) : null}
      </>
    );
  };

  return (
    <Box flex={{ direction: 'col' }} className="w-full">
      <ProgramBanner
        program={{
          id: workshop.id,
          name: workshop.title,
          imageUrl: workshop.imageUrl,
          banner: workshop.banner,
        }}
      />

      <Box flex={{ direction: 'col', gap: 24 }} padding={{ base: 32 }} className="mx-auto w-full max-w-5xl">
        <Breadcrumbs items={[{ label: 'Workshops', to: '/workshops' }, { label: workshop.title }]} />

        <Box flex={{ direction: 'col', gap: 8 }}>
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm font-semibold uppercase tracking-wide">
            {formatDateSpan(workshop.days)} · {formatDayCount(workshop.days.length)}
          </Text>
          <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-3xl font-bold">
            {workshop.title}
          </Text>
          <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
            with {formatWorkshopInstructors(workshop.instructors)}
          </Text>
          <Box flex={{ direction: 'row', gap: 6, align: 'center' }} className="flex-wrap">
            <Pill color={{ color: 'primary', intensity: 500 }} className="text-primary-foreground-500">
              {formatAgeRange(workshop.minAgeYears, workshop.maxAgeYears)}
            </Pill>
            {workshop.level ? (
              <Pill color={{ color: 'surface', intensity: 300 }} className="text-surface-950">
                {LEVEL_LABELS[workshop.level]}
              </Pill>
            ) : null}
            {workshop.styles.map((style) => (
              <Pill key={style} color={{ color: 'secondary', intensity: 500 }} className="text-secondary-foreground-500">
                {style}
              </Pill>
            ))}
          </Box>
        </Box>

        <Box className="grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr]">
          <Box flex={{ direction: 'col', gap: 20 }}>
            {workshop.description ? (
              <Text as="p" textColor={{ color: 'surface', intensity: 800 }} className="whitespace-pre-line">
                {workshop.description}
              </Text>
            ) : null}
            <DetailBlock title="Schedule">
              <Box flex={{ direction: 'col', gap: 8 }}>
                {workshop.days.map((day) => (
                  <ScheduleDay key={day.id} day={day} />
                ))}
              </Box>
            </DetailBlock>
            {workshop.instructors.length > 0 ? (
              <DetailBlock title={workshop.instructors.length === 1 ? 'Instructor' : 'Instructors'}>
                <Box flex={{ direction: 'col', gap: 16 }}>
                  {workshop.instructors.map((instructor, index) => (
                    <InstructorCard key={`${instructor.name}-${index}`} instructor={instructor} />
                  ))}
                </Box>
              </DetailBlock>
            ) : null}
            {workshop.dressCode ? (
              <DetailBlock title="Dress code">
                <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="whitespace-pre-line text-sm">
                  {workshop.dressCode}
                </Text>
              </DetailBlock>
            ) : null}
          </Box>

          <Box
            flex={{ direction: 'col', gap: 20 }}
            bgColor={{ color: 'surface', intensity: 100 }}
            borderColor={{ color: 'surface', intensity: 300 }}
            className="h-fit rounded-lg border p-5"
          >
            {renderRegistration()}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default WorkshopDetailPage;

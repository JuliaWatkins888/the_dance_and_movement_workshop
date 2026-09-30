import { Link } from 'react-router-dom';
import { alert, Box, Button, dialog, Divider, Loader, Pill, Text } from '@inithium/ui';
import {
  formatDate,
  formatMoney,
  readApiError,
  useCancelClassRegistrationMutation,
  useGetStoreConfigQuery,
  useListMyClassRegistrationsQuery,
  useListMyWorkshopRegistrationsQuery,
} from '@inithium/api-client';
import type { ClassRegistrationDto, WorkshopRegistrationDto } from '@inithium/api-client';
import { formatDays, formatTimeRange } from '../../classes/classFormat';
import { formatDateSpan, formatDayShort } from '../../workshops/workshopFormat';
import type { ProfileTabDescriptor, ProfileTabProps } from './registry';

const ALERT_POSITION = 'bottom-right' as const;

const isCurrent = (registration: ClassRegistrationDto): boolean => registration.status !== 'ended';

const planSummary = (registration: ClassRegistrationDto, currency: string | undefined): string => {
  if (registration.plan === 'semester') return `${registration.semesterName ?? 'Semester'} · paid in full`;
  if (registration.plan === 'year') return `${registration.schoolYearName ?? 'Full year'} · paid in full`;
  const amount = registration.monthlyAmountCents !== undefined && currency ? `${formatMoney(registration.monthlyAmountCents, currency)}/month` : 'Monthly';
  return registration.nextBillingAt ? `${amount} · next charge ${formatDate(registration.nextBillingAt)}` : amount;
};

const StatusPill = ({ registration }: { readonly registration: ClassRegistrationDto }) => {
  if (registration.status === 'ended') {
    return (
      <Pill color={{ color: 'surface', intensity: 300 }} className="text-surface-800">
        Ended
      </Pill>
    );
  }
  if (registration.status === 'withdrawn') {
    return (
      <Pill color={{ color: 'surface', intensity: 300 }} className="text-surface-900">
        Cancelled
      </Pill>
    );
  }
  if (registration.isPastDue) {
    return (
      <Pill color={{ color: 'surface', intensity: 800 }} className="text-surface-100">
        Payment issue
      </Pill>
    );
  }
  return (
    <Pill color={{ color: 'primary', intensity: 500 }} className="text-primary-foreground-500">
      Active
    </Pill>
  );
};

const RegistrationRow = ({ registration, currency }: { readonly registration: ClassRegistrationDto; readonly currency?: string }) => {
  const [cancelRegistration, { isLoading: isCancelling }] = useCancelClassRegistrationMutation();
  const courseName = registration.course?.name ?? 'Class';

  const handleCancel = async () => {
    const confirmed = await dialog.confirm({
      title: 'Cancel this monthly registration?',
      description: `${registration.attendee.name} can keep attending ${courseName} through the month you’ve already paid for. No further monthly charges will be made. This can’t be undone.`,
      confirmLabel: 'Cancel registration',
      cancelLabel: 'Keep it',
      confirmVariant: { kind: 'filled', color: 'red' },
    });
    if (!confirmed) return;
    try {
      await cancelRegistration(registration.id).unwrap();
      alert.success(`${courseName} for ${registration.attendee.name} has been cancelled.`, { position: ALERT_POSITION });
    } catch (error) {
      alert.danger(readApiError(error, 'Could not cancel this registration.').message, { position: ALERT_POSITION });
    }
  };

  return (
    <Box flex={{ direction: 'row', align: 'start', gap: 16 }} padding={{ top: 16, bottom: 16 }} className="flex-wrap sm:flex-nowrap">
      <Box flex={{ direction: 'col', gap: 4 }} className="min-w-0 flex-1">
        {registration.course ? (
          <Link
            to={`/classes/${registration.course.slug}`}
            className="truncate font-semibold text-surface-950 underline-offset-4 hover:text-accent-500 hover:underline"
          >
            {courseName}
          </Link>
        ) : (
          <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
            {courseName}
          </Text>
        )}
        <Text as="span" textColor={{ color: 'surface', intensity: 800 }} className="text-sm">
          {registration.attendee.name}
          {registration.section
            ? ` · ${formatDays(registration.section.daysOfWeek)} · ${formatTimeRange(registration.section.startTime, registration.section.endTime)}`
            : ''}
        </Text>
        <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
          {planSummary(registration, currency)}
        </Text>
        {registration.status === 'withdrawn' && registration.accessEndsAt ? (
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
            Attending through {formatDate(new Date(new Date(registration.accessEndsAt).getTime() - 1).toISOString())}
          </Text>
        ) : null}
        {registration.isPastDue ? (
          <Text as="span" textColor={{ color: 'surface', intensity: 800 }} className="text-xs font-medium">
            The last monthly charge didn’t go through. Please update your card or contact the studio.
          </Text>
        ) : null}
      </Box>
      <Box flex={{ direction: 'row', align: 'center', gap: 12 }} className="shrink-0">
        <StatusPill registration={registration} />
        {registration.canCancel ? (
          <Button variant={{ kind: 'outlined', color: 'surface' }} onClick={handleCancel} disabled={isCancelling}>
            {isCancelling ? 'Cancelling…' : 'Cancel'}
          </Button>
        ) : null}
      </Box>
    </Box>
  );
};

const WORKSHOP_STATUS_LABELS: Record<WorkshopRegistrationDto['status'], string> = {
  upcoming: 'Upcoming',
  in_progress: 'In progress',
  ended: 'Ended',
};

const workshopDaysSummary = (registration: WorkshopRegistrationDto): string => {
  if (registration.days.length === 1 && registration.days[0]) {
    const day = registration.days[0];
    return `${formatDayShort(day.date)} · ${formatTimeRange(day.startTime, day.endTime)}`;
  }
  const span = formatDateSpan(registration.days);
  return registration.isFullWorkshop ? `All ${registration.days.length} days · ${span}` : registration.days.map((day) => formatDayShort(day.date)).join(', ');
};

// Paid in full at checkout, so there's nothing to cancel here.
const WorkshopRegistrationRow = ({ registration }: { readonly registration: WorkshopRegistrationDto }) => {
  const title = registration.workshop?.title ?? 'Workshop';
  return (
    <Box flex={{ direction: 'row', align: 'start', gap: 16 }} padding={{ top: 16, bottom: 16 }} className="flex-wrap sm:flex-nowrap">
      <Box flex={{ direction: 'col', gap: 4 }} className="min-w-0 flex-1">
        {registration.workshop ? (
          <Link
            to={`/workshops/${registration.workshop.slug}`}
            className="truncate font-semibold text-surface-950 underline-offset-4 hover:text-accent-500 hover:underline"
          >
            {title}
          </Link>
        ) : (
          <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-semibold">
            {title}
          </Text>
        )}
        <Text as="span" textColor={{ color: 'surface', intensity: 800 }} className="text-sm">
          {registration.attendee.name}
          {registration.days.length > 0 ? ` · ${workshopDaysSummary(registration)}` : ''}
        </Text>
        <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
          Workshop · paid in full
        </Text>
      </Box>
      <Box flex={{ direction: 'row', align: 'center', gap: 12 }} className="shrink-0">
        {registration.status === 'ended' ? (
          <Pill color={{ color: 'surface', intensity: 300 }} className="text-surface-800">
            {WORKSHOP_STATUS_LABELS.ended}
          </Pill>
        ) : (
          <Pill color={{ color: 'primary', intensity: 500 }} className="text-primary-foreground-500">
            {WORKSHOP_STATUS_LABELS[registration.status]}
          </Pill>
        )}
      </Box>
    </Box>
  );
};

type RegistrationEntry =
  | { readonly kind: 'class'; readonly registration: ClassRegistrationDto }
  | { readonly kind: 'workshop'; readonly registration: WorkshopRegistrationDto };

const RegistrationGroup = ({
  title,
  entries,
  currency,
}: {
  readonly title: string;
  readonly entries: RegistrationEntry[];
  readonly currency?: string;
}) => (
  <Box flex={{ direction: 'col', gap: 4 }}>
    <Text as="h3" textColor={{ color: 'surface', intensity: 700 }} className="text-sm font-semibold uppercase tracking-wide">
      {title}
    </Text>
    <Box>
      {entries.map((entry, index) => (
        <Box key={`${entry.kind}:${entry.registration.id}`}>
          {index > 0 ? <Divider color={{ color: 'surface', intensity: 300 }} /> : null}
          {entry.kind === 'class' ? (
            <RegistrationRow registration={entry.registration} currency={currency} />
          ) : (
            <WorkshopRegistrationRow registration={entry.registration} />
          )}
        </Box>
      ))}
    </Box>
  </Box>
);

// Every class and workshop the account's dancers are (or were) registered for. Monthly class plans
// that are still renewing can be cancelled here; everything else is paid in full and can't be.
const RegistrationsTab = (_props: ProfileTabProps) => {
  const { data: registrations = [], isLoading: isLoadingClasses } = useListMyClassRegistrationsQuery();
  const { data: workshopRegistrations = [], isLoading: isLoadingWorkshops } = useListMyWorkshopRegistrationsQuery();
  const { data: storeConfig } = useGetStoreConfigQuery();
  const isLoading = isLoadingClasses || isLoadingWorkshops;

  if (isLoading) {
    return (
      <Box flex={{ justify: 'center' }} padding={{ base: 32 }}>
        <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
      </Box>
    );
  }

  if (registrations.length === 0 && workshopRegistrations.length === 0) {
    return (
      <Box flex={{ direction: 'col', align: 'center', gap: 12 }} padding={{ base: 24 }}>
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-center">
          You haven’t registered for any classes or workshops yet.
        </Text>
        <Box flex={{ direction: 'row', gap: 8 }} className="flex-wrap justify-center">
          <Button asChild variant={{ kind: 'outlined', color: 'primary' }}>
            <Link to="/classes">Browse classes</Link>
          </Button>
          <Button asChild variant={{ kind: 'outlined', color: 'primary' }}>
            <Link to="/workshops">Browse workshops</Link>
          </Button>
        </Box>
      </Box>
    );
  }

  const entries: RegistrationEntry[] = [
    ...registrations.map((registration): RegistrationEntry => ({ kind: 'class', registration })),
    ...workshopRegistrations.map((registration): RegistrationEntry => ({ kind: 'workshop', registration })),
  ];
  const isCurrentEntry = (entry: RegistrationEntry): boolean =>
    entry.kind === 'class' ? isCurrent(entry.registration) : entry.registration.status !== 'ended';
  const current = entries.filter(isCurrentEntry);
  const past = entries.filter((entry) => !isCurrentEntry(entry));

  return (
    <Box flex={{ direction: 'col', gap: 24 }}>
      {current.length > 0 ? <RegistrationGroup title="Current" entries={current} currency={storeConfig?.currency} /> : null}
      {past.length > 0 ? <RegistrationGroup title="Past" entries={past} currency={storeConfig?.currency} /> : null}
    </Box>
  );
};

const registrationsTab: ProfileTabDescriptor = {
  id: 'registrations',
  label: 'Registrations',
  order: 12,
  visibility: 'owned',
  Component: RegistrationsTab,
};

export default registrationsTab;

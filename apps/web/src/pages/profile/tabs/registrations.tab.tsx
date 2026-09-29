import { Link } from 'react-router-dom';
import { alert, Box, Button, dialog, Divider, Loader, Pill, Text } from '@inithium/ui';
import {
  formatDate,
  formatMoney,
  readApiError,
  useCancelClassRegistrationMutation,
  useGetStoreConfigQuery,
  useListMyClassRegistrationsQuery,
} from '@inithium/api-client';
import type { ClassRegistrationDto } from '@inithium/api-client';
import { formatDays, formatTimeRange } from '../../classes/classFormat';
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

const RegistrationGroup = ({
  title,
  registrations,
  currency,
}: {
  readonly title: string;
  readonly registrations: ClassRegistrationDto[];
  readonly currency?: string;
}) => (
  <Box flex={{ direction: 'col', gap: 4 }}>
    <Text as="h3" textColor={{ color: 'surface', intensity: 700 }} className="text-sm font-semibold uppercase tracking-wide">
      {title}
    </Text>
    <Box>
      {registrations.map((registration, index) => (
        <Box key={registration.id}>
          {index > 0 ? <Divider color={{ color: 'surface', intensity: 300 }} /> : null}
          <RegistrationRow registration={registration} currency={currency} />
        </Box>
      ))}
    </Box>
  </Box>
);

// Every class the account's dancers are (or were) registered for. Monthly plans that are still
// renewing can be cancelled here; semester and full-year plans are paid in full and can't be.
const RegistrationsTab = (_props: ProfileTabProps) => {
  const { data: registrations = [], isLoading } = useListMyClassRegistrationsQuery();
  const { data: storeConfig } = useGetStoreConfigQuery();

  if (isLoading) {
    return (
      <Box flex={{ justify: 'center' }} padding={{ base: 32 }}>
        <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
      </Box>
    );
  }

  if (registrations.length === 0) {
    return (
      <Box flex={{ direction: 'col', align: 'center', gap: 12 }} padding={{ base: 24 }}>
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-center">
          You haven’t registered for any classes yet.
        </Text>
        <Button asChild variant={{ kind: 'outlined', color: 'primary' }}>
          <Link to="/classes">Browse classes</Link>
        </Button>
      </Box>
    );
  }

  const current = registrations.filter(isCurrent);
  const past = registrations.filter((registration) => !isCurrent(registration));

  return (
    <Box flex={{ direction: 'col', gap: 24 }}>
      {current.length > 0 ? <RegistrationGroup title="Current" registrations={current} currency={storeConfig?.currency} /> : null}
      {past.length > 0 ? <RegistrationGroup title="Past" registrations={past} currency={storeConfig?.currency} /> : null}
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

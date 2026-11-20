import { alert, Box, Button, dialog, Loader, Text } from '@inithium/ui';
import {
  CLASS_BILLING_MODE_LABELS,
  formatMoney,
  readApiError,
  useCancelDropInMutation,
  useListAccountClassCardsQuery,
  useListAccountClassRegistrationsQuery,
  useListAccountDropInsQuery,
  useWithdrawClassRegistrationMutation,
} from '@inithium/api-client';
import type { ClassRegistrationDto, DropInDto } from '@inithium/api-client';
import { DIALOG_WIDTH_WIDE, EmptyState, useStoreCurrency } from '../ecommerce/shared';
import { AccountClassCards } from './AccountClassCards';
import { formatCalendarDay, sectionLabel, SECTION_TITLE_CLASS } from './deskShared';

const ALERT_POSITION = 'bottom-right' as const;
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const formatDate = (iso: string): string => dateFormatter.format(new Date(iso));

const STATUS_LABELS: Record<ClassRegistrationDto['status'], string> = { active: 'Active', withdrawn: 'Withdrawn', ended: 'Ended' };

const withdrawDescription = (registration: ClassRegistrationDto): string =>
  registration.billingMode === 'ledger'
    ? `${registration.attendee.name} keeps attending through the end of the month already posted to the account, which stays owed. No later months are charged. To waive this month, void its tuition charge in Accounts.`
    : `Card billing stops now with no refund. ${registration.attendee.name} keeps attending through the period already paid for.`;

const RegistrationRow = ({ registration, currency }: { readonly registration: ClassRegistrationDto; readonly currency: string }) => {
  const [withdraw, { isLoading }] = useWithdrawClassRegistrationMutation();

  const confirmWithdraw = async () => {
    const confirmed = await dialog.confirm({
      title: `Withdraw ${registration.attendee.name} from ${registration.course?.name ?? 'this class'}?`,
      description: withdrawDescription(registration),
      confirmLabel: 'Withdraw',
      confirmVariant: { kind: 'filled', color: 'red', intensity: 600 },
    });
    if (!confirmed) return;
    try {
      await withdraw(registration.id).unwrap();
      alert.success('Withdrawn.', { position: ALERT_POSITION });
    } catch (error) {
      alert.danger(readApiError(error, 'Could not withdraw this registration.').message, { position: ALERT_POSITION });
    }
  };

  const facts = [
    CLASS_BILLING_MODE_LABELS[registration.billingMode],
    registration.plan !== 'monthly' ? (registration.semesterName ?? 'Full year') : undefined,
    registration.monthlyAmountCents !== undefined && registration.plan === 'monthly' ? `${formatMoney(registration.monthlyAmountCents, currency)}/month` : undefined,
    registration.nextBillingAt ? `next ${formatDate(registration.nextBillingAt)}` : undefined,
    registration.status === 'withdrawn' && registration.accessEndsAt ? `attends until ${formatDate(registration.accessEndsAt)}` : undefined,
  ].filter(Boolean);

  return (
    <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 12 }} borderColor={{ color: 'surface', intensity: 200 }} padding={{ base: 12 }} className="rounded border">
      <Box flex={{ direction: 'col' }}>
        <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
          {`${registration.attendee.name} · ${registration.course?.name ?? 'Class'}`}
        </Text>
        <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
          {[registration.section ? sectionLabel(registration.section) : undefined, registration.schoolYearName, STATUS_LABELS[registration.status]].filter(Boolean).join(' · ')}
        </Text>
        <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
          {facts.join(' · ')}
        </Text>
      </Box>
      {registration.canStaffWithdraw ? (
        <Button variant={{ kind: 'outlined', color: 'red' }} textColor={{ color: 'red', intensity: 600 }} onClick={confirmWithdraw} disabled={isLoading}>
          {isLoading ? 'Withdrawing…' : 'Withdraw'}
        </Button>
      ) : null}
    </Box>
  );
};

const DROP_IN_STATUS_LABELS = { upcoming: 'Upcoming', past: 'Past', cancelled: 'Cancelled' } as const;

const DropInRow = ({ dropIn }: { readonly dropIn: DropInDto }) => {
  const [cancel, { isLoading }] = useCancelDropInMutation();
  const classDate = formatCalendarDay(`${dropIn.classDate}T00:00:00.000Z`);

  const confirmCancel = async () => {
    const confirmed = await dialog.confirm({
      title: `Cancel ${dropIn.attendee.name}’s drop-in on ${classDate}?`,
      description:
        'The seat goes back to the class for that date. No money moves: refund the order, or void its charge in Accounts if it was paid in person.',
      confirmLabel: 'Cancel drop-in',
      cancelLabel: 'Keep it',
      confirmVariant: { kind: 'filled', color: 'red', intensity: 600 },
    });
    if (!confirmed) return;
    try {
      await cancel(dropIn.id).unwrap();
      alert.success('Drop-in cancelled.', { position: ALERT_POSITION });
    } catch (error) {
      alert.danger(readApiError(error, 'Could not cancel this drop-in.').message, { position: ALERT_POSITION });
    }
  };

  const status = dropIn.status === 'cancelled' ? 'cancelled' : dropIn.isPast ? 'past' : 'upcoming';
  return (
    <Box flex={{ direction: 'row', justify: 'between', align: 'center', gap: 12 }} borderColor={{ color: 'surface', intensity: 200 }} padding={{ base: 12 }} className="rounded border">
      <Box flex={{ direction: 'col' }}>
        <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
          {`${dropIn.attendee.name} · ${dropIn.course?.name ?? 'Class'}`}
        </Text>
        <Text as="span" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
          {[classDate, dropIn.section ? sectionLabel(dropIn.section) : undefined, DROP_IN_STATUS_LABELS[status]].filter(Boolean).join(' · ')}
        </Text>
      </Box>
      {dropIn.canStaffCancel ? (
        <Button variant={{ kind: 'outlined', color: 'red' }} textColor={{ color: 'red', intensity: 600 }} onClick={confirmCancel} disabled={isLoading}>
          {isLoading ? 'Cancelling…' : 'Cancel'}
        </Button>
      ) : null}
    </Box>
  );
};

const GroupTitle = ({ children }: { readonly children: string }) => (
  <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className={SECTION_TITLE_CLASS}>
    {children}
  </Text>
);

export const AccountRegistrationsPanel = ({ userId }: { readonly userId: string }) => {
  const currency = useStoreCurrency();
  const { data: registrations, isLoading, isError } = useListAccountClassRegistrationsQuery(userId);
  const { data: dropIns, isLoading: isLoadingDropIns, isError: isDropInsError } = useListAccountDropInsQuery(userId);
  const { data: classCards = [], isLoading: isLoadingCards } = useListAccountClassCardsQuery(userId);

  if (isLoading || isLoadingDropIns || isLoadingCards) {
    return (
      <Box flex={{ justify: 'center' }} padding={{ base: 32 }}>
        <Loader />
      </Box>
    );
  }
  if (isError || isDropInsError || !registrations || !dropIns) return <EmptyState message="Couldn’t load this account’s registrations." />;
  if (registrations.length === 0 && dropIns.length === 0 && classCards.length === 0) {
    return <EmptyState message="No class registrations, drop-ins, or class cards on this account." />;
  }

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      {registrations.length > 0 ? (
        <Box flex={{ direction: 'col', gap: 8 }}>
          <GroupTitle>Classes</GroupTitle>
          {registrations.map((registration) => (
            <RegistrationRow key={registration.id} registration={registration} currency={currency} />
          ))}
        </Box>
      ) : null}
      {dropIns.length > 0 ? (
        <Box flex={{ direction: 'col', gap: 8 }}>
          <GroupTitle>Drop-ins</GroupTitle>
          {dropIns.map((dropIn) => (
            <DropInRow key={dropIn.id} dropIn={dropIn} />
          ))}
        </Box>
      ) : null}
      {classCards.length > 0 ? (
        <Box flex={{ direction: 'col', gap: 8 }}>
          <GroupTitle>Class Cards</GroupTitle>
          <AccountClassCards cards={classCards} />
        </Box>
      ) : null}
    </Box>
  );
};

export const openAccountRegistrations = (userId: string, name: string): void => {
  dialog.show(() => <AccountRegistrationsPanel userId={userId} />, { title: `Registrations: ${name}`, width: DIALOG_WIDTH_WIDE });
};

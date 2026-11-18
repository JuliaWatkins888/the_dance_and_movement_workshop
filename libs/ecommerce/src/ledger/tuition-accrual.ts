import { logError } from '@inithium/api-utils';
import {
  getClassRegistrationRepository,
  getCourseRepository,
  getLedgerEntryRepository,
  ledgerTuitionAccessEndsAt,
  ledgerTuitionMonths,
} from '@inithium/db';
import type { ClassRegistrationEntity } from '@inithium/db';

const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const tuitionDescription = (courseName: string | undefined, attendeeName: string, monthStart: Date): string =>
  [`Tuition: ${courseName ?? 'Class'}`, monthFormatter.format(monthStart), attendeeName ? `for ${attendeeName}` : undefined]
    .filter(Boolean)
    .join(' · ');

// Posts every month a pay-in-person registration owes that isn't on the ledger yet. Returns how
// many charges it wrote.
const accrueRegistration = async (registration: ClassRegistrationEntity, now: Date): Promise<number> => {
  if (!registration.ledgerTerms) return 0;
  const due = ledgerTuitionMonths({
    terms: registration.ledgerTerms,
    startsAt: registration.startsAt,
    endsAt: registration.endsAt,
    ...(registration.withdrawnAt ? { withdrawnAt: registration.withdrawnAt } : {}),
    now,
  });

  const ledger = getLedgerEntryRepository();
  const billed = new Set(await ledger.findBilledMonths(registration.id));
  const missing = due.filter((month) => !billed.has(month.billingMonth));
  if (missing.length === 0) return 0;

  const course = await getCourseRepository().findById(registration.courseId);
  let written = 0;
  for (const month of missing) {
    // The unique (registrationId, billingMonth) key makes a concurrent accrual's duplicate a no-op.
    const created = await ledger.createTuitionCharge({
      userId: registration.userId,
      kind: 'charge',
      amountCents: month.amountCents,
      description: tuitionDescription(course?.name, registration.attendee.name, month.monthStart),
      category: 'tuition',
      ...(registration.attendee.type === 'child' ? { studentId: registration.attendee.childId } : {}),
      dueDate: month.monthStart,
      source: 'system',
      orderId: registration.orderId,
      registrationId: registration.id,
      billingMonth: month.billingMonth,
    });
    if (created) written += 1;
  }
  return written;
};

// There's no job runner (see libs/api-core/src/routes/time/timeSweep.ts), so monthly tuition for
// pay-in-person registrations is posted lazily whenever a ledger, a registration list or the CMS
// dashboard is read. Omit userId to catch up every account. Never throws: a read shouldn't fail
// because a charge couldn't be written, and the next read retries.
export const accrueLedgerTuition = async (userId?: string, now: Date = new Date()): Promise<number> => {
  try {
    const registrations = await getClassRegistrationRepository().findLedgerBilled(userId);
    let written = 0;
    for (const registration of registrations) {
      written += await accrueRegistration(registration, now);
    }
    return written;
  } catch (error) {
    logError(error);
    return 0;
  }
};

// Stops a pay-in-person monthly registration. Any month whose 1st has come stays owed and the
// dancer attends through it; nothing after it is charged. The seat frees once access ends.
export const withdrawLedgerRegistration = async (registration: ClassRegistrationEntity, now: Date): Promise<ClassRegistrationEntity> => {
  const repository = getClassRegistrationRepository();
  const updated =
    (await repository.update(registration.id, {
      status: 'withdrawn',
      withdrawnAt: now,
      accessEndsAt: ledgerTuitionAccessEndsAt(registration.startsAt, registration.endsAt, now),
    })) ?? registration;
  await accrueRegistration(updated, now);
  return updated;
};

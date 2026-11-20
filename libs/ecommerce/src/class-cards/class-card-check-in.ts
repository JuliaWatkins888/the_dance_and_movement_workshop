import { ConflictError, NotFoundError, ValidationError } from '@inithium/api-utils';
import {
  attendeeKey,
  checkDropInDate,
  dateKeyToUtc,
  findOverlappingRegistration,
  getClassCardRedemptionRepository,
  getClassCardRepository,
  getClassSectionRepository,
  getDropInRegistrationRepository,
  getTimeSettings,
  isSelfEnrollable,
  releaseExpiredClassSeats,
  zonedDateKey,
} from '@inithium/db';
import type { AttendeeRef, ClassAttendee, ClassCardEntity, ClassCardRedemptionEntity } from '@inithium/db';
import { loadSectionContext } from '../purchasables/class-section-context';

const DAY_MS = 86_400_000;
const DUPLICATE_KEY = 11000;

const isDuplicateKey = (error: unknown): boolean => (error as { code?: number } | null)?.code === DUPLICATE_KEY;

const toRef = (attendee: ClassAttendee): AttendeeRef =>
  attendee.type === 'self' ? { type: 'self' } : { type: 'child', childId: attendee.childId };

export interface RedeemClassCardInput {
  cardId: string;
  sectionId: string;
  // "YYYY-MM-DD"
  classDate: string;
}

export interface RedeemClassCardResult {
  card: ClassCardEntity;
  redemption: ClassCardRedemptionEntity;
}

// Staff checking an adult into a class with their card: takes one class off the card and holds a
// seat in the section on that date (the same per-date count drop-ins use).
export const redeemClassCard = async (input: RedeemClassCardInput, actorUserId: string, now: Date = new Date()): Promise<RedeemClassCardResult> => {
  const cards = getClassCardRepository();
  const card = await cards.findById(input.cardId);
  if (!card) throw NotFoundError('Class card not found');
  if (card.status !== 'active') throw ConflictError('This class card was cancelled.');
  if (card.classesUsed >= card.classesTotal) throw ConflictError('This class card has no classes left.');

  const context = await loadSectionContext(input.sectionId);
  if (!context) throw NotFoundError('Class not found');
  if (!isSelfEnrollable(context.course)) throw ValidationError('Class cards can only be used in adult classes (18+).');

  const { timezone } = await getTimeSettings();
  if (input.classDate > zonedDateKey(now, timezone)) throw ValidationError('Check-in opens on the day of the class.');
  // A class that has already started is fine here - check-in usually happens at the door.
  const dateCheck = await checkDropInDate(context.section, context.semesters, input.classDate, now);
  if (dateCheck === 'not_scheduled') throw ValidationError('This class doesn’t meet on that date.');
  if (dateCheck === 'closed') throw ValidationError('The studio is closed on that date.');

  const classDate = dateKeyToUtc(input.classDate);
  const ref = toRef(card.attendee);
  const name = card.attendee.name;
  const day = { startsAt: classDate, endsAt: new Date(classDate.getTime() + DAY_MS) };
  if (await findOverlappingRegistration(card.userId, context.section.id, ref, day)) {
    throw ConflictError(`${name} is registered for this class, so no card class is needed.`);
  }
  const dropIns = getDropInRegistrationRepository();
  if (await dropIns.findActiveForAttendee(card.userId, context.section.id, classDate, attendeeKey(ref))) {
    throw ConflictError(`${name} already has a drop-in for this class.`);
  }

  await releaseExpiredClassSeats(now);
  const section = await getClassSectionRepository().findById(context.section.id);
  if (!section) throw NotFoundError('Class not found');
  if (!(await dropIns.reserveSeat(section.id, classDate, section.capacity - section.enrolled))) {
    throw ConflictError('This class is full on that date.');
  }

  // Each step below gives back what the earlier ones took if it fails.
  const used = await cards.useClass(card.id);
  if (!used) {
    await dropIns.releaseSeat(section.id, classDate);
    throw ConflictError('This class card has no classes left.');
  }

  try {
    const redemption = await getClassCardRedemptionRepository().create({
      cardId: card.id,
      userId: card.userId,
      attendee: card.attendee,
      sectionId: section.id,
      courseId: section.courseId,
      classDate,
      redeemedByUserId: actorUserId,
    });
    return { card: used, redemption };
  } catch (error) {
    await cards.restoreClass(card.id);
    await dropIns.releaseSeat(section.id, classDate);
    if (isDuplicateKey(error)) throw ConflictError(`${name} is already checked in to this class.`);
    throw error;
  }
};

// Undo: the class goes back on the card (even a cancelled one, for its history) and the seat frees.
export const voidClassCardRedemption = async (redemptionId: string, actorUserId: string, now: Date = new Date()): Promise<RedeemClassCardResult> => {
  const redemptions = getClassCardRedemptionRepository();
  if (!(await redemptions.findById(redemptionId))) throw NotFoundError('Check-in not found');
  const voided = await redemptions.void(redemptionId, actorUserId, now);
  if (!voided) throw ConflictError('This check-in was already undone.');

  await getDropInRegistrationRepository().releaseSeat(voided.sectionId, voided.classDate);
  const card = (await getClassCardRepository().restoreClass(voided.cardId)) ?? (await getClassCardRepository().findById(voided.cardId));
  if (!card) throw NotFoundError('Class card not found');
  return { card, redemption: voided };
};

import {
  dateKeyToUtc,
  getClassCardRedemptionRepository,
  getClassCardRepository,
  getDropInRegistrationRepository,
  getUserRepository,
  isSelfEnrollable,
  listClassSections,
  listCourses,
  listPrograms,
  listSchoolYears,
  listSectionRegistrationsOn,
  resolveSectionSemesters,
  resolveStudioClosedDateKeys,
  sectionSessionDateKeys,
} from '@inithium/db';
import type { ClassAttendee, ClassCardEntity, ClassSectionEntity, CourseEntity } from '@inithium/db';
import { loadInstructorDirectory } from './class-catalog.service';

export interface CheckInPersonDto {
  userId: string;
  attendee: ClassAttendee;
}

export interface CheckInCardUseDto extends CheckInPersonDto {
  redemptionId: string;
  cardId: string;
  cardName: string;
  classesLeft: number;
}

export interface CheckInSessionDto {
  sectionId: string;
  course: { id: string; name: string };
  programName?: string;
  // Adult (18+) courses take class cards.
  acceptsClassCards: boolean;
  startTime: string;
  endTime: string;
  instructorNames: string[];
  capacity: number;
  seatsTaken: number;
  registered: CheckInPersonDto[];
  dropIns: (CheckInPersonDto & { dropInId: string })[];
  cardCheckIns: CheckInCardUseDto[];
}

export interface CheckInCardHolderDto extends CheckInPersonDto {
  cardId: string;
  cardName: string;
  accountName: string;
  classesLeft: number;
}

export interface CheckInDayDto {
  // "YYYY-MM-DD"
  date: string;
  isStudioClosed: boolean;
  sessions: CheckInSessionDto[];
  // Every adult with a usable card - any of them can be checked in to an adult class.
  cardHolders: CheckInCardHolderDto[];
}

const classesLeft = (card: Pick<ClassCardEntity, 'classesTotal' | 'classesUsed'>): number => Math.max(0, card.classesTotal - card.classesUsed);

const fullName = (user: { firstName?: string; lastName?: string } | null): string => [user?.firstName, user?.lastName].filter(Boolean).join(' ');

// The published sections that meet on the date, in start-time order, with their course.
const loadSectionsOn = async (dateKey: string, closed: Set<string>): Promise<{ section: ClassSectionEntity; course: CourseEntity; programName?: string }[]> => {
  const [programs, courses, sections, schoolYears] = await Promise.all([listPrograms(), listCourses(), listClassSections(), listSchoolYears()]);
  const programsById = new Map(programs.filter((program) => program.isPublished).map((program) => [program.id, program]));
  const coursesById = new Map(courses.filter((course) => course.isPublished && programsById.has(course.programId)).map((course) => [course.id, course]));
  const schoolYearsById = new Map(schoolYears.filter((year) => year.isPublished).map((year) => [year.id, year]));

  return sections
    .flatMap((section) => {
      const course = coursesById.get(section.courseId);
      const schoolYear = schoolYearsById.get(section.schoolYearId);
      if (!section.isPublished || !course || !schoolYear) return [];
      const semesters = resolveSectionSemesters(section.semesterIds, schoolYear.semesters);
      if (sectionSessionDateKeys(section.daysOfWeek, semesters, dateKey, dateKey, closed).length === 0) return [];
      return [{ section, course, programName: programsById.get(course.programId)?.name }];
    })
    .sort((a, b) => a.section.startTime.localeCompare(b.section.startTime) || a.course.name.localeCompare(b.course.name));
};

export const buildCheckInDay = async (dateKey: string): Promise<CheckInDayDto> => {
  const closed = await resolveStudioClosedDateKeys(dateKey, dateKey);
  const classDate = dateKeyToUtc(dateKey);
  const [entries, directory] = await Promise.all([loadSectionsOn(dateKey, closed), loadInstructorDirectory()]);
  const dropInRepository = getDropInRegistrationRepository();
  const redemptionRepository = getClassCardRedemptionRepository();
  const cardRepository = getClassCardRepository();

  const sessions = await Promise.all(
    entries.map(async ({ section, course, programName }): Promise<CheckInSessionDto> => {
      const [registrations, dropIns, held, redemptions] = await Promise.all([
        listSectionRegistrationsOn(section.id, classDate),
        dropInRepository.findBySectionDate(section.id, classDate),
        dropInRepository.countForSectionDate(section.id, classDate),
        redemptionRepository.findActiveBySectionDate(section.id, classDate),
      ]);
      const cards = await Promise.all(redemptions.map((redemption) => cardRepository.findById(redemption.cardId)));
      return {
        sectionId: section.id,
        course: { id: course.id, name: course.name },
        ...(programName ? { programName } : {}),
        acceptsClassCards: isSelfEnrollable(course),
        startTime: section.startTime,
        endTime: section.endTime,
        instructorNames: section.instructorStaffIds.flatMap((id) => {
          const name = directory.get(id)?.name;
          return name ? [name] : [];
        }),
        capacity: section.capacity,
        seatsTaken: section.enrolled + held,
        registered: registrations.map((registration) => ({ userId: registration.userId, attendee: registration.attendee })),
        dropIns: dropIns
          .filter((dropIn) => dropIn.status === 'active')
          .map((dropIn) => ({ dropInId: dropIn.id, userId: dropIn.userId, attendee: dropIn.attendee })),
        cardCheckIns: redemptions.map((redemption, index) => {
          const card = cards[index];
          return {
            redemptionId: redemption.id,
            cardId: redemption.cardId,
            userId: redemption.userId,
            attendee: redemption.attendee,
            cardName: card?.name ?? 'Class card',
            classesLeft: card ? classesLeft(card) : 0,
          };
        }),
      };
    }),
  );

  const usable = sessions.some((session) => session.acceptsClassCards) ? await cardRepository.findUsable() : [];
  const userIds = [...new Set(usable.map((card) => card.userId))];
  const users = await Promise.all(userIds.map((id) => getUserRepository().findById(id)));
  const accountNames = new Map(userIds.map((id, index) => [id, fullName(users[index] ?? null)]));

  return {
    date: dateKey,
    isStudioClosed: closed.has(dateKey),
    sessions,
    cardHolders: usable
      .map((card) => ({
        cardId: card.id,
        cardName: card.name,
        userId: card.userId,
        attendee: card.attendee,
        accountName: accountNames.get(card.userId) ?? '',
        classesLeft: classesLeft(card),
      }))
      .sort((a, b) => a.attendee.name.localeCompare(b.attendee.name)),
  };
};

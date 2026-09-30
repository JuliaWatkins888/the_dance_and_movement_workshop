import {
  getUserRepository,
  getWorkshopBySlug,
  listStaff,
  listWorkshops,
  resolveWorkshopPrice,
  workshopEndsAt,
  workshopRegistrationClosesAt,
} from '@inithium/db';
import type { WorkshopDayEntity, WorkshopEntity, WorkshopInstructor } from '@inithium/db';

const STAFF_FETCH_LIMIT = 200;

export interface StaffProfile {
  id: string;
  name: string;
  title: string;
  bio?: string;
  photoUrl?: string;
}

export type StaffProfiles = Map<string, StaffProfile>;

// Staff never stores its own name (see staff.route.ts's toStaffDto) - resolved from the linked
// user. A studio's roster is small enough to load whole per request.
export const loadStaffProfiles = async (): Promise<StaffProfiles> => {
  const { items } = await listStaff({ page: 1, pageSize: STAFF_FETCH_LIMIT });
  const profiles = await Promise.all(
    items.map(async (staff): Promise<StaffProfile> => {
      const user = await getUserRepository().findById(staff.userId);
      return {
        id: staff.id,
        name: [user?.firstName, user?.lastName].filter(Boolean).join(' '),
        title: staff.title,
        ...(staff.bio ? { bio: staff.bio } : {}),
        ...(staff.photoUrl ? { photoUrl: staff.photoUrl } : {}),
      };
    }),
  );
  return new Map(profiles.map((profile) => [profile.id, profile]));
};

export interface WorkshopInstructorDto {
  name: string;
  isGuest: boolean;
  title?: string;
  bio?: string;
  photoUrl?: string;
}

// A staff member deleted after being assigned simply drops out of the list.
const resolveInstructors = (instructors: WorkshopInstructor[], staff: StaffProfiles): WorkshopInstructorDto[] =>
  instructors.flatMap((instructor): WorkshopInstructorDto[] => {
    if (instructor.type === 'guest') {
      return [
        {
          name: instructor.name,
          isGuest: true,
          ...(instructor.bio ? { bio: instructor.bio } : {}),
          ...(instructor.photoUrl ? { photoUrl: instructor.photoUrl } : {}),
        },
      ];
    }
    const profile = staff.get(instructor.staffId);
    if (!profile) return [];
    return [
      {
        name: profile.name,
        isGuest: false,
        title: profile.title,
        ...(profile.bio ? { bio: profile.bio } : {}),
        ...(profile.photoUrl ? { photoUrl: profile.photoUrl } : {}),
      },
    ];
  });

// open        - taking registrations (the first day hasn't started)
// in_progress - underway; registration closed
// past        - the last day has ended
export type WorkshopStatus = 'open' | 'in_progress' | 'past';

const statusOf = (days: WorkshopDayEntity[], now: Date): WorkshopStatus => {
  const closesAt = workshopRegistrationClosesAt(days);
  const endsAt = workshopEndsAt(days);
  if (closesAt && now < closesAt) return 'open';
  if (endsAt && now < endsAt) return 'in_progress';
  return 'past';
};

export interface PublicWorkshopDayDto {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  agenda?: string;
  capacity: number;
  openings: number;
}

export interface PublicWorkshopDto {
  id: string;
  title: string;
  slug: string;
  description?: string;
  dressCode?: string;
  styles: string[];
  level?: WorkshopEntity['level'];
  minAgeYears?: number;
  maxAgeYears?: number;
  imageUrl?: string;
  banner?: WorkshopEntity['banner'];
  instructors: WorkshopInstructorDto[];
  days: PublicWorkshopDayDto[];
  pricePerDayCents: number;
  fullWorkshopDiscountPercent: number;
  fullWorkshopPriceCents: number;
  registrationClosesAt?: Date;
  status: WorkshopStatus;
}

const toPublicDay = (day: WorkshopDayEntity): PublicWorkshopDayDto => ({
  id: day.id,
  date: day.date,
  startTime: day.startTime,
  endTime: day.endTime,
  ...(day.agenda ? { agenda: day.agenda } : {}),
  capacity: day.capacity,
  openings: Math.max(0, day.capacity - day.enrolled),
});

export const toPublicWorkshopDto = (workshop: WorkshopEntity, staff: StaffProfiles, now: Date): PublicWorkshopDto => {
  const registrationClosesAt = workshopRegistrationClosesAt(workshop.days);
  return {
    id: workshop.id,
    title: workshop.title,
    slug: workshop.slug,
    ...(workshop.description ? { description: workshop.description } : {}),
    ...(workshop.dressCode ? { dressCode: workshop.dressCode } : {}),
    styles: workshop.styles,
    ...(workshop.level ? { level: workshop.level } : {}),
    ...(workshop.minAgeYears !== undefined ? { minAgeYears: workshop.minAgeYears } : {}),
    ...(workshop.maxAgeYears !== undefined ? { maxAgeYears: workshop.maxAgeYears } : {}),
    ...(workshop.imageUrl ? { imageUrl: workshop.imageUrl } : {}),
    ...(workshop.banner ? { banner: workshop.banner } : {}),
    instructors: resolveInstructors(workshop.instructors, staff),
    days: workshop.days.map(toPublicDay),
    pricePerDayCents: workshop.pricePerDayCents,
    fullWorkshopDiscountPercent: workshop.fullWorkshopDiscountPercent,
    fullWorkshopPriceCents: resolveWorkshopPrice(workshop, workshop.days.length).amountCents,
    ...(registrationClosesAt ? { registrationClosesAt } : {}),
    status: statusOf(workshop.days, now),
  };
};

const firstStart = (workshop: WorkshopEntity): number => workshop.days[0]?.startsAt.getTime() ?? 0;

// Upcoming and running workshops soonest first, then past ones most recent first. A workshop with
// no days has nothing to show and is left out.
export const buildPublicWorkshopList = async (now: Date): Promise<PublicWorkshopDto[]> => {
  const [workshops, staff] = await Promise.all([listWorkshops(), loadStaffProfiles()]);
  const listed = workshops
    .filter((workshop) => workshop.isPublished && workshop.days.length > 0)
    .map((workshop) => ({
      workshop,
      dto: toPublicWorkshopDto(workshop, staff, now),
    }));
  const current = listed.filter(({ dto }) => dto.status !== 'past').sort((a, b) => firstStart(a.workshop) - firstStart(b.workshop));
  const past = listed.filter(({ dto }) => dto.status === 'past').sort((a, b) => firstStart(b.workshop) - firstStart(a.workshop));
  return [...current, ...past].map(({ dto }) => dto);
};

// Resolves for past workshops too, so a shared link never 404s.
export const buildPublicWorkshopDetail = async (slug: string, now: Date): Promise<PublicWorkshopDto | null> => {
  const workshop = await getWorkshopBySlug(slug);
  if (!workshop?.isPublished) return null;
  return toPublicWorkshopDto(workshop, await loadStaffProfiles(), now);
};

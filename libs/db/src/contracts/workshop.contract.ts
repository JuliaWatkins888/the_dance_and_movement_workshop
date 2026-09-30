import type { ClearableUpdate } from './commerce.contract';
import type { CourseLevel } from './course.contract';
import type { UserProfileBannerConfig } from './user.contract';

export const WORKSHOP_IMAGE_SOURCE_TYPES = ['cloud', 'external'] as const;
export type WorkshopImageSourceType = (typeof WORKSHOP_IMAGE_SOURCE_TYPES)[number];

export type WorkshopBannerConfig = Omit<UserProfileBannerConfig, 'imageUrl'>;

// A staff member is referenced (name/photo resolve from the staff roster); a visiting guest is
// stored inline since they have no account or staff record.
export type WorkshopInstructor =
  | { type: 'staff'; staffId: string }
  | {
      type: 'guest';
      name: string;
      bio?: string;
      photoUrl?: string;
      photoSourceType?: WorkshopImageSourceType;
      photoAssetId?: string;
    };

// One dated session of a workshop. Families buy days individually, so capacity is per day.
export interface WorkshopDayEntity {
  id: string;
  // UTC midnight of the calendar date.
  date: Date;
  // 24-hour "HH:mm" wall-clock times at the studio.
  startTime: string;
  endTime: string;
  // The same start/end as instants in the studio's timezone - derived when the workshop is saved,
  // and what registration closing is measured against.
  startsAt: Date;
  endsAt: Date;
  agenda?: string;
  capacity: number;
  enrolled: number;
}

// A one-off, multi-day offering (e.g. a visiting instructor's three-day intensive) - unlike a
// course, it has no school year, semesters, or recurring billing.
export interface WorkshopEntity {
  id: string;
  title: string;
  // Public page: /workshops/:slug.
  slug: string;
  description?: string;
  dressCode?: string;
  styles: string[];
  level?: CourseLevel;
  minAgeYears?: number;
  maxAgeYears?: number;
  instructors: WorkshopInstructor[];
  // Sorted by startsAt.
  days: WorkshopDayEntity[];
  pricePerDayCents: number;
  // Applied when every day is bought together (0 = no discount).
  fullWorkshopDiscountPercent: number;
  imageUrl?: string;
  imageSourceType?: WorkshopImageSourceType;
  imageAssetId?: string;
  banner?: WorkshopBannerConfig;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Days keep their id across edits so seat counts and registrations stay attached to them.
export type WorkshopDayInput = Omit<WorkshopDayEntity, 'id'> & { id?: string };

export type CreateWorkshopInput = Omit<WorkshopEntity, 'id' | 'days' | 'createdAt' | 'updatedAt'> & { days: WorkshopDayInput[] };
export type UpdateWorkshopInput = ClearableUpdate<Omit<CreateWorkshopInput, 'days'>> & { days?: WorkshopDayInput[] };

export interface WorkshopRepository {
  // Unpaged - a studio runs a handful of workshops a year.
  findAll: () => Promise<WorkshopEntity[]>;
  findById: (id: string) => Promise<WorkshopEntity | null>;
  findBySlug: (slug: string) => Promise<WorkshopEntity | null>;
  create: (input: CreateWorkshopInput) => Promise<WorkshopEntity>;
  update: (id: string, input: UpdateWorkshopInput) => Promise<WorkshopEntity | null>;
  delete: (id: string) => Promise<boolean>;
  // Atomic claim of one seat on one day - false when that day is full or gone.
  reserveDaySeat: (workshopId: string, dayId: string) => Promise<boolean>;
  // Never takes enrolled below zero.
  releaseDaySeat: (workshopId: string, dayId: string) => Promise<void>;
}

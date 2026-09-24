import type { PaginatedResult } from './pagination.contract';

export type WorkshopSearchField = 'name';

// One dated occurrence of a Workshop (e.g. one day of a 3-day intensive) - a Workshop carries a
// list of these instead of the recurring daysOfWeek/startDate-endDate span ClassEntity uses,
// since a workshop is a specific set of dates, not an ongoing weekly pattern within a term.
export interface WorkshopOccurrence {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
}

export type CreateWorkshopOccurrenceInput = Omit<WorkshopOccurrence, 'id'>;

// A standalone, revenue/roster-bearing special offering that doesn't belong to a Course (a guest
// choreographer's one-off weekend intensive, a PT-led session) - belongs directly to a Semester (and
// so to that semester's AcademicYear), never to a Course.
// Unlike the separate Event concept (a non-revenue calendar record with no registration flow,
// intentionally out of scope here), a Workshop carries pricing/capacity exactly like a Class does.
export interface WorkshopEntity {
  id: string;
  semesterId: string; // FK -> SemesterEntity.id, resolved at the API layer
  name: string;
  description?: string;
  instructorIds: string[]; // FK -> StaffEntity.id, resolved at the API layer
  occurrences: WorkshopOccurrence[];
  minAgeYears?: number;
  maxAgeYears?: number;
  priceAmount: number; // one-time flat price - no monthly/semester/year tiers, unlike Class
  registrationStartDate?: Date;
  capacity: number;
  enrolled: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateWorkshopInput = Omit<WorkshopEntity, 'id' | 'occurrences' | 'createdAt' | 'updatedAt'> & {
  occurrences: CreateWorkshopOccurrenceInput[];
};
export type UpdateWorkshopInput = Partial<CreateWorkshopInput>;

export interface FindManyWorkshopsOptions {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: WorkshopSearchField;
  semesterId?: string;
}

export interface FindPublishedWorkshopsOptions {
  // Narrows to one Staff member's own workshops - used by the Staff Detail page's "what they
  // teach" listing, mirroring FindPublishedClassesOptions.instructorId exactly.
  instructorId?: string;
}

export interface WorkshopRepository {
  findMany: (options: FindManyWorkshopsOptions) => Promise<PaginatedResult<WorkshopEntity>>;
  // Public catalog - unpaged, sorted by each workshop's earliest occurrence date. Sorted in
  // application code rather than via a Mongo query (Mongo has no server-side way to sort
  // documents by the minimum of an array field without an aggregation pipeline this small a
  // catalog doesn't warrant - same reasoning policy.repository.ts already applies to sorting
  // items *within* one document).
  findPublished: (options?: FindPublishedWorkshopsOptions) => Promise<WorkshopEntity[]>;
  create: (input: CreateWorkshopInput) => Promise<WorkshopEntity>;
  update: (id: string, input: UpdateWorkshopInput) => Promise<WorkshopEntity | null>;
  delete: (id: string) => Promise<boolean>;
  // Powers DELETE /api/academic-years/:id's cascade-delete guard and the Studio Offerings
  // dashboard's per-year workshop count (summed across that year's semester ids).
  countBySemesterIds: (semesterIds: string[]) => Promise<number>;
}

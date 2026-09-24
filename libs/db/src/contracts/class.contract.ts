import type { PaginatedResult } from './pagination.contract';

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export type ClassSearchField = 'variantLabel';

// One scheduled variant of a Course (a specific age/instructor/day-time combination) - "Ballet"
// the Course exists once per academic year; "Tuesdays/Thursdays, Ages 7-10 with Julia Watkins" and
// "Wednesdays/Fridays, Ages 11-14 with Amy Guilmette" are two ClassEntity records under it. This
// replaces the old flat, one-row-per-offering shape (name/description/categories duplicated
// across every age/day variant) inherited from the studio's prior system - those fields now live
// once on the parent CourseEntity.
export interface ClassEntity {
  id: string;
  courseId: string; // FK -> CourseEntity.id, resolved at the API layer (never a Mongoose ref)
  // FK -> SemesterEntity.id: which of its Course's semesters this class runs in. Always a subset of
  // the Course's own semesterIds, so a full-year Course can still hold a Fall-only class (e.g. a
  // different instructor each semester) without duplicating the Course. Covering both of the
  // year's semesters is what unlocks the pay-for-the-year price tier.
  semesterIds: string[];
  // Optional admin/display disambiguator now that Class has no name of its own (e.g. "Tuesdays &
  // Thursdays, Ages 7-10") - shown alongside the parent Course's name.
  variantLabel?: string;
  instructorIds: string[]; // FK -> StaffEntity.id, resolved at the API layer
  daysOfWeek: DayOfWeek[];
  // 24-hour "HH:mm" (e.g. "19:30") - matches a native <input type="time"> value directly and
  // sidesteps AM/PM ambiguity in storage; formatted for display at the UI layer only.
  startTime: string;
  endTime: string;
  registrationStartDate?: Date;
  startDate: Date;
  endDate: Date;
  minAgeYears?: number;
  maxAgeYears?: number;
  // The month-to-month rate. Semester-in-full and year-in-full prices are never stored - they're
  // derived from this plus the studio-wide discount settings (see api-core's classPricing.ts), so
  // changing a discount never leaves stale per-class totals behind.
  priceAmount: number;
  capacity: number;
  enrolled: number;
  // FK -> ClassEntity.id of the class this one was copied from (see course.contract.ts's copiedFromId).
  // Classes have no name to match on, so this link is the only way the copy wizard can tell a class
  // was already copied.
  copiedFromId?: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateClassInput = Omit<ClassEntity, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateClassInput = Partial<CreateClassInput>;

export interface FindManyClassesOptions {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: ClassSearchField;
  courseId?: string;
}

export interface FindPublishedClassesOptions {
  // Narrows the public catalog to one Course's variants - used by the Course Detail page; omitted
  // entirely, the full published catalog is returned (small enough to fetch whole, same rationale
  // as every other public listing in this codebase).
  courseId?: string;
  // Narrows to one Staff member's own sections - used by the Staff Detail page's "what they
  // teach" listing. instructorIds is a plain string array, so this matches the same "scalar value
  // against an array field" semantics Mongo already applies for courseId-style filters.
  instructorId?: string;
}

export interface FindManyClassesUnpagedOptions {
  search?: string;
  searchField?: ClassSearchField;
  courseId?: string;
}

export interface ClassRepository {
  // Admin listing - every class regardless of isPublished, paginated + searchable, optionally
  // narrowed to one Course.
  findMany: (options: FindManyClassesOptions) => Promise<PaginatedResult<ClassEntity>>;
  // Same filter as findMany but unpaged - Class has no name of its own to sort by at the DB level
  // (its "alphabetical" identity is its parent Course's name, which only the route layer can
  // resolve - see classes.route.ts's toClassDto), so the admin route fetches the full matching
  // set here, sorts by the resolved courseName there, and paginates that sorted array in JS. Small
  // catalog, same "fetch whole, process in application code" precedent this codebase already uses
  // for every public listing.
  findManyUnpaged: (options: FindManyClassesUnpagedOptions) => Promise<ClassEntity[]>;
  findPublished: (options?: FindPublishedClassesOptions) => Promise<ClassEntity[]>;
  // Lets a partial PUT resolve its effective courseId/semesterIds before re-validating that pair.
  findById: (id: string) => Promise<ClassEntity | null>;
  // Every class of the given courses, unpaged - the copy wizard's source/destination class lists.
  findByCourseIds: (courseIds: string[]) => Promise<ClassEntity[]>;
  create: (input: CreateClassInput) => Promise<ClassEntity>;
  update: (id: string, input: UpdateClassInput) => Promise<ClassEntity | null>;
  delete: (id: string) => Promise<boolean>;
  // Powers DELETE /api/courses/:id's cascade-delete guard.
  countByCourseId: (courseId: string) => Promise<number>;
  // Powers the Studio Offerings dashboard's per-year class count (summed across every Course in
  // that year).
  countByCourseIds: (courseIds: string[]) => Promise<number>;
}

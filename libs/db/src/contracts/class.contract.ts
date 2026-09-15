import type { PaginatedResult } from './pagination.contract';

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export type ClassSearchField = 'variantLabel';

// One scheduled variant of a Course (a specific age/instructor/day-time combination) - "Ballet"
// the Course exists once per semester; "Tuesdays/Thursdays, Ages 7-10 with Julia Watkins" and
// "Wednesdays/Fridays, Ages 11-14 with Amy Guilmette" are two ClassEntity records under it. This
// replaces the old flat, one-row-per-offering shape (name/description/categories duplicated
// across every age/day variant) inherited from the studio's prior system - those fields now live
// once on the parent CourseEntity.
export interface ClassEntity {
  id: string;
  courseId: string; // FK -> CourseEntity.id, resolved at the API layer (never a Mongoose ref)
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
  priceAmount: number;
  billingCycle: string;
  capacity: number;
  enrolled: number;
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
}

export interface ClassRepository {
  // Admin listing - every class regardless of isPublished, paginated + searchable, optionally
  // narrowed to one Course.
  findMany: (options: FindManyClassesOptions) => Promise<PaginatedResult<ClassEntity>>;
  findPublished: (options?: FindPublishedClassesOptions) => Promise<ClassEntity[]>;
  create: (input: CreateClassInput) => Promise<ClassEntity>;
  update: (id: string, input: UpdateClassInput) => Promise<ClassEntity | null>;
  delete: (id: string) => Promise<boolean>;
  // Powers DELETE /api/courses/:id's cascade-delete guard.
  countByCourseId: (courseId: string) => Promise<number>;
  // Powers the Studio Offerings dashboard's per-semester class count (summed across every Course
  // in that semester).
  countByCourseIds: (courseIds: string[]) => Promise<number>;
}

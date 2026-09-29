import type { ClearableUpdate } from './commerce.contract';

export const COURSE_LEVELS = ['beginner', 'intermediate'] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];

// What a family shops for ("Mini Movers") - everything that stays the same no matter which day,
// time, or instructor they pick. The scheduled, registerable offerings of a course are its
// ClassSectionEntity records, so a course taught three times a week is still one course.
export interface CourseEntity {
  id: string;
  programId: string; // FK -> ProgramEntity.id
  name: string;
  // Public detail page lives at /classes/:slug - unique across all courses.
  slug: string;
  description?: string;
  dressCode?: string;
  // Dance/movement styles (Ballet, Tap, Yoga, ...) - free-form tags shown as pills.
  styles: string[];
  level?: CourseLevel;
  // Eligibility range, may be fractional (Mini Movers starts at 2.5).
  minAgeYears?: number;
  maxAgeYears?: number;
  // Admin-set monthly tuition in integer cents; semester/year plan prices derive from it (see
  // utils/class-pricing.ts). Every section of the course shares it.
  monthlyPriceCents: number;
  order: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateCourseInput = Omit<CourseEntity, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateCourseInput = ClearableUpdate<CreateCourseInput>;

export interface FindCoursesOptions {
  programId?: string;
}

export interface CourseRepository {
  // Unpaged - a studio's catalog is a few dozen courses at most.
  findAll: (options?: FindCoursesOptions) => Promise<CourseEntity[]>;
  findById: (id: string) => Promise<CourseEntity | null>;
  findBySlug: (slug: string) => Promise<CourseEntity | null>;
  create: (input: CreateCourseInput) => Promise<CourseEntity>;
  update: (id: string, input: UpdateCourseInput) => Promise<CourseEntity | null>;
  delete: (id: string) => Promise<boolean>;
}

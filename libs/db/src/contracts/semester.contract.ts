import type { PaginatedResult } from './pagination.contract';

export type SemesterSearchField = 'name';

// The two fixed slots every AcademicYear is split into. Semesters are stood up in this pair when a
// year is created and are edit-only afterwards, so `term` is a semester's permanent identity within
// its year - `name` stays a freely editable display label.
export const SEMESTER_TERMS = ['summer-fall', 'winter-spring'] as const;
export type SemesterTerm = (typeof SEMESTER_TERMS)[number];

export const SEMESTER_TERM_LABELS: Record<SemesterTerm, string> = {
  'summer-fall': 'Summer/Fall',
  'winter-spring': 'Winter/Spring',
};

// One half of an AcademicYear. Courses and Classes reference Semesters by id to say which term(s)
// they run in; Workshops hang off exactly one. Admin-only: there is no public "list semesters"
// endpoint, since a site visitor only encounters a semester through its parent year's public
// payload (see academic-years.route.ts).
export interface SemesterEntity {
  id: string;
  academicYearId: string; // FK -> AcademicYearEntity.id, resolved at the API layer
  term: SemesterTerm;
  name: string;
  startDate: Date;
  endDate: Date;
  // Default registration-open date other offerings under this semester can inherit; Class/Workshop
  // still carry their own optional registrationStartDate to override it for a specific offering.
  registrationOpensAt?: Date;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateSemesterInput = Omit<SemesterEntity, 'id' | 'createdAt' | 'updatedAt'>;
// A semester never changes parent year or term slot after creation.
export type UpdateSemesterInput = Partial<Omit<CreateSemesterInput, 'academicYearId' | 'term'>>;

export interface FindManySemestersOptions {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: SemesterSearchField;
  academicYearId?: string;
}

export interface SemesterRepository {
  findMany: (options: FindManySemestersOptions) => Promise<PaginatedResult<SemesterEntity>>;
  // Exposed for FK resolution - Course/Class/Workshop's own toDto functions resolve their semester
  // ids through these, the same role ClassRepository's implicit doc lookup plays for staff.route.ts's
  // userId. findByAcademicYearId returns the year's semesters ordered by start date.
  findById: (id: string) => Promise<SemesterEntity | null>;
  findByIds: (ids: string[]) => Promise<SemesterEntity[]>;
  findByAcademicYearId: (academicYearId: string) => Promise<SemesterEntity[]>;
  create: (input: CreateSemesterInput) => Promise<SemesterEntity>;
  update: (id: string, input: UpdateSemesterInput) => Promise<SemesterEntity | null>;
  // Only the AcademicYear delete flow removes semesters (there is no standalone delete route).
  deleteByAcademicYearId: (academicYearId: string) => Promise<number>;
}

import type { PaginatedResult } from './pagination.contract';

export type SemesterSearchField = 'name';

// The root of the studio's offering hierarchy - Courses (and, indirectly through Course, Classes)
// plus Workshops all hang off a Semester by id. Admin-only: there is no public "list semesters"
// endpoint, since a site visitor only ever encounters a semester indirectly through the Courses/
// Workshops that reference it (see courses.route.ts/workshops.route.ts's own toDto resolution).
export interface SemesterEntity {
  id: string;
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
export type UpdateSemesterInput = Partial<CreateSemesterInput>;

export interface FindManySemestersOptions {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: SemesterSearchField;
}

export interface SemesterRepository {
  findMany: (options: FindManySemestersOptions) => Promise<PaginatedResult<SemesterEntity>>;
  // Exposed for FK resolution - Course/Workshop's own toDto functions resolve semesterId through
  // this, the same role ClassRepository's implicit doc lookup plays for staff.route.ts's userId.
  findById: (id: string) => Promise<SemesterEntity | null>;
  create: (input: CreateSemesterInput) => Promise<SemesterEntity>;
  update: (id: string, input: UpdateSemesterInput) => Promise<SemesterEntity | null>;
  delete: (id: string) => Promise<boolean>;
}

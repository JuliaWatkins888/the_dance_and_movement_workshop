import type { ClearableUpdate } from './commerce.contract';

// Calendar dates are stored as UTC midnight of the "YYYY-MM-DD" the admin entered.
export interface SemesterEntity {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
}

// The billing calendar classes run on. Semester plans are sold per semester, and a year plan is
// only offered for a section that runs in every semester of its school year.
export interface SchoolYearEntity {
  id: string;
  name: string;
  registrationOpensAt?: Date;
  // Kept sorted by startDate.
  semesters: SemesterEntity[];
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Semesters are always written as the full list. An entry carrying an existing id keeps it, so
// sections referencing that semester stay linked; an entry without one is new.
export type SemesterInput = Omit<SemesterEntity, 'id'> & { id?: string };

export type CreateSchoolYearInput = Omit<SchoolYearEntity, 'id' | 'semesters' | 'createdAt' | 'updatedAt'> & {
  semesters: SemesterInput[];
};
export type UpdateSchoolYearInput = ClearableUpdate<CreateSchoolYearInput>;

export interface SchoolYearRepository {
  findAll: () => Promise<SchoolYearEntity[]>;
  findById: (id: string) => Promise<SchoolYearEntity | null>;
  create: (input: CreateSchoolYearInput) => Promise<SchoolYearEntity>;
  update: (id: string, input: UpdateSchoolYearInput) => Promise<SchoolYearEntity | null>;
  delete: (id: string) => Promise<boolean>;
}

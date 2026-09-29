import type { ClearableUpdate } from './commerce.contract';

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

// One scheduled, registerable time slot of a course ("Mini Movers, Tue 6:00 PM with Lila"). This
// is what a family enrolls in and what the ecommerce cart line will reference.
export interface ClassSectionEntity {
  id: string;
  courseId: string; // FK -> CourseEntity.id
  schoolYearId: string; // FK -> SchoolYearEntity.id
  // Which of the school year's semesters this section runs in - a subset of
  // SchoolYearEntity.semesters ids. Its dates are derived from these, never stored separately.
  semesterIds: string[];
  instructorStaffIds: string[]; // FK -> StaffEntity.id
  daysOfWeek: DayOfWeek[];
  // 24-hour "HH:mm" - matches a native <input type="time"> value; formatted at the UI layer.
  startTime: string;
  endTime: string;
  capacity: number;
  enrolled: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateClassSectionInput = Omit<ClassSectionEntity, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateClassSectionInput = ClearableUpdate<CreateClassSectionInput>;

export interface FindClassSectionsOptions {
  courseId?: string;
  schoolYearId?: string;
}

export interface ClassSectionRepository {
  findAll: (options?: FindClassSectionsOptions) => Promise<ClassSectionEntity[]>;
  findById: (id: string) => Promise<ClassSectionEntity | null>;
  create: (input: CreateClassSectionInput) => Promise<ClassSectionEntity>;
  update: (id: string, input: UpdateClassSectionInput) => Promise<ClassSectionEntity | null>;
  delete: (id: string) => Promise<boolean>;
  // Atomic claim that never takes enrolled past capacity - false when there's no room left.
  reserveSeats: (id: string, count: number) => Promise<boolean>;
  // Never takes enrolled below zero.
  releaseSeats: (id: string, count: number) => Promise<void>;
}

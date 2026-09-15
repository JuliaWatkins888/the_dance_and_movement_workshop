import type { PaginatedResult } from './pagination.contract';

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export type ClassSearchField = 'name';

// One document per registerable offering (a specific name + term + day/time), not one per named
// program - "Adult Ballet" running both Fall 2026 and Winter/Spring 2027 is two ClassEntity
// records, matching how the studio's own Jackrabbit data (and its capacity/instructor/dates) is
// already shaped one row per offering.
export interface ClassEntity {
  id: string;
  name: string;
  description?: string;
  categories: string[];
  instructors: string[];
  daysOfWeek: DayOfWeek[];
  // 24-hour "HH:mm" (e.g. "19:30") - matches a native <input type="time"> value directly and
  // sidesteps AM/PM ambiguity in storage; formatted for display at the UI layer only.
  startTime: string;
  endTime: string;
  // Free-text term label as the studio names it (e.g. "Fall 2026") - not a structured
  // start/end-of-term concept of its own, since startDate/endDate already carry that.
  session: string;
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
}

export interface ClassRepository {
  // Admin listing - every class regardless of isPublished, paginated + searchable by name.
  findMany: (options: FindManyClassesOptions) => Promise<PaginatedResult<ClassEntity>>;
  // Public listing - published classes only. Unpaged like PolicyRepository.findAll(): a dance
  // studio's catalog is a few dozen to a few hundred offerings, small enough that the public
  // ClassesPage fetches it whole and does search/filter/pagination client-side.
  findPublished: () => Promise<ClassEntity[]>;
  create: (input: CreateClassInput) => Promise<ClassEntity>;
  update: (id: string, input: UpdateClassInput) => Promise<ClassEntity | null>;
  delete: (id: string) => Promise<boolean>;
}

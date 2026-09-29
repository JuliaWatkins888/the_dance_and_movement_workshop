import type { PaginatedResult } from './pagination.contract';

export const CHILD_GENDERS = ['he_him', 'she_her', 'they_them', 'prefer_not_to_say'] as const;
export type ChildGender = (typeof CHILD_GENDERS)[number];

export type ChildSearchField = 'firstName' | 'lastName';

export interface ChildEntity {
  id: string;
  parentUserId: string; // FK -> UserEntity.id; name/email resolved at API layer
  firstName: string;
  lastName?: string;
  // Stored as UTC midnight of the calendar date entered. Class eligibility compares the child's
  // exact age on the day of registration against a course's age range (see class-eligibility.ts).
  birthDate: Date;
  gender: ChildGender;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateChildInput = Omit<ChildEntity, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateChildInput = Partial<CreateChildInput>;

export interface FindManyChildrenOptions {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: ChildSearchField;
}

export interface ChildAccountCount {
  date: string;
  count: number;
}

export interface ChildRepository {
  findMany: (options: FindManyChildrenOptions) => Promise<PaginatedResult<ChildEntity>>;
  findById: (id: string) => Promise<ChildEntity | null>;
  findByParentUserId: (parentUserId: string) => Promise<ChildEntity[]>;
  create: (input: CreateChildInput) => Promise<ChildEntity>;
  update: (id: string, input: UpdateChildInput) => Promise<ChildEntity | null>;
  delete: (id: string) => Promise<boolean>;
  countCreatedByDay: () => Promise<ChildAccountCount[]>;
}

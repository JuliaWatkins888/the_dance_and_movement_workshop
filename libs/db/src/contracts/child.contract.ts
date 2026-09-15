import type { PaginatedResult } from './pagination.contract';

export const CHILD_GENDERS = ['he_him', 'she_her', 'they_them', 'prefer_not_to_say'] as const;
export type ChildGender = (typeof CHILD_GENDERS)[number];

export type ChildSearchField = 'firstName' | 'lastName';

// A placeholder slot for the not-yet-built class registration feature - referencing ClassEntity
// by id only (no registration status/business logic here), the same "FK + resolve at the API
// layer" shape as ChildEntity.parentUserId itself.
export interface ChildRegistrationEntry {
  classId: string;
  registeredAt: Date;
}

export interface ChildEntity {
  id: string;
  parentUserId: string; // FK -> UserEntity.id; name/email resolved at API layer
  firstName: string;
  lastName?: string;
  age: number;
  gender: ChildGender;
  activeRegistrations: ChildRegistrationEntry[];
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

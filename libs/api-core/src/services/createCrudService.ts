export interface CrudRepository<T, CreateInput = Partial<T>, UpdateInput = Partial<T>> {
  findMany: () => Promise<T[]>;
  findById: (id: string) => Promise<T | null>;
  create: (input: CreateInput) => Promise<T>;
  update: (id: string, input: UpdateInput) => Promise<T | null>;
  delete: (id: string) => Promise<boolean>;
}

export interface CrudService<T, CreateInput = Partial<T>, UpdateInput = Partial<T>> {
  findMany: () => Promise<T[]>;
  findById: (id: string) => Promise<T | null>;
  create: (input: CreateInput) => Promise<T>;
  update: (id: string, input: UpdateInput) => Promise<T | null>;
  delete: (id: string) => Promise<boolean>;
}

export const createCrudService = <T, CreateInput = Partial<T>, UpdateInput = Partial<T>>(
  repository: CrudRepository<T, CreateInput, UpdateInput>
): CrudService<T, CreateInput, UpdateInput> => ({
  findMany: () => repository.findMany(),
  findById: (id) => repository.findById(id),
  create: (input) => repository.create(input),
  update: (id, input) => repository.update(id, input),
  delete: (id) => repository.delete(id),
});

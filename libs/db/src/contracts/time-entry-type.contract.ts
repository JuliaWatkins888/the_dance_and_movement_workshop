export interface TimeEntryTypeEntity {
  id: string;
  label: string;
  // Display order (ascending, ties broken by createdAt) - lets a time:manage actor control the
  // order types appear in the clock-in dropdown and settings list, independent of creation order.
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateTimeEntryTypeInput = { label: string; order?: number };
export type UpdateTimeEntryTypeInput = Partial<CreateTimeEntryTypeInput>;

export interface TimeEntryTypeRepository {
  findAll: () => Promise<TimeEntryTypeEntity[]>;
  findById: (id: string) => Promise<TimeEntryTypeEntity | null>;
  // Used to block deleting the sole remaining type - an employee must always have at least one
  // type to pick when clocking in.
  countAll: () => Promise<number>;
  create: (input: CreateTimeEntryTypeInput) => Promise<TimeEntryTypeEntity>;
  update: (id: string, input: UpdateTimeEntryTypeInput) => Promise<TimeEntryTypeEntity | null>;
  delete: (id: string) => Promise<boolean>;
}

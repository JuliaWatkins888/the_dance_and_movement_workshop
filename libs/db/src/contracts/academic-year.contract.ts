export type AcademicYearSearchField = 'title';

// The root of the studio's offering hierarchy: AcademicYear -> Semester (always exactly two, see
// semester.contract.ts) -> Course -> Class, with Workshops hanging off a Semester directly. It
// exists so a purchaser can buy a whole year at once - the year is the unit that price tier applies
// to. Its own start/end dates are deliberately NOT stored: they're the span of its two Semesters,
// derived at the API layer (see academic-years.route.ts's toAcademicYearDto) so there's no second
// copy of the dates to drift out of sync with the Semester CRUD that actually owns them.
export interface AcademicYearEntity {
  id: string;
  title: string;
  description?: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateAcademicYearInput = Omit<AcademicYearEntity, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateAcademicYearInput = Partial<CreateAcademicYearInput>;

export interface FindManyAcademicYearsUnpagedOptions {
  search?: string;
  searchField?: AcademicYearSearchField;
}

export interface AcademicYearRepository {
  // Unpaged - a year's sort key (its earliest Semester's start date) only exists once the route
  // layer resolves that year's Semesters, so the admin route fetches the whole matching set here,
  // sorts it, and paginates in JS. Same "small catalog, process in application code" precedent
  // ClassRepository.findManyUnpaged already documents.
  findManyUnpaged: (options?: FindManyAcademicYearsUnpagedOptions) => Promise<AcademicYearEntity[]>;
  findPublished: () => Promise<AcademicYearEntity[]>;
  findById: (id: string) => Promise<AcademicYearEntity | null>;
  create: (input: CreateAcademicYearInput) => Promise<AcademicYearEntity>;
  update: (id: string, input: UpdateAcademicYearInput) => Promise<AcademicYearEntity | null>;
  delete: (id: string) => Promise<boolean>;
}

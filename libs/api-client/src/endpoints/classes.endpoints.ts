import type { ApiResponse } from '@inithium/api-utils';
import type { ClassPlanKind, CourseLevel, DayOfWeek } from '@inithium/db';
import { baseApi } from '../baseApi';

// Frontend-facing shapes - dates cross the HTTP boundary as ISO strings. Money is integer cents.

export interface InstructorSummaryDto {
  id: string;
  name: string;
  photoUrl?: string;
}

export interface SemesterDto {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface ClassPlanOptionDto {
  kind: ClassPlanKind;
  amountCents: number;
  semesterId?: string;
  semesterName?: string;
  startDate?: string;
  endDate?: string;
  months?: number;
  fullPriceCents?: number;
  discountPercent?: number;
}

export interface ProgramBannerDto {
  cellSize: number;
  variance: number;
  xColors: string[];
  yColors: string[];
}

export type ProgramImageSourceType = 'cloud' | 'external';

export interface ProgramDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  minAgeYears?: number;
  maxAgeYears?: number;
  imageUrl?: string;
  imageSourceType?: ProgramImageSourceType;
  imageAssetId?: string;
  banner?: ProgramBannerDto;
  order: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CourseDto {
  id: string;
  programId: string;
  name: string;
  slug: string;
  description?: string;
  dressCode?: string;
  styles: string[];
  level?: CourseLevel;
  minAgeYears?: number;
  maxAgeYears?: number;
  monthlyPriceCents: number;
  order: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClassSectionDto {
  id: string;
  courseId: string;
  schoolYearId: string;
  semesterIds: string[];
  instructorStaffIds: string[];
  instructors: InstructorSummaryDto[];
  daysOfWeek: DayOfWeek[];
  startTime: string;
  endTime: string;
  capacity: number;
  enrolled: number;
  openings: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SchoolYearDto {
  id: string;
  name: string;
  registrationOpensAt?: string;
  semesters: SemesterDto[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminClassCatalogDto {
  programs: ProgramDto[];
  courses: CourseDto[];
  sections: ClassSectionDto[];
}

// Public catalog - only what's published and still open for registration.
export interface CatalogSectionDto {
  id: string;
  daysOfWeek: DayOfWeek[];
  startTime: string;
  endTime: string;
  instructors: InstructorSummaryDto[];
  capacity: number;
  openings: number;
  schoolYear: { id: string; name: string; registrationOpensAt?: string };
  semesters: SemesterDto[];
  startDate: string;
  endDate: string;
  planOptions: ClassPlanOptionDto[];
}

export type CatalogCourseDto = Omit<CourseDto, 'order' | 'isPublished' | 'createdAt' | 'updatedAt'> & {
  sections: CatalogSectionDto[];
};

export type PublicProgramDto = Omit<
  ProgramDto,
  'order' | 'isPublished' | 'createdAt' | 'updatedAt' | 'imageSourceType' | 'imageAssetId'
>;

export type CatalogProgramDto = PublicProgramDto & {
  courses: CatalogCourseDto[];
};

export type CatalogCourseDetailDto = CatalogCourseDto & { program: PublicProgramDto };

// Write inputs - null clears an optional field on update.
type Clearable<T> = { [K in keyof T]?: T[K] | null };

export interface ProgramWriteInput {
  name: string;
  slug: string;
  description?: string;
  minAgeYears?: number;
  maxAgeYears?: number;
  imageUrl?: string;
  imageSourceType?: ProgramImageSourceType;
  imageAssetId?: string;
  banner?: ProgramBannerDto;
  order?: number;
  isPublished?: boolean;
}
export type UpdateProgramInput = Clearable<ProgramWriteInput> & { id: string };

export interface CourseWriteInput {
  programId: string;
  name: string;
  slug: string;
  description?: string;
  dressCode?: string;
  styles: string[];
  level?: CourseLevel;
  minAgeYears?: number;
  maxAgeYears?: number;
  monthlyPriceCents: number;
  order?: number;
  isPublished?: boolean;
}
export type UpdateCourseInput = Clearable<CourseWriteInput> & { id: string };

export interface ClassSectionWriteInput {
  courseId: string;
  schoolYearId: string;
  semesterIds: string[];
  instructorStaffIds: string[];
  daysOfWeek: DayOfWeek[];
  startTime: string;
  endTime: string;
  capacity: number;
  enrolled?: number;
  isPublished?: boolean;
}
export type UpdateClassSectionInput = Partial<ClassSectionWriteInput> & { id: string };

export interface SemesterWriteInput {
  id?: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface SchoolYearWriteInput {
  name: string;
  registrationOpensAt?: string;
  semesters: SemesterWriteInput[];
  isPublished?: boolean;
}
export type UpdateSchoolYearInput = Partial<Omit<SchoolYearWriteInput, 'registrationOpensAt'>> & {
  id: string;
  registrationOpensAt?: string | null;
};

const unwrap = <T>(response: ApiResponse<T>): T => response.data;

export const classesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listClassCatalog: builder.query<CatalogProgramDto[], void>({
      query: () => '/api/classes',
      transformResponse: unwrap<CatalogProgramDto[]>,
      providesTags: ['Class'],
    }),
    getClassProgramBySlug: builder.query<CatalogProgramDto, string>({
      query: (slug) => `/api/classes/programs/${encodeURIComponent(slug)}`,
      transformResponse: unwrap<CatalogProgramDto>,
      providesTags: ['Class'],
    }),
    getClassCourseBySlug: builder.query<CatalogCourseDetailDto, string>({
      query: (slug) => `/api/classes/courses/${encodeURIComponent(slug)}`,
      transformResponse: unwrap<CatalogCourseDetailDto>,
      providesTags: ['Class'],
    }),

    getAdminClassCatalog: builder.query<AdminClassCatalogDto, void>({
      query: () => '/api/classes/admin/catalog',
      transformResponse: unwrap<AdminClassCatalogDto>,
      providesTags: ['Class'],
    }),
    listSchoolYearsAdmin: builder.query<SchoolYearDto[], void>({
      query: () => '/api/classes/admin/school-years',
      transformResponse: unwrap<SchoolYearDto[]>,
      providesTags: ['SchoolYear'],
    }),
    listClassInstructors: builder.query<InstructorSummaryDto[], void>({
      query: () => '/api/classes/admin/instructors',
      transformResponse: unwrap<InstructorSummaryDto[]>,
      providesTags: ['Staff'],
    }),

    createProgram: builder.mutation<ProgramDto, ProgramWriteInput>({
      query: (input) => ({ url: '/api/classes/programs', method: 'POST', body: input }),
      transformResponse: unwrap<ProgramDto>,
      invalidatesTags: ['Class'],
    }),
    updateProgram: builder.mutation<ProgramDto, UpdateProgramInput>({
      query: ({ id, ...input }) => ({ url: `/api/classes/programs/${id}`, method: 'PUT', body: input }),
      transformResponse: unwrap<ProgramDto>,
      invalidatesTags: ['Class'],
    }),
    deleteProgram: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/classes/programs/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Class'],
    }),

    createCourse: builder.mutation<CourseDto, CourseWriteInput>({
      query: (input) => ({ url: '/api/classes/courses', method: 'POST', body: input }),
      transformResponse: unwrap<CourseDto>,
      invalidatesTags: ['Class'],
    }),
    updateCourse: builder.mutation<CourseDto, UpdateCourseInput>({
      query: ({ id, ...input }) => ({ url: `/api/classes/courses/${id}`, method: 'PUT', body: input }),
      transformResponse: unwrap<CourseDto>,
      invalidatesTags: ['Class'],
    }),
    deleteCourse: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/classes/courses/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Class'],
    }),

    createClassSection: builder.mutation<ClassSectionDto, ClassSectionWriteInput>({
      query: (input) => ({ url: '/api/classes/sections', method: 'POST', body: input }),
      transformResponse: unwrap<ClassSectionDto>,
      invalidatesTags: ['Class'],
    }),
    updateClassSection: builder.mutation<ClassSectionDto, UpdateClassSectionInput>({
      query: ({ id, ...input }) => ({ url: `/api/classes/sections/${id}`, method: 'PUT', body: input }),
      transformResponse: unwrap<ClassSectionDto>,
      invalidatesTags: ['Class'],
    }),
    deleteClassSection: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/classes/sections/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Class'],
    }),

    // School year edits change section dates and plan prices, so they refresh the catalog too.
    createSchoolYear: builder.mutation<SchoolYearDto, SchoolYearWriteInput>({
      query: (input) => ({ url: '/api/classes/school-years', method: 'POST', body: input }),
      transformResponse: unwrap<SchoolYearDto>,
      invalidatesTags: ['SchoolYear', 'Class'],
    }),
    updateSchoolYear: builder.mutation<SchoolYearDto, UpdateSchoolYearInput>({
      query: ({ id, ...input }) => ({ url: `/api/classes/school-years/${id}`, method: 'PUT', body: input }),
      transformResponse: unwrap<SchoolYearDto>,
      invalidatesTags: ['SchoolYear', 'Class'],
    }),
    deleteSchoolYear: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/classes/school-years/${id}`, method: 'DELETE' }),
      invalidatesTags: ['SchoolYear', 'Class'],
    }),
  }),
});

export const {
  useListClassCatalogQuery,
  useGetClassProgramBySlugQuery,
  useGetClassCourseBySlugQuery,
  useGetAdminClassCatalogQuery,
  useListSchoolYearsAdminQuery,
  useListClassInstructorsQuery,
  useCreateProgramMutation,
  useUpdateProgramMutation,
  useDeleteProgramMutation,
  useCreateCourseMutation,
  useUpdateCourseMutation,
  useDeleteCourseMutation,
  useCreateClassSectionMutation,
  useUpdateClassSectionMutation,
  useDeleteClassSectionMutation,
  useCreateSchoolYearMutation,
  useUpdateSchoolYearMutation,
  useDeleteSchoolYearMutation,
} = classesApi;

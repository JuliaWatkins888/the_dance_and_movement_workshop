import type { ApiResponse } from '@inithium/api-utils';
import type { ClassSearchField, DayOfWeek } from '@inithium/db';
import { baseApi } from '../baseApi';
import type { SemesterSummaryDto } from './academic-years.endpoints';

// Resolved server-side (classes.route.ts's resolveClass) from instructorIds via Staff -> User -
// arrives display-ready, the same precedent StaffMemberDto's firstName/lastName already follows.
export interface ClassInstructorSummary {
  id: string;
  name: string;
  photoUrl?: string;
}

// What a purchaser pays under each billing option, all derived server-side from the class's monthly
// `priceAmount` and the studio-wide discount settings - never stored. `year` is absent unless the
// class runs in both semesters of its academic year.
export interface ClassPricingDto {
  monthly: number;
  semester: number;
  year?: number;
  semesterDiscountPercent: number;
  yearDiscountPercent: number;
}

// The rules behind ClassPricingDto, served by GET /api/classes/pricing-config so clients (the CMS
// price preview, a future registration flow) apply the same numbers instead of hardcoding them.
export interface ClassPricingConfigDto {
  semesterDiscountPercent: number;
  yearDiscountPercent: number;
  monthsPerSemester: number;
  monthsPerYear: number;
}

// Frontend-facing shape - dates cross the HTTP boundary as ISO strings, mirroring every other
// plugin's own Dto precedent. courseName/courseDescription/academicYearId/academicYearTitle/semesters
// are resolved server-side via the 2-hop courseId -> Course -> academicYearId -> AcademicYear chain
// (see classes.route.ts's own comment on why that resolution is 2 hops deep). `openings` is computed
// server-side from capacity/enrolled so every consumer reads the same derived value.
export interface ClassDto {
  id: string;
  courseId: string;
  // The semesters this class runs in - a subset of its course's.
  semesterIds: string[];
  variantLabel?: string;
  instructorIds: string[];
  daysOfWeek: DayOfWeek[];
  startTime: string;
  endTime: string;
  registrationStartDate?: string;
  startDate: string;
  endDate: string;
  minAgeYears?: number;
  maxAgeYears?: number;
  // The month-to-month rate; see `pricing` for the semester/year totals.
  priceAmount: number;
  capacity: number;
  enrolled: number;
  openings: number;
  // Set when this class was copied from another year's class (see offering-copy.route.ts).
  copiedFromId?: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  courseName: string;
  courseDescription?: string;
  academicYearId: string;
  academicYearTitle: string;
  // Only the semesters this class runs in, ordered by start date.
  semesters: SemesterSummaryDto[];
  // True when it runs in every semester its year has (the year-in-full price tier is offered).
  spansFullYear: boolean;
  instructors: ClassInstructorSummary[];
  pricing: ClassPricingDto;
  // registrationStartDate when the class has its own, otherwise the default of the first semester
  // it runs in - resolving *which* date applies isn't time-dependent so it's safe to compute
  // server-side; whether that date has actually passed is left to the browser's own clock
  // (registrationStatus.ts).
  effectiveRegistrationOpensAt?: string;
}

export interface ListPublicClassesParams {
  courseId?: string;
  // Narrows to one Staff member's own sections - used by the Staff Detail page.
  instructorId?: string;
}

export interface ListClassesAdminParams {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: ClassSearchField;
  courseId?: string;
}

export interface ListClassesResult {
  items: ClassDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ClassWriteInput {
  courseId: string;
  semesterIds: string[];
  variantLabel?: string;
  instructorIds: string[];
  daysOfWeek: DayOfWeek[];
  startTime: string;
  endTime: string;
  registrationStartDate?: string;
  startDate: string;
  endDate: string;
  minAgeYears?: number;
  maxAgeYears?: number;
  priceAmount: number;
  capacity: number;
  enrolled?: number;
  isPublished?: boolean;
}

export type UpdateClassInput = Partial<ClassWriteInput> & { id: string };

const buildListResult = (response: ApiResponse<ClassDto[]>): ListClassesResult => ({
  items: response.data,
  page: (response.meta?.['page'] as number) ?? 1,
  pageSize: (response.meta?.['pageSize'] as number) ?? response.data.length,
  total: (response.meta?.['total'] as number) ?? response.data.length,
  totalPages: (response.meta?.['totalPages'] as number) ?? 1,
});

export const classesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Unpaged - the public Course Detail page fetches one Course's variants (via ?courseId=), and
    // the Staff Detail page fetches one instructor's own sections (via ?instructorId=); neither
    // does further pagination, mirroring policiesApi.listPolicies' "small catalog" precedent.
    listPublicClasses: builder.query<ClassDto[], ListPublicClassesParams | void>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params?.courseId) searchParams.set('courseId', params.courseId);
        if (params?.instructorId) searchParams.set('instructorId', params.instructorId);
        const query = searchParams.toString();
        return query ? `/api/classes?${query}` : '/api/classes';
      },
      transformResponse: (response: ApiResponse<ClassDto[]>) => response.data,
      providesTags: ['Class'],
    }),
    // The discounts are editable studio-wide settings, so it's tagged 'Settings' - saving one in the
    // CMS refreshes any open price preview.
    getClassPricingConfig: builder.query<ClassPricingConfigDto, void>({
      query: () => '/api/classes/pricing-config',
      transformResponse: (response: ApiResponse<ClassPricingConfigDto>) => response.data,
      providesTags: ['Settings'],
    }),
    listClassesAdmin: builder.query<ListClassesResult, ListClassesAdminParams>({
      query: ({ page, pageSize, search, searchField, courseId }) => {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (search) params.set('search', search);
        if (searchField) params.set('searchField', searchField);
        if (courseId) params.set('courseId', courseId);
        return `/api/classes/admin?${params.toString()}`;
      },
      transformResponse: buildListResult,
      providesTags: ['Class'],
    }),
    createClass: builder.mutation<ClassDto, ClassWriteInput>({
      query: (input) => ({ url: '/api/classes', method: 'POST', body: input }),
      transformResponse: (response: ApiResponse<ClassDto>) => response.data,
      invalidatesTags: ['Class'],
    }),
    updateClass: builder.mutation<ClassDto, UpdateClassInput>({
      query: ({ id, ...input }) => ({ url: `/api/classes/${id}`, method: 'PUT', body: input }),
      transformResponse: (response: ApiResponse<ClassDto>) => response.data,
      invalidatesTags: ['Class'],
    }),
    deleteClass: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/classes/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Class'],
    }),
  }),
});

export const {
  useListPublicClassesQuery,
  useGetClassPricingConfigQuery,
  useListClassesAdminQuery,
  useCreateClassMutation,
  useUpdateClassMutation,
  useDeleteClassMutation,
} = classesApi;

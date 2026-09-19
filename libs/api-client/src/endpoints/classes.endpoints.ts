import type { ApiResponse } from '@inithium/api-utils';
import type { ClassSearchField, DayOfWeek } from '@inithium/db';
import { baseApi } from '../baseApi';

// Resolved server-side (classes.route.ts's toClassDto) from instructorIds via Staff -> User -
// arrives display-ready, the same precedent StaffMemberDto's firstName/lastName already follows.
export interface ClassInstructorSummary {
  id: string;
  name: string;
  photoUrl?: string;
}

// Frontend-facing shape - dates cross the HTTP boundary as ISO strings, mirroring every other
// plugin's own Dto precedent. courseName/courseDescription/semesterId/semesterName are resolved
// server-side via the 2-hop courseId -> Course -> semesterId -> Semester chain (see
// classes.route.ts's own comment on why that resolution is 2 hops deep). `openings` is computed
// server-side from capacity/enrolled so every consumer reads the same derived value.
export interface ClassDto {
  id: string;
  courseId: string;
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
  billingCycle: string;
  capacity: number;
  enrolled: number;
  openings: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  courseName: string;
  courseDescription?: string;
  semesterId: string;
  semesterName: string;
  instructors: ClassInstructorSummary[];
  // registrationStartDate when the class has its own, otherwise the semester's own default -
  // resolving *which* date applies isn't time-dependent so it's safe to compute server-side;
  // whether that date has actually passed is left to the browser's own clock (registrationStatus.ts).
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
  billingCycle: string;
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
  useListClassesAdminQuery,
  useCreateClassMutation,
  useUpdateClassMutation,
  useDeleteClassMutation,
} = classesApi;

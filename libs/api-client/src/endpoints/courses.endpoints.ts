import type { ApiResponse } from '@inithium/api-utils';
import type { CourseImageSourceType, CourseSearchField } from '@inithium/db';
import { baseApi } from '../baseApi';

// Frontend-facing shape - dates cross the HTTP boundary as ISO strings. semesterName/
// semesterStartDate/semesterEndDate/semesterRegistrationOpensAt are resolved server-side
// (courses.route.ts's toCourseDto) from the linked Semester, the same "arrives display-ready"
// precedent StaffMemberDto's firstName/lastName/email already follows for its own userId FK.
export interface CourseDto {
  id: string;
  semesterId: string;
  name: string;
  description?: string;
  categories: string[];
  // Absent entirely when a Course has no image yet - CourseBrowsePage/CourseDetailPage fall back
  // to a deterministic Trianglify banner (see apps/web/src/pages/courseBannerConfig.ts) instead
  // of treating a missing image as an error.
  imageUrl?: string;
  imageSourceType?: CourseImageSourceType;
  imageAssetId?: string;
  imageStorageKey?: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  semesterName: string;
  semesterStartDate?: string;
  semesterEndDate?: string;
  semesterRegistrationOpensAt?: string;
}

export interface ListCoursesAdminParams {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: CourseSearchField;
  semesterId?: string;
}

export interface ListCoursesResult {
  items: CourseDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CourseWriteInput {
  semesterId: string;
  name: string;
  description?: string;
  categories: string[];
  imageUrl?: string;
  imageSourceType?: CourseImageSourceType;
  imageAssetId?: string;
  imageStorageKey?: string;
  isPublished?: boolean;
}

export type UpdateCourseInput = Partial<CourseWriteInput> & { id: string };

export interface UploadCourseImageLocalResult {
  url: string;
  storageKey: string;
}

const buildListResult = (response: ApiResponse<CourseDto[]>): ListCoursesResult => ({
  items: response.data,
  page: (response.meta?.['page'] as number) ?? 1,
  pageSize: (response.meta?.['pageSize'] as number) ?? response.data.length,
  total: (response.meta?.['total'] as number) ?? response.data.length,
  totalPages: (response.meta?.['totalPages'] as number) ?? 1,
});

export const coursesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Unpaged - the public CourseBrowsePage fetches the whole published catalog once and groups/
    // filters it client-side, mirroring classesApi.listPublicClasses.
    listPublicCourses: builder.query<CourseDto[], void>({
      query: () => '/api/courses',
      transformResponse: (response: ApiResponse<CourseDto[]>) => response.data,
      providesTags: ['Course'],
    }),
    listCoursesAdmin: builder.query<ListCoursesResult, ListCoursesAdminParams>({
      query: ({ page, pageSize, search, searchField, semesterId }) => {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (search) params.set('search', search);
        if (searchField) params.set('searchField', searchField);
        if (semesterId) params.set('semesterId', semesterId);
        return `/api/courses/admin?${params.toString()}`;
      },
      transformResponse: buildListResult,
      providesTags: ['Course'],
    }),
    // fetchBaseQuery passes a FormData body through untouched (no JSON.stringify, the browser
    // sets the multipart boundary), matching staff.endpoints.ts's own uploadStaffPhotoLocal.
    uploadCourseImageLocal: builder.mutation<UploadCourseImageLocalResult, { file: File }>({
      query: ({ file }) => {
        const formData = new FormData();
        formData.append('file', file);
        return { url: '/api/courses/upload', method: 'POST', body: formData };
      },
      transformResponse: (response: ApiResponse<UploadCourseImageLocalResult>) => response.data,
    }),
    createCourse: builder.mutation<CourseDto, CourseWriteInput>({
      query: (input) => ({ url: '/api/courses', method: 'POST', body: input }),
      transformResponse: (response: ApiResponse<CourseDto>) => response.data,
      invalidatesTags: ['Course'],
    }),
    updateCourse: builder.mutation<CourseDto, UpdateCourseInput>({
      query: ({ id, ...input }) => ({ url: `/api/courses/${id}`, method: 'PUT', body: input }),
      transformResponse: (response: ApiResponse<CourseDto>) => response.data,
      invalidatesTags: ['Course'],
    }),
    deleteCourse: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/courses/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Course'],
    }),
  }),
});

export const {
  useListPublicCoursesQuery,
  useListCoursesAdminQuery,
  useUploadCourseImageLocalMutation,
  useCreateCourseMutation,
  useUpdateCourseMutation,
  useDeleteCourseMutation,
} = coursesApi;

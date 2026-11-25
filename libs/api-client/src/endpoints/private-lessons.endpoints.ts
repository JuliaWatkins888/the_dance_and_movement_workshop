import type { ApiResponse } from '@inithium/api-utils';
import type { DayOfWeek } from '@inithium/db';
import { baseApi } from '../baseApi';
import type { ClassAttendeeDto } from './class-registrations.endpoints';

// Dates are "YYYY-MM-DD" and times studio wall-clock "HH:mm".
export type PrivateLessonScheduleDto =
  | { kind: 'weekly'; weekday: DayOfWeek; startTime: string; endTime: string; startDate: string; endDate?: string }
  | { kind: 'once'; date: string; startTime: string; endTime: string };

export type PrivateLessonStatus = 'active' | 'ended';

export interface PrivateLessonOccurrenceDto {
  lessonId: string;
  // Where the schedule put it; identifies the occurrence even after a move.
  scheduledDate: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'cancelled';
  isMoved: boolean;
  hasStarted: boolean;
}

export interface PrivateLessonInstructorDto {
  id: string;
  name: string;
}

export interface MyPrivateLessonDto {
  id: string;
  attendee: ClassAttendeeDto;
  instructor?: PrivateLessonInstructorDto;
  title: string;
  schedule: PrivateLessonScheduleDto;
  rateCents: number;
  status: PrivateLessonStatus;
  endedOn?: string;
  upcoming: PrivateLessonOccurrenceDto[];
}

export interface PrivateLessonDto extends MyPrivateLessonDto {
  userId: string;
  account?: { id: string; name: string; email: string };
  notes?: string;
  createdAt: string;
}

export interface PrivateLessonScheduleItemDto extends PrivateLessonOccurrenceDto {
  title: string;
  attendee: ClassAttendeeDto;
  accountName?: string;
  instructor?: PrivateLessonInstructorDto;
  rateCents: number;
}

export type PrivateLessonAttendeeRef = { type: 'self' } | { type: 'child'; childId: string };

export interface PrivateLessonWriteInput {
  attendee: PrivateLessonAttendeeRef;
  instructorStaffId: string;
  title: string;
  schedule: PrivateLessonScheduleDto;
  rateCents: number;
  notes?: string;
}

export interface PrivateLessonScheduleArgs {
  from: string;
  // Exclusive.
  to: string;
  instructorStaffId?: string;
}

export type PrivateLessonExceptionInput =
  | { lessonId: string; kind: 'cancelled'; date: string }
  | { lessonId: string; kind: 'moved'; date: string; newDate: string; newStartTime: string; newEndTime: string };

const unwrap = <T>(response: ApiResponse<T>): T => response.data;

// Lessons taught post charges lazily, so a lesson change can change what the ledger shows.
const LESSON_TAGS = ['PrivateLesson', 'Ledger'] as const;

export const privateLessonsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listMyPrivateLessons: builder.query<MyPrivateLessonDto[], void>({
      query: () => '/api/private-lessons/mine',
      transformResponse: unwrap<MyPrivateLessonDto[]>,
      providesTags: ['PrivateLesson'],
    }),
    listPrivateLessonsAdmin: builder.query<PrivateLessonDto[], void>({
      query: () => '/api/private-lessons/admin',
      transformResponse: unwrap<PrivateLessonDto[]>,
      providesTags: ['PrivateLesson'],
    }),
    listAccountPrivateLessons: builder.query<PrivateLessonDto[], string>({
      query: (userId) => `/api/users/${userId}/private-lessons`,
      transformResponse: unwrap<PrivateLessonDto[]>,
      providesTags: ['PrivateLesson'],
    }),
    listPrivateLessonInstructors: builder.query<PrivateLessonInstructorDto[], void>({
      query: () => '/api/private-lessons/instructors',
      transformResponse: unwrap<PrivateLessonInstructorDto[]>,
      providesTags: ['Staff'],
    }),
    getPrivateLessonSchedule: builder.query<PrivateLessonScheduleItemDto[], PrivateLessonScheduleArgs>({
      query: ({ from, to, instructorStaffId }) =>
        `/api/private-lessons/schedule?${new URLSearchParams({ from, to, ...(instructorStaffId ? { instructorStaffId } : {}) })}`,
      transformResponse: unwrap<PrivateLessonScheduleItemDto[]>,
      providesTags: ['PrivateLesson'],
    }),
    createPrivateLesson: builder.mutation<PrivateLessonDto, PrivateLessonWriteInput & { userId: string }>({
      query: (body) => ({ url: '/api/private-lessons', method: 'POST', body }),
      transformResponse: unwrap<PrivateLessonDto>,
      invalidatesTags: [...LESSON_TAGS],
    }),
    updatePrivateLesson: builder.mutation<PrivateLessonDto, PrivateLessonWriteInput & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/api/private-lessons/${id}`, method: 'PUT', body }),
      transformResponse: unwrap<PrivateLessonDto>,
      invalidatesTags: [...LESSON_TAGS],
    }),
    endPrivateLesson: builder.mutation<PrivateLessonDto, { id: string; lastDate?: string }>({
      query: ({ id, lastDate }) => ({ url: `/api/private-lessons/${id}/end`, method: 'POST', body: lastDate ? { lastDate } : {} }),
      transformResponse: unwrap<PrivateLessonDto>,
      invalidatesTags: [...LESSON_TAGS],
    }),
    deletePrivateLesson: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/private-lessons/${id}`, method: 'DELETE' }),
      invalidatesTags: [...LESSON_TAGS],
    }),
    setPrivateLessonException: builder.mutation<PrivateLessonDto, PrivateLessonExceptionInput>({
      query: ({ lessonId, ...body }) => ({ url: `/api/private-lessons/${lessonId}/exceptions`, method: 'POST', body }),
      transformResponse: unwrap<PrivateLessonDto>,
      invalidatesTags: [...LESSON_TAGS],
    }),
    clearPrivateLessonException: builder.mutation<PrivateLessonDto, { lessonId: string; date: string }>({
      query: ({ lessonId, date }) => ({ url: `/api/private-lessons/${lessonId}/exceptions/${date}`, method: 'DELETE' }),
      transformResponse: unwrap<PrivateLessonDto>,
      invalidatesTags: [...LESSON_TAGS],
    }),
  }),
});

export const {
  useListMyPrivateLessonsQuery,
  useListPrivateLessonsAdminQuery,
  useListAccountPrivateLessonsQuery,
  useListPrivateLessonInstructorsQuery,
  useGetPrivateLessonScheduleQuery,
  useCreatePrivateLessonMutation,
  useUpdatePrivateLessonMutation,
  useEndPrivateLessonMutation,
  useDeletePrivateLessonMutation,
  useSetPrivateLessonExceptionMutation,
  useClearPrivateLessonExceptionMutation,
} = privateLessonsApi;

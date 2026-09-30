import type { ApiResponse } from '@inithium/api-utils';
import type { CourseLevel } from '@inithium/db';
import { baseApi } from '../baseApi';
import type { ClassAttendeeDto } from './class-registrations.endpoints';
import type { ProgramBannerDto, ProgramImageSourceType } from './classes.endpoints';

// Frontend-facing shapes - dates cross the HTTP boundary as ISO strings. Money is integer cents.

export type WorkshopStatus = 'open' | 'in_progress' | 'past';

export interface WorkshopInstructorDto {
  name: string;
  isGuest: boolean;
  title?: string;
  bio?: string;
  photoUrl?: string;
}

export interface PublicWorkshopDayDto {
  id: string;
  // UTC midnight of the calendar date.
  date: string;
  startTime: string;
  endTime: string;
  agenda?: string;
  capacity: number;
  openings: number;
}

export interface PublicWorkshopDto {
  id: string;
  title: string;
  slug: string;
  description?: string;
  dressCode?: string;
  styles: string[];
  level?: CourseLevel;
  minAgeYears?: number;
  maxAgeYears?: number;
  imageUrl?: string;
  banner?: ProgramBannerDto;
  instructors: WorkshopInstructorDto[];
  days: PublicWorkshopDayDto[];
  pricePerDayCents: number;
  fullWorkshopDiscountPercent: number;
  fullWorkshopPriceCents: number;
  registrationClosesAt?: string;
  status: WorkshopStatus;
}

export type WorkshopInstructorRecord =
  | { type: 'staff'; staffId: string }
  | {
      type: 'guest';
      name: string;
      bio?: string;
      photoUrl?: string;
      photoSourceType?: ProgramImageSourceType;
      photoAssetId?: string;
    };

export interface WorkshopDayDto {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  startsAt: string;
  endsAt: string;
  agenda?: string;
  capacity: number;
  enrolled: number;
}

export interface WorkshopDto {
  id: string;
  title: string;
  slug: string;
  description?: string;
  dressCode?: string;
  styles: string[];
  level?: CourseLevel;
  minAgeYears?: number;
  maxAgeYears?: number;
  instructors: WorkshopInstructorRecord[];
  days: WorkshopDayDto[];
  pricePerDayCents: number;
  fullWorkshopDiscountPercent: number;
  imageUrl?: string;
  imageSourceType?: ProgramImageSourceType;
  imageAssetId?: string;
  banner?: ProgramBannerDto;
  isPublished: boolean;
  registrationCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkshopStaffOptionDto {
  id: string;
  name: string;
  title: string;
  photoUrl?: string;
}

export interface WorkshopRosterEntryDto {
  id: string;
  attendee: ClassAttendeeDto;
  account?: { id: string; name: string; email: string };
  dayIds: string[];
  isFullWorkshop: boolean;
  orderId: string;
  createdAt: string;
}

export interface WorkshopDayWriteInput {
  id?: string;
  // "YYYY-MM-DD" and 24-hour "HH:mm" studio wall-clock times.
  date: string;
  startTime: string;
  endTime: string;
  agenda?: string;
  capacity: number;
}

// The CMS always saves the whole workshop - an optional field left out is cleared.
export interface WorkshopWriteInput {
  title: string;
  slug: string;
  description?: string;
  dressCode?: string;
  styles: string[];
  level?: CourseLevel;
  minAgeYears?: number;
  maxAgeYears?: number;
  instructors: WorkshopInstructorRecord[];
  days: WorkshopDayWriteInput[];
  pricePerDayCents: number;
  fullWorkshopDiscountPercent: number;
  imageUrl?: string;
  imageSourceType?: ProgramImageSourceType;
  imageAssetId?: string;
  banner?: ProgramBannerDto;
  isPublished?: boolean;
}

export type WorkshopRegistrationStatus = 'upcoming' | 'in_progress' | 'ended';

export interface WorkshopRegistrationDto {
  id: string;
  attendee: ClassAttendeeDto;
  workshop?: { id: string; title: string; slug: string };
  days: { id: string; date: string; startTime: string; endTime: string }[];
  isFullWorkshop: boolean;
  status: WorkshopRegistrationStatus;
  orderId: string;
  createdAt: string;
}

export const WORKSHOP_SOURCE_TYPE = 'workshop';

// The cart line options a workshop registration is added with - see the API's
// workshop.purchasable.ts. Day ids go in the workshop's own (chronological) order so the same
// selection always merges into one cart line.
export const toWorkshopLineOptions = (
  attendee: ClassAttendeeDto,
  workshop: Pick<PublicWorkshopDto, 'days'>,
  dayIds: string[],
): Record<string, string> => ({
  ...(attendee.type === 'self' ? { attendee: 'self' } : { attendee: 'child', childId: attendee.childId }),
  days: workshop.days
    .filter((day) => dayIds.includes(day.id))
    .map((day) => day.id)
    .join(','),
});

const unwrap = <T>(response: ApiResponse<T>): T => response.data;

export const workshopsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listWorkshops: builder.query<PublicWorkshopDto[], void>({
      query: () => '/api/workshops',
      transformResponse: unwrap<PublicWorkshopDto[]>,
      providesTags: ['Workshop'],
    }),
    getWorkshopBySlug: builder.query<PublicWorkshopDto, string>({
      query: (slug) => `/api/workshops/${encodeURIComponent(slug)}`,
      transformResponse: unwrap<PublicWorkshopDto>,
      providesTags: ['Workshop'],
    }),

    listWorkshopsAdmin: builder.query<WorkshopDto[], void>({
      query: () => '/api/workshops/admin/all',
      transformResponse: unwrap<WorkshopDto[]>,
      providesTags: ['Workshop'],
    }),
    listWorkshopStaffOptions: builder.query<WorkshopStaffOptionDto[], void>({
      query: () => '/api/workshops/admin/staff',
      transformResponse: unwrap<WorkshopStaffOptionDto[]>,
      providesTags: ['Staff'],
    }),
    getWorkshopRoster: builder.query<WorkshopRosterEntryDto[], string>({
      query: (id) => `/api/workshops/admin/${id}/registrations`,
      transformResponse: unwrap<WorkshopRosterEntryDto[]>,
      providesTags: ['WorkshopRegistration'],
    }),
    createWorkshop: builder.mutation<WorkshopDto, WorkshopWriteInput>({
      query: (input) => ({
        url: '/api/workshops',
        method: 'POST',
        body: input,
      }),
      transformResponse: unwrap<WorkshopDto>,
      invalidatesTags: ['Workshop'],
    }),
    updateWorkshop: builder.mutation<WorkshopDto, WorkshopWriteInput & { id: string }>({
      query: ({ id, ...input }) => ({
        url: `/api/workshops/${id}`,
        method: 'PUT',
        body: input,
      }),
      transformResponse: unwrap<WorkshopDto>,
      invalidatesTags: ['Workshop', 'WorkshopRegistration'],
    }),
    deleteWorkshop: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/workshops/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Workshop'],
    }),

    listEligibleWorkshopAttendees: builder.query<ClassAttendeeDto[], string>({
      query: (workshopId) => `/api/workshop-registrations/attendees?${new URLSearchParams({ workshopId })}`,
      transformResponse: unwrap<ClassAttendeeDto[]>,
      providesTags: ['Child', 'WorkshopRegistration'],
    }),
    listMyWorkshopRegistrations: builder.query<WorkshopRegistrationDto[], void>({
      query: () => '/api/workshop-registrations/mine',
      transformResponse: unwrap<WorkshopRegistrationDto[]>,
      providesTags: ['WorkshopRegistration', 'Workshop'],
    }),
  }),
});

export const {
  useListWorkshopsQuery,
  useGetWorkshopBySlugQuery,
  useListWorkshopsAdminQuery,
  useListWorkshopStaffOptionsQuery,
  useGetWorkshopRosterQuery,
  useCreateWorkshopMutation,
  useUpdateWorkshopMutation,
  useDeleteWorkshopMutation,
  useListEligibleWorkshopAttendeesQuery,
  useListMyWorkshopRegistrationsQuery,
} = workshopsApi;

import type { ApiResponse } from '@inithium/api-utils';
import type { DayOfWeek } from '@inithium/db';
import { baseApi } from '../baseApi';
import type { ClassAttendeeDto } from './class-registrations.endpoints';

export const CLASS_CARD_SOURCE_TYPE = 'class_card';

export interface ClassCardTypeDto {
  id: string;
  name: string;
  classCount: number;
  priceCents: number;
  isActive: boolean;
}

export interface ClassCardTypeInput {
  name: string;
  classCount: number;
  priceCents: number;
  isActive: boolean;
}

export type ClassCardStatus = 'active' | 'cancelled';
export type ClassCardRedemptionStatus = 'active' | 'voided';

export interface ClassCardRedemptionDto {
  id: string;
  cardId: string;
  // "YYYY-MM-DD"
  classDate: string;
  status: ClassCardRedemptionStatus;
  createdAt: string;
  voidedAt?: string;
  course?: { id: string; name: string; slug: string };
  section?: { id: string; daysOfWeek: DayOfWeek[]; startTime: string; endTime: string };
}

export interface ClassCardDto {
  id: string;
  attendee: ClassAttendeeDto;
  name: string;
  classesTotal: number;
  classesUsed: number;
  classesLeft: number;
  status: ClassCardStatus;
  cancelledAt?: string;
  orderId: string;
  createdAt: string;
  redemptions: ClassCardRedemptionDto[];
}

export interface CheckInPersonDto {
  userId: string;
  attendee: ClassAttendeeDto;
}

export interface CheckInCardUseDto extends CheckInPersonDto {
  redemptionId: string;
  cardId: string;
  cardName: string;
  classesLeft: number;
}

export interface CheckInSessionDto {
  sectionId: string;
  course: { id: string; name: string };
  programName?: string;
  // Adult (18+) courses take class cards.
  acceptsClassCards: boolean;
  startTime: string;
  endTime: string;
  instructorNames: string[];
  capacity: number;
  seatsTaken: number;
  registered: CheckInPersonDto[];
  dropIns: (CheckInPersonDto & { dropInId: string })[];
  cardCheckIns: CheckInCardUseDto[];
}

export interface CheckInCardHolderDto extends CheckInPersonDto {
  cardId: string;
  cardName: string;
  accountName: string;
  classesLeft: number;
}

export interface CheckInDayDto {
  // "YYYY-MM-DD"
  date: string;
  isStudioClosed: boolean;
  sessions: CheckInSessionDto[];
  cardHolders: CheckInCardHolderDto[];
}

export interface RedeemClassCardArgs {
  cardId: string;
  sectionId: string;
  classDate: string;
}

export interface ClassCardCheckInResult {
  card: ClassCardDto;
  redemption: ClassCardRedemptionDto;
}

// The cart line options a class card is added with - see the API's class-card.purchasable.ts.
export const toClassCardLineOptions = (attendee: ClassAttendeeDto): Record<string, string> =>
  attendee.type === 'self' ? { attendee: 'self' } : { attendee: 'child', childId: attendee.childId };

const unwrap = <T>(response: ApiResponse<T>): T => response.data;

export const classCardsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listClassCardTypes: builder.query<ClassCardTypeDto[], void>({
      query: () => '/api/class-card-types',
      transformResponse: unwrap<ClassCardTypeDto[]>,
      providesTags: ['ClassCardType'],
    }),
    listClassCardTypesAdmin: builder.query<ClassCardTypeDto[], void>({
      query: () => '/api/class-card-types/admin',
      transformResponse: unwrap<ClassCardTypeDto[]>,
      providesTags: ['ClassCardType'],
    }),
    createClassCardType: builder.mutation<ClassCardTypeDto, ClassCardTypeInput>({
      query: (body) => ({ url: '/api/class-card-types', method: 'POST', body }),
      transformResponse: unwrap<ClassCardTypeDto>,
      invalidatesTags: ['ClassCardType'],
    }),
    updateClassCardType: builder.mutation<ClassCardTypeDto, Partial<ClassCardTypeInput> & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/api/class-card-types/${id}`, method: 'PUT', body }),
      transformResponse: unwrap<ClassCardTypeDto>,
      invalidatesTags: ['ClassCardType'],
    }),
    deleteClassCardType: builder.mutation<{ id: string }, string>({
      query: (id) => ({ url: `/api/class-card-types/${id}`, method: 'DELETE' }),
      transformResponse: unwrap<{ id: string }>,
      invalidatesTags: ['ClassCardType'],
    }),
    listMyClassCards: builder.query<ClassCardDto[], void>({
      query: () => '/api/class-cards/mine',
      transformResponse: unwrap<ClassCardDto[]>,
      providesTags: ['ClassCard'],
    }),
    listAccountClassCards: builder.query<ClassCardDto[], string>({
      query: (userId) => `/api/users/${userId}/class-cards`,
      transformResponse: unwrap<ClassCardDto[]>,
      providesTags: ['ClassCard'],
    }),
    // Defaults to today in studio time when no date is given.
    getCheckInDay: builder.query<CheckInDayDto, string | undefined>({
      query: (date) => `/api/check-in/sessions${date ? `?date=${date}` : ''}`,
      transformResponse: unwrap<CheckInDayDto>,
      providesTags: ['ClassCard', 'DropIn', 'ClassRegistration'],
    }),
    redeemClassCard: builder.mutation<ClassCardCheckInResult, RedeemClassCardArgs>({
      query: (body) => ({ url: '/api/check-in/redeem', method: 'POST', body }),
      transformResponse: unwrap<ClassCardCheckInResult>,
      invalidatesTags: ['ClassCard', 'DropIn'],
    }),
    voidClassCardRedemption: builder.mutation<ClassCardCheckInResult, string>({
      query: (id) => ({ url: `/api/check-in/redemptions/${id}/void`, method: 'POST' }),
      transformResponse: unwrap<ClassCardCheckInResult>,
      invalidatesTags: ['ClassCard', 'DropIn'],
    }),
  }),
});

export const {
  useListClassCardTypesQuery,
  useListClassCardTypesAdminQuery,
  useCreateClassCardTypeMutation,
  useUpdateClassCardTypeMutation,
  useDeleteClassCardTypeMutation,
  useListMyClassCardsQuery,
  useListAccountClassCardsQuery,
  useGetCheckInDayQuery,
  useRedeemClassCardMutation,
  useVoidClassCardRedemptionMutation,
} = classCardsApi;

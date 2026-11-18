import type { ApiResponse } from '@inithium/api-utils';
import type { ClassPlanKind, DayOfWeek } from '@inithium/db';
import { baseApi } from '../baseApi';

export type ClassAttendeeDto = { type: 'child'; childId: string; name: string } | { type: 'self'; name: string };

export type ClassRegistrationStatus = 'active' | 'withdrawn' | 'ended';

// subscription - renews on a saved card; ledger - paid in person, tuition posts to the account
// ledger on the 1st; prepaid - semester/year paid in full.
export type ClassBillingMode = 'subscription' | 'ledger' | 'prepaid';

export const CLASS_BILLING_MODE_LABELS: Record<ClassBillingMode, string> = {
  subscription: 'Monthly · card on file',
  ledger: 'Monthly · pays in person',
  prepaid: 'Paid in full',
};

export interface ClassRegistrationDto {
  id: string;
  attendee: ClassAttendeeDto;
  plan: ClassPlanKind;
  semesterName?: string;
  schoolYearName?: string;
  status: ClassRegistrationStatus;
  startsAt: string;
  endsAt: string;
  withdrawnAt?: string;
  accessEndsAt?: string;
  orderId: string;
  course?: { id: string; name: string; slug: string };
  programName?: string;
  section?: { id: string; daysOfWeek: DayOfWeek[]; startTime: string; endTime: string };
  billingMode: ClassBillingMode;
  monthlyAmountCents?: number;
  nextBillingAt?: string;
  isPastDue: boolean;
  canCancel: boolean;
  cancelLockedReason?: string;
  canStaffWithdraw: boolean;
}

// The cart line options a class registration is added with - see the API's class.purchasable.ts.
export type ClassLineOptions = Record<string, string>;

export const CLASS_SOURCE_TYPE = 'class';

export const toClassLineOptions = (
  attendee: ClassAttendeeDto,
  plan: { kind: ClassPlanKind; semesterId?: string },
): ClassLineOptions => ({
  ...(attendee.type === 'self' ? { attendee: 'self' } : { attendee: 'child', childId: attendee.childId }),
  plan: plan.kind,
  ...(plan.kind === 'semester' && plan.semesterId ? { semesterId: plan.semesterId } : {}),
});

const unwrap = <T>(response: ApiResponse<T>): T => response.data;

export const classRegistrationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listEligibleAttendees: builder.query<ClassAttendeeDto[], string>({
      query: (sectionId) => `/api/class-registrations/attendees?${new URLSearchParams({ sectionId })}`,
      transformResponse: unwrap<ClassAttendeeDto[]>,
      providesTags: ['Child', 'ClassRegistration'],
    }),
    listMyClassRegistrations: builder.query<ClassRegistrationDto[], void>({
      query: () => '/api/class-registrations/mine',
      transformResponse: unwrap<ClassRegistrationDto[]>,
      providesTags: ['ClassRegistration'],
    }),
    cancelClassRegistration: builder.mutation<ClassRegistrationDto, string>({
      query: (id) => ({ url: `/api/class-registrations/mine/${id}/cancel`, method: 'POST' }),
      transformResponse: unwrap<ClassRegistrationDto>,
      invalidatesTags: ['ClassRegistration', 'Class'],
    }),
    listAccountClassRegistrations: builder.query<ClassRegistrationDto[], string>({
      query: (userId) => `/api/users/${userId}/class-registrations`,
      transformResponse: unwrap<ClassRegistrationDto[]>,
      providesTags: ['ClassRegistration'],
    }),
    withdrawClassRegistration: builder.mutation<ClassRegistrationDto, string>({
      query: (id) => ({ url: `/api/class-registrations/${id}/withdraw`, method: 'POST' }),
      transformResponse: unwrap<ClassRegistrationDto>,
      invalidatesTags: ['ClassRegistration', 'Class', 'Ledger'],
    }),
  }),
});

export const {
  useListEligibleAttendeesQuery,
  useListMyClassRegistrationsQuery,
  useCancelClassRegistrationMutation,
  useListAccountClassRegistrationsQuery,
  useWithdrawClassRegistrationMutation,
} = classRegistrationsApi;

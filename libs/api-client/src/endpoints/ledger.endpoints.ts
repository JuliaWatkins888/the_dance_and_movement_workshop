import type { ApiResponse } from '@inithium/api-utils';
import { baseApi } from '../baseApi';
import type { PersonDto } from './ecommerce-admin.endpoints';

export const LEDGER_BALANCE_SOURCE_TYPE = 'ledger_balance';

export type LedgerChargeCategory = 'costume' | 'fee' | 'tuition' | 'drop_in' | 'private_lesson' | 'other';
export type StaffLedgerPaymentMethod = 'cash' | 'check' | 'card_in_person' | 'other';
export type LedgerPaymentMethod = StaffLedgerPaymentMethod | 'card_online';

export const LEDGER_CATEGORY_LABELS: Record<LedgerChargeCategory, string> = {
  costume: 'Costume',
  fee: 'Fee',
  tuition: 'Tuition',
  drop_in: 'Drop-in',
  private_lesson: 'Private lesson',
  other: 'Other',
};

export const LEDGER_METHOD_LABELS: Record<LedgerPaymentMethod, string> = {
  cash: 'Cash',
  check: 'Check',
  card_in_person: 'Card in person',
  other: 'Other',
  card_online: 'Card online',
};

export interface LedgerEntryDto {
  id: string;
  userId: string;
  kind: 'charge' | 'payment';
  amountCents: number;
  description: string;
  category?: LedgerChargeCategory;
  studentId?: string;
  studentName?: string;
  dueDate?: string;
  method?: LedgerPaymentMethod;
  checkNumber?: string;
  receivedAt?: string;
  note?: string;
  source: 'staff' | 'order' | 'subscription' | 'system';
  orderId?: string;
  voidedAt?: string;
  voidReason?: string;
  createdAt: string;
}

export interface LedgerOpenChargeDto {
  chargeId: string;
  description: string;
  amountCents: number;
  remainingCents: number;
  studentName?: string;
  dueDate?: string;
  createdAt: string;
}

export interface AccountLedgerDto {
  customer: PersonDto;
  currency: string;
  balanceCents: number;
  creditCents: number;
  openCharges: LedgerOpenChargeDto[];
  students: { id: string; name: string }[];
  entries: LedgerEntryDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface LedgerAccountSummaryDto {
  customer: PersonDto;
  balanceCents: number;
}

export interface LedgerPageParams {
  page: number;
  pageSize: number;
}

export interface AddLedgerChargeInput {
  userId: string;
  amountCents: number;
  description: string;
  category: LedgerChargeCategory;
  studentId?: string;
  dueDate?: string;
  note?: string;
}

export interface RecordLedgerPaymentInput {
  userId: string;
  amountCents: number;
  method: StaffLedgerPaymentMethod;
  checkNumber?: string;
  receivedAt: string;
  note?: string;
  chargeIds?: string[];
}

const unwrap = <T>(response: ApiResponse<T>): T => response.data;

export const ledgerApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // userId keys the cache per account; the endpoint always answers for the bearer token.
    getMyLedger: builder.query<AccountLedgerDto, LedgerPageParams & { userId: string }>({
      query: ({ page, pageSize }) => `/api/ledger/mine?page=${page}&pageSize=${pageSize}`,
      transformResponse: unwrap<AccountLedgerDto>,
      providesTags: ['Ledger'],
    }),
    getUserLedger: builder.query<AccountLedgerDto, LedgerPageParams & { userId: string }>({
      query: ({ userId, page, pageSize }) => `/api/users/${userId}/ledger?page=${page}&pageSize=${pageSize}`,
      transformResponse: unwrap<AccountLedgerDto>,
      providesTags: ['Ledger'],
    }),
    listOutstandingBalances: builder.query<LedgerAccountSummaryDto[], number>({
      query: (limit) => `/api/ledger/outstanding?limit=${limit}`,
      transformResponse: unwrap<LedgerAccountSummaryDto[]>,
      providesTags: ['Ledger'],
    }),
    searchLedgerAccounts: builder.query<LedgerAccountSummaryDto[], string>({
      query: (search) => `/api/ledger/accounts?search=${encodeURIComponent(search)}`,
      transformResponse: unwrap<LedgerAccountSummaryDto[]>,
      providesTags: ['Ledger'],
    }),
    addLedgerCharge: builder.mutation<LedgerEntryDto, AddLedgerChargeInput>({
      query: ({ userId, ...body }) => ({ url: `/api/users/${userId}/ledger/charges`, method: 'POST', body }),
      transformResponse: unwrap<LedgerEntryDto>,
      invalidatesTags: ['Ledger'],
    }),
    recordLedgerPayment: builder.mutation<LedgerEntryDto, RecordLedgerPaymentInput>({
      query: ({ userId, ...body }) => ({ url: `/api/users/${userId}/ledger/payments`, method: 'POST', body }),
      transformResponse: unwrap<LedgerEntryDto>,
      invalidatesTags: ['Ledger'],
    }),
    voidLedgerEntry: builder.mutation<LedgerEntryDto, { entryId: string; reason: string }>({
      query: ({ entryId, reason }) => ({ url: `/api/ledger/${entryId}/void`, method: 'POST', body: { reason } }),
      transformResponse: unwrap<LedgerEntryDto>,
      invalidatesTags: ['Ledger'],
    }),
  }),
});

export const {
  useGetMyLedgerQuery,
  useGetUserLedgerQuery,
  useListOutstandingBalancesQuery,
  useSearchLedgerAccountsQuery,
  useAddLedgerChargeMutation,
  useRecordLedgerPaymentMutation,
  useVoidLedgerEntryMutation,
} = ledgerApi;

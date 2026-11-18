import type { ApiResponse } from '@inithium/api-utils';
import { baseApi } from '../baseApi';
import type { ManualOrderInput } from './ecommerce-admin.endpoints';
import type { CheckoutQuoteDto, PostalAddressInput } from './ecommerce.endpoints';
import type { StaffLedgerPaymentMethod } from './ledger.endpoints';
import type { PolicyConsentStatusDto } from './policy-consent.endpoints';

export interface DeskStudentDto {
  id: string;
  firstName: string;
  lastName?: string;
  birthDate: string;
  gender: string;
}

export interface DeskAccountDto {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
}

export interface DeskAccountDetailDto extends DeskAccountDto {
  students: DeskStudentDto[];
}

export interface CreateDeskAccountInput {
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  password?: string;
}

export interface AddDeskStudentInput {
  accountId: string;
  firstName: string;
  lastName?: string;
  birthDate: string;
  gender: string;
}

export interface DeskQuoteInput extends ManualOrderInput {
  billingAddress?: PostalAddressInput;
}

export interface DeskQuoteDto {
  quote: CheckoutQuoteDto;
  hasRecurring: boolean;
  policy: PolicyConsentStatusDto;
}

export interface DeskPaymentRecordInput {
  method: StaffLedgerPaymentMethod;
  amountCents: number;
  checkNumber?: string;
}

export type DeskPaymentInput =
  | { mode: 'card'; billingAddress: PostalAddressInput; paymentToken?: string; expectedTotalCents: number }
  | { mode: 'in_person'; record?: DeskPaymentRecordInput };

export interface DeskConsentInput {
  method: 'desk' | 'paper';
  signedName: string;
  versionHash: string;
}

export interface DeskOrderInput extends ManualOrderInput {
  payment: DeskPaymentInput;
  consent?: DeskConsentInput;
}

export interface DeskOrderSummaryDto {
  id: string;
  status: string;
  currency: string;
  totals: { subtotalCents: number; discountCents: number; shippingCents: number; taxCents: number; totalCents: number };
  paymentProvider: string;
  fulfillmentErrors: string[];
}

export type DeskOrderResultDto =
  | { status: 'paid' | 'processing'; order: DeskOrderSummaryDto }
  | { status: 'requires_action'; order: DeskOrderSummaryDto; clientSecret: string };

const unwrap = <T>(response: ApiResponse<T>): T => response.data;

const ORDER_TAGS = ['Order', 'Ledger', 'ClassRegistration', 'Class', 'Workshop', 'PolicyConsent'] as const;

export const deskApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    searchDeskAccounts: builder.query<DeskAccountDto[], string>({
      query: (search) => `/api/desk/accounts?${new URLSearchParams({ search })}`,
      transformResponse: unwrap<DeskAccountDto[]>,
      providesTags: ['User'],
    }),
    getDeskAccount: builder.query<DeskAccountDetailDto, string>({
      query: (id) => `/api/desk/accounts/${id}`,
      transformResponse: unwrap<DeskAccountDetailDto>,
      providesTags: ['User', 'Child'],
    }),
    createDeskAccount: builder.mutation<DeskAccountDetailDto, CreateDeskAccountInput>({
      query: (body) => ({ url: '/api/desk/accounts', method: 'POST', body }),
      transformResponse: unwrap<DeskAccountDetailDto>,
      invalidatesTags: ['User'],
    }),
    addDeskStudent: builder.mutation<DeskStudentDto, AddDeskStudentInput>({
      query: ({ accountId, ...body }) => ({ url: `/api/desk/accounts/${accountId}/students`, method: 'POST', body }),
      transformResponse: unwrap<DeskStudentDto>,
      invalidatesTags: ['Child'],
    }),
    quoteDeskOrder: builder.mutation<DeskQuoteDto, DeskQuoteInput>({
      query: (body) => ({ url: '/api/desk/quote', method: 'POST', body }),
      transformResponse: unwrap<DeskQuoteDto>,
    }),
    createDeskOrder: builder.mutation<DeskOrderResultDto, DeskOrderInput>({
      query: (body) => ({ url: '/api/desk/orders', method: 'POST', body }),
      transformResponse: unwrap<DeskOrderResultDto>,
      invalidatesTags: [...ORDER_TAGS],
    }),
    confirmDeskOrderPayment: builder.mutation<DeskOrderResultDto, string>({
      query: (orderId) => ({ url: `/api/desk/orders/${orderId}/confirm-payment`, method: 'POST' }),
      transformResponse: unwrap<DeskOrderResultDto>,
      invalidatesTags: [...ORDER_TAGS],
    }),
  }),
});

export const {
  useSearchDeskAccountsQuery,
  useGetDeskAccountQuery,
  useCreateDeskAccountMutation,
  useAddDeskStudentMutation,
  useQuoteDeskOrderMutation,
  useCreateDeskOrderMutation,
  useConfirmDeskOrderPaymentMutation,
} = deskApi;

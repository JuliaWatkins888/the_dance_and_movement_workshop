import type { ApiResponse } from '@inithium/api-utils';
import type { OrderKind, PaymentEventStatus } from '@inithium/db';
import { baseApi } from '../baseApi';
import type { PersonDto } from './ecommerce-admin.endpoints';
import type { PaginatedList } from './ecommerce.endpoints';

// Mirrors @inithium/ecommerce's PaymentHealthReport with dates as ISO strings.

export type PaymentHealthLevel = 'ok' | 'warning' | 'critical';
export type PaymentKeyMode = 'live' | 'test';

export interface PaymentHealthCheckDto {
  id: string;
  level: PaymentHealthLevel;
  title: string;
  detail: string;
}

export interface PaymentProviderHealthDto {
  provider: string;
  secretKey: { configured: boolean; valid: boolean; mode?: PaymentKeyMode; error?: string };
  publishableKey: { configured: boolean; mode?: PaymentKeyMode };
  webhookSecretConfigured: boolean;
  webhookEndpoints: { url: string; enabled: boolean; missingEvents: string[] }[] | null;
  webhookEndpointsError?: string;
}

export interface StuckOrderDto {
  id: string;
  kind: OrderKind;
  currency: string;
  totalCents: number;
  paymentId?: string;
  itemNames: string[];
  createdAt: string;
  customer: PersonDto;
}

export interface PastDueSubscriptionDto {
  id: string;
  orderId: string;
  currency: string;
  providerSubscriptionId: string;
  currentPeriodEnd?: string;
  monthlyCents: number;
  itemNames: string[];
  customer: PersonDto;
}

export interface PaymentHealthDto {
  status: PaymentHealthLevel;
  checkedAt: string;
  checks: PaymentHealthCheckDto[];
  provider: PaymentProviderHealthDto;
  webhook: {
    path: string;
    lastReceivedAt?: string;
    lastRejectedAt?: string;
    rejectedCount?: number;
    failedLast7Days: number;
  };
  failedOrdersLast7Days: number;
  stuckOrders: { total: number; items: StuckOrderDto[] };
  pastDueSubscriptions: { total: number; items: PastDueSubscriptionDto[] };
}

export interface PaymentEventDto {
  id: string;
  provider: string;
  eventId: string;
  type: string;
  status: PaymentEventStatus;
  reference?: string;
  orderId?: string;
  error?: string;
  attempts?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListPaymentEventsParams {
  page: number;
  pageSize: number;
  status?: PaymentEventStatus;
}

const toPaginatedList = <T>(response: ApiResponse<T[]>): PaginatedList<T> => ({
  items: response.data,
  page: (response.meta?.['page'] as number) ?? 1,
  pageSize: (response.meta?.['pageSize'] as number) ?? response.data.length,
  total: (response.meta?.['total'] as number) ?? response.data.length,
  totalPages: (response.meta?.['totalPages'] as number) ?? 1,
});

export const paymentHealthApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Each load calls Stripe, so it is never cached across visits to the screen.
    getPaymentHealth: builder.query<PaymentHealthDto, void>({
      query: () => '/api/admin/payments/health',
      transformResponse: (response: ApiResponse<PaymentHealthDto>) => response.data,
      keepUnusedDataFor: 0,
    }),
    listPaymentEvents: builder.query<PaginatedList<PaymentEventDto>, ListPaymentEventsParams>({
      query: ({ page, pageSize, status }) =>
        `/api/admin/payments/events?page=${page}&pageSize=${pageSize}${status ? `&status=${status}` : ''}`,
      transformResponse: toPaginatedList<PaymentEventDto>,
    }),
  }),
});

export const { useGetPaymentHealthQuery, useListPaymentEventsQuery } = paymentHealthApi;

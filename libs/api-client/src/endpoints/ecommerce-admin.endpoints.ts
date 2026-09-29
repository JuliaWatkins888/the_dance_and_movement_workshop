import type { ApiResponse } from '@inithium/api-utils';
import type {
  BillingInterval,
  BillingSubscriptionStatus,
  DiscountBillingTarget,
  DiscountDuration,
  DiscountKind,
  DiscountScope,
  OrderKind,
  OrderStatus,
  ProductImageSourceType,
  ProductSearchField,
} from '@inithium/db';
import { baseApi } from '../baseApi';
import type {
  CheckoutQuoteDto,
  OrderDto,
  PaginatedList,
  PostalAddressInput,
  ProductBillingDto,
  ProductDto,
  ProductOptionDto,
  ShippingMethodDto,
} from './ecommerce.endpoints';

// Admin (CMS) side of the ecommerce API. Same conventions as ecommerce.endpoints.ts: ISO date
// strings, integer minor-unit amounts.

const buildPaginatedList = <T>(response: ApiResponse<T[]>): PaginatedList<T> => ({
  items: response.data,
  page: (response.meta?.['page'] as number) ?? 1,
  pageSize: (response.meta?.['pageSize'] as number) ?? response.data.length,
  total: (response.meta?.['total'] as number) ?? response.data.length,
  totalPages: (response.meta?.['totalPages'] as number) ?? 1,
});

// An update where null clears an optional field (undefined leaves it untouched).
export type ClearableUpdate<T> = { [K in keyof T]?: T[K] | null };

const unwrap = <T>(response: ApiResponse<T>): T => response.data;

const withQuery = (path: string, params: Record<string, string | number | undefined>): string => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
};

export interface PersonDto {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
}

// ---- Products ----

export interface AdminProductDto extends ProductDto {
  imageSourceType?: ProductImageSourceType;
  imageAssetId?: string;
  imageStorageKey?: string;
  taxCode?: string;
}

export interface ProductVariantInput {
  // Present for existing variants - keep it so cart lines pointing at the variant stay valid.
  id?: string;
  sku?: string;
  optionValues: Record<string, string>;
  priceCents?: number;
  stockQuantity: number | null;
  isActive: boolean;
}

export interface ProductWriteInput {
  name: string;
  slug: string;
  description?: string;
  categories: string[];
  imageUrl?: string;
  imageSourceType?: ProductImageSourceType;
  imageAssetId?: string;
  imageStorageKey?: string;
  basePriceCents: number;
  taxCode?: string;
  requiresShipping: boolean;
  billing: ProductBillingDto;
  options: ProductOptionDto[];
  variants: ProductVariantInput[];
  isPublished: boolean;
}

export interface ListProductsAdminParams {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: ProductSearchField;
}

// ---- Discounts ----

export interface DiscountDto {
  id: string;
  code: string;
  description?: string;
  kind: DiscountKind;
  value: number;
  scope: DiscountScope;
  target: { sourceTypes: string[]; sourceIds: string[]; categories: string[] };
  appliesToBilling: DiscountBillingTarget;
  duration: DiscountDuration;
  durationInMonths?: number;
  minSubtotalCents?: number;
  minQuantity?: number;
  startsAt?: string;
  endsAt?: string;
  maxRedemptions?: number;
  maxRedemptionsPerUser?: number;
  timesRedeemed: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DiscountWriteInput = Omit<DiscountDto, 'id' | 'timesRedeemed' | 'createdAt' | 'updatedAt'>;

// ---- Shipping ----

export interface AdminShippingMethodDto extends ShippingMethodDto {
  isActive: boolean;
  sortOrder: number;
}

export type ShippingMethodWriteInput = Omit<AdminShippingMethodDto, 'id'>;

// ---- Orders ----

export interface AdminOrderDto extends OrderDto {
  customer: PersonDto;
  createdBy?: PersonDto;
  internalNotes?: string;
  trackingNumber?: string;
  fulfillmentErrors: string[];
  subscriptionIds: string[];
  payment: { provider: string; paymentId?: string; invoiceId?: string };
}

export interface ListOrdersAdminParams {
  page: number;
  pageSize: number;
  status?: OrderStatus;
  kind?: OrderKind;
  userId?: string;
  from?: string;
  to?: string;
}

export type AdminOrderStatus = 'fulfilled' | 'cancelled' | 'refunded';

export interface ManualOrderLineInput {
  sourceType: string;
  sourceId: string;
  variantId?: string;
  options?: Record<string, string>;
  quantity: number;
}

export interface ManualOrderInput {
  customerUserId: string;
  lines: ManualOrderLineInput[];
  discountCode?: string;
  shippingMethodId?: string;
  shippingAddress?: PostalAddressInput;
  internalNotes?: string;
}

export type SalesPeriodDto = 'week' | 'month' | 'year';

export interface SalesReportDto {
  period: SalesPeriodDto;
  currency: string;
  timezone: string;
  buckets: { label: string; revenueCents: number; orderCount: number }[];
  totals: { revenueCents: number; orderCount: number; previousRevenueCents: number; previousOrderCount: number };
  awaitingFulfillmentCount: number;
}

// ---- Subscriptions ----

export interface AdminSubscriptionDto {
  id: string;
  userId: string;
  orderId: string;
  currency: string;
  provider: string;
  providerSubscriptionId: string;
  status: BillingSubscriptionStatus;
  interval: BillingInterval;
  intervalCount: number;
  currentPeriodEnd?: string;
  endsAt?: string;
  lines: {
    id: string;
    name: string;
    sourceType: string;
    sourceId: string;
    unitAmountCents: number;
    quantity: number;
    status: 'active' | 'removed';
    removedAt?: string;
  }[];
  canceledAt?: string;
  createdAt: string;
  customer: PersonDto;
}

export interface ListSubscriptionsAdminParams {
  page: number;
  pageSize: number;
  status?: BillingSubscriptionStatus;
}

export const ecommerceAdminApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listProductsAdmin: builder.query<PaginatedList<AdminProductDto>, ListProductsAdminParams>({
      query: ({ page, pageSize, search, searchField }) => withQuery('/api/products/admin', { page, pageSize, search, searchField }),
      transformResponse: buildPaginatedList<AdminProductDto>,
      providesTags: ['Product'],
    }),
    listAllProductCategories: builder.query<string[], void>({
      query: () => '/api/products/admin/categories',
      transformResponse: unwrap<string[]>,
      providesTags: ['Product'],
    }),
    createProduct: builder.mutation<AdminProductDto, ProductWriteInput>({
      query: (body) => ({ url: '/api/products', method: 'POST', body }),
      transformResponse: unwrap<AdminProductDto>,
      invalidatesTags: ['Product'],
    }),
    updateProduct: builder.mutation<AdminProductDto, ClearableUpdate<ProductWriteInput> & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/api/products/${id}`, method: 'PUT', body }),
      transformResponse: unwrap<AdminProductDto>,
      invalidatesTags: ['Product', 'Cart'],
    }),
    deleteProduct: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/products/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Product', 'Cart'],
    }),
    uploadProductImageLocal: builder.mutation<{ url: string; storageKey: string }, { file: File }>({
      query: ({ file }) => {
        const formData = new FormData();
        formData.append('file', file);
        return { url: '/api/products/upload', method: 'POST', body: formData };
      },
      transformResponse: unwrap<{ url: string; storageKey: string }>,
    }),

    listDiscounts: builder.query<PaginatedList<DiscountDto>, { page: number; pageSize: number; search?: string }>({
      query: ({ page, pageSize, search }) => withQuery('/api/discounts', { page, pageSize, search }),
      transformResponse: buildPaginatedList<DiscountDto>,
      providesTags: ['Discount'],
    }),
    listDiscountSourceTypes: builder.query<string[], void>({
      query: () => '/api/discounts/source-types',
      transformResponse: unwrap<string[]>,
    }),
    createDiscount: builder.mutation<DiscountDto, DiscountWriteInput>({
      query: (body) => ({ url: '/api/discounts', method: 'POST', body }),
      transformResponse: unwrap<DiscountDto>,
      invalidatesTags: ['Discount'],
    }),
    updateDiscount: builder.mutation<DiscountDto, ClearableUpdate<DiscountWriteInput> & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/api/discounts/${id}`, method: 'PUT', body }),
      transformResponse: unwrap<DiscountDto>,
      invalidatesTags: ['Discount', 'Cart'],
    }),
    deleteDiscount: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/discounts/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Discount', 'Cart'],
    }),

    listShippingMethodsAdmin: builder.query<AdminShippingMethodDto[], void>({
      query: () => '/api/shipping-methods/admin',
      transformResponse: unwrap<AdminShippingMethodDto[]>,
      providesTags: ['ShippingMethod'],
    }),
    createShippingMethod: builder.mutation<AdminShippingMethodDto, ShippingMethodWriteInput>({
      query: (body) => ({ url: '/api/shipping-methods', method: 'POST', body }),
      transformResponse: unwrap<AdminShippingMethodDto>,
      invalidatesTags: ['ShippingMethod'],
    }),
    updateShippingMethod: builder.mutation<AdminShippingMethodDto, ClearableUpdate<ShippingMethodWriteInput> & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/api/shipping-methods/${id}`, method: 'PUT', body }),
      transformResponse: unwrap<AdminShippingMethodDto>,
      invalidatesTags: ['ShippingMethod'],
    }),
    deleteShippingMethod: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/shipping-methods/${id}`, method: 'DELETE' }),
      invalidatesTags: ['ShippingMethod'],
    }),

    listOrdersAdmin: builder.query<PaginatedList<AdminOrderDto>, ListOrdersAdminParams>({
      query: ({ page, pageSize, status, kind, userId, from, to }) =>
        withQuery('/api/orders/admin', { page, pageSize, status, kind, userId, from, to }),
      transformResponse: buildPaginatedList<AdminOrderDto>,
      providesTags: ['Order'],
    }),
    getOrderAdmin: builder.query<AdminOrderDto, string>({
      query: (id) => `/api/orders/admin/${id}`,
      transformResponse: unwrap<AdminOrderDto>,
      providesTags: ['Order'],
    }),
    setOrderStatusAdmin: builder.mutation<AdminOrderDto, { id: string; status: AdminOrderStatus; note?: string }>({
      query: ({ id, ...body }) => ({ url: `/api/orders/admin/${id}/status`, method: 'PATCH', body }),
      transformResponse: unwrap<AdminOrderDto>,
      invalidatesTags: ['Order'],
    }),
    updateOrderAdmin: builder.mutation<AdminOrderDto, { id: string; internalNotes?: string; trackingNumber?: string }>({
      query: ({ id, ...body }) => ({ url: `/api/orders/admin/${id}`, method: 'PATCH', body }),
      transformResponse: unwrap<AdminOrderDto>,
      invalidatesTags: ['Order'],
    }),
    getSalesReport: builder.query<SalesReportDto, { period: SalesPeriodDto; timezone: string }>({
      query: ({ period, timezone }) => withQuery('/api/orders/admin/stats', { period, tz: timezone }),
      transformResponse: unwrap<SalesReportDto>,
      providesTags: ['Order'],
    }),
    searchOrderCustomers: builder.query<PersonDto[], string>({
      query: (search) => withQuery('/api/orders/admin/customers', { search }),
      transformResponse: unwrap<PersonDto[]>,
    }),
    quoteManualOrder: builder.mutation<CheckoutQuoteDto, ManualOrderInput>({
      query: (body) => ({ url: '/api/orders/admin/quote', method: 'POST', body }),
      transformResponse: unwrap<CheckoutQuoteDto>,
    }),
    createManualOrder: builder.mutation<AdminOrderDto, ManualOrderInput>({
      query: (body) => ({ url: '/api/orders/admin', method: 'POST', body }),
      transformResponse: unwrap<AdminOrderDto>,
      invalidatesTags: ['Order', 'Product'],
    }),

    listSubscriptionsAdmin: builder.query<PaginatedList<AdminSubscriptionDto>, ListSubscriptionsAdminParams>({
      query: ({ page, pageSize, status }) => withQuery('/api/subscriptions/admin', { page, pageSize, status }),
      transformResponse: buildPaginatedList<AdminSubscriptionDto>,
      providesTags: ['Subscription'],
    }),
    cancelSubscriptionAdmin: builder.mutation<AdminSubscriptionDto, string>({
      query: (id) => ({ url: `/api/subscriptions/admin/${id}/cancel`, method: 'POST' }),
      transformResponse: unwrap<AdminSubscriptionDto>,
      invalidatesTags: ['Subscription'],
    }),
  }),
});

export const {
  useListProductsAdminQuery,
  useListAllProductCategoriesQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useUploadProductImageLocalMutation,
  useListDiscountsQuery,
  useListDiscountSourceTypesQuery,
  useCreateDiscountMutation,
  useUpdateDiscountMutation,
  useDeleteDiscountMutation,
  useListShippingMethodsAdminQuery,
  useCreateShippingMethodMutation,
  useUpdateShippingMethodMutation,
  useDeleteShippingMethodMutation,
  useListOrdersAdminQuery,
  useGetOrderAdminQuery,
  useSetOrderStatusAdminMutation,
  useUpdateOrderAdminMutation,
  useGetSalesReportQuery,
  useSearchOrderCustomersQuery,
  useQuoteManualOrderMutation,
  useCreateManualOrderMutation,
  useListSubscriptionsAdminQuery,
  useCancelSubscriptionAdminMutation,
} = ecommerceAdminApi;

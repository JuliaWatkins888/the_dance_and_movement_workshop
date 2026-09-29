import type { ApiResponse } from '@inithium/api-utils';
import type { BillingInterval, OrderKind, OrderStatus } from '@inithium/db';
import { baseApi } from '../baseApi';

// Frontend-facing shapes of the ecommerce API - dates cross the HTTP boundary as ISO strings,
// matching every other plugin's Dto convention. All money is integer minor units (cents) in
// StoreConfigDto.currency; format it with formatMoney.

export interface StoreConfigDto {
  currency: string;
  // null until the payment provider is configured on the API.
  payment: { provider: string; publishableKey: string } | null;
}

export type ProductBillingDto = { type: 'one_time' } | { type: 'recurring'; interval: BillingInterval; intervalCount: number };

export interface ProductOptionDto {
  name: string;
  values: string[];
}

export interface ProductVariantDto {
  id: string;
  sku?: string;
  optionValues: Record<string, string>;
  priceCents?: number;
  stockQuantity: number | null;
  isActive: boolean;
}

export interface ProductDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  categories: string[];
  imageUrl?: string;
  basePriceCents: number;
  requiresShipping: boolean;
  billing: ProductBillingDto;
  options: ProductOptionDto[];
  variants: ProductVariantDto[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListProductsParams {
  page: number;
  pageSize: number;
  category?: string;
  search?: string;
}

export interface PaginatedList<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ShippingMethodDto {
  id: string;
  name: string;
  description?: string;
  amountCents: number;
  freeOverCents?: number;
  requiresAddress: boolean;
}

export type LineBillingDto =
  | { type: 'one_time' }
  | {
      type: 'recurring';
      interval: BillingInterval;
      intervalCount: number;
      recurringUnitAmountCents: number;
      recurringDiscountCents: number;
      firstBillingAt: string;
      endsAt?: string;
    };

export interface DiscountStateDto {
  code: string;
  applied: boolean;
  message?: string;
}

export interface CartLineDto {
  id: string;
  sourceType: string;
  sourceId: string;
  variantId?: string;
  options: Record<string, string>;
  quantity: number;
  available: boolean;
  unavailableReason?: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  href?: string;
  maxQuantity?: number;
  unitAmountCents?: number;
  subtotalCents?: number;
  discountCents?: number;
  billing?: LineBillingDto;
}

export interface CartDto {
  currency: string;
  lines: CartLineDto[];
  discount: DiscountStateDto | null;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  requiresShipping: boolean;
  hasUnavailableLines: boolean;
}

export interface AddCartLineInput {
  sourceType: string;
  sourceId: string;
  variantId?: string;
  options?: Record<string, string>;
  quantity: number;
}

export interface PostalAddressInput {
  name?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface CheckoutDetailsInput {
  shippingMethodId?: string;
  shippingAddress?: PostalAddressInput;
  billingAddress: PostalAddressInput;
}

export interface PlaceOrderInput extends CheckoutDetailsInput {
  paymentToken?: string;
  expectedTotalCents: number;
}

export interface QuoteLineDto {
  id: string;
  sourceType: string;
  sourceId: string;
  variantId?: string;
  options: Record<string, string>;
  name: string;
  imageUrl?: string;
  href?: string;
  quantity: number;
  unitAmountCents: number;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  billing: LineBillingDto;
}

export interface RecurringChargeDto {
  interval: BillingInterval;
  intervalCount: number;
  firstBillingAt: string;
  endsAt?: string;
  amountCents: number;
  lineIds: string[];
}

export interface CheckoutQuoteDto {
  currency: string;
  lines: QuoteLineDto[];
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  discount: DiscountStateDto | null;
  shippingMethod: { id: string; name: string; amountCents: number } | null;
  requiresShipping: boolean;
  recurring: RecurringChargeDto[];
}

export interface OrderLineDto {
  id: string;
  sourceType: string;
  sourceId: string;
  variantId?: string;
  options: Record<string, string>;
  name: string;
  imageUrl?: string;
  href?: string;
  unitAmountCents: number;
  quantity: number;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  billing: LineBillingDto;
}

export interface OrderDto {
  id: string;
  userId: string;
  kind: OrderKind;
  status: OrderStatus;
  currency: string;
  lines: OrderLineDto[];
  totals: { subtotalCents: number; discountCents: number; shippingCents: number; taxCents: number; totalCents: number };
  discount?: { code: string };
  shipping?: { name: string; amountCents: number };
  shippingAddress?: PostalAddressInput;
  billingAddress?: PostalAddressInput;
  statusHistory: { status: OrderStatus; at: string; note?: string }[];
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type PlaceOrderResultDto =
  | { status: 'paid' | 'processing'; order: OrderDto }
  | { status: 'requires_action'; order: OrderDto; clientSecret: string };

// Cart and order caches are keyed by the signed-in user's id (the argument is only a cache key -
// the API always answers for the bearer token). Logging out doesn't reset RTK Query's cache, so
// this keeps one account's cart from ever rendering for the next account on the same browser.
export interface ListMyOrdersParams {
  userId: string;
  page: number;
  pageSize: number;
}

const buildPaginatedList = <T>(response: ApiResponse<T[]>): PaginatedList<T> => ({
  items: response.data,
  page: (response.meta?.['page'] as number) ?? 1,
  pageSize: (response.meta?.['pageSize'] as number) ?? response.data.length,
  total: (response.meta?.['total'] as number) ?? response.data.length,
  totalPages: (response.meta?.['totalPages'] as number) ?? 1,
});

const unwrap = <T>(response: ApiResponse<T>): T => response.data;

export const ecommerceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getStoreConfig: builder.query<StoreConfigDto, void>({
      query: () => '/api/store/config',
      transformResponse: unwrap<StoreConfigDto>,
    }),
    listProducts: builder.query<PaginatedList<ProductDto>, ListProductsParams>({
      query: ({ page, pageSize, category, search }) => {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (category) params.set('category', category);
        if (search) params.set('search', search);
        return `/api/products?${params.toString()}`;
      },
      transformResponse: buildPaginatedList<ProductDto>,
      providesTags: ['Product'],
    }),
    listProductCategories: builder.query<string[], void>({
      query: () => '/api/products/categories',
      transformResponse: unwrap<string[]>,
      providesTags: ['Product'],
    }),
    getProductBySlug: builder.query<ProductDto, string>({
      query: (slug) => `/api/products/slug/${encodeURIComponent(slug)}`,
      transformResponse: unwrap<ProductDto>,
      providesTags: ['Product'],
    }),
    listShippingMethods: builder.query<ShippingMethodDto[], void>({
      query: () => '/api/shipping-methods',
      transformResponse: unwrap<ShippingMethodDto[]>,
    }),

    getCart: builder.query<CartDto, string>({
      query: () => '/api/cart',
      transformResponse: unwrap<CartDto>,
      providesTags: ['Cart'],
    }),
    addCartLine: builder.mutation<CartDto, AddCartLineInput>({
      query: (body) => ({ url: '/api/cart/lines', method: 'POST', body }),
      transformResponse: unwrap<CartDto>,
      onQueryStarted: (_arg, api) => syncCartCache(api),
    }),
    updateCartLineQuantity: builder.mutation<CartDto, { lineId: string; quantity: number }>({
      query: ({ lineId, quantity }) => ({ url: `/api/cart/lines/${lineId}`, method: 'PATCH', body: { quantity } }),
      transformResponse: unwrap<CartDto>,
      onQueryStarted: (_arg, api) => syncCartCache(api),
    }),
    removeCartLine: builder.mutation<CartDto, string>({
      query: (lineId) => ({ url: `/api/cart/lines/${lineId}`, method: 'DELETE' }),
      transformResponse: unwrap<CartDto>,
      onQueryStarted: (_arg, api) => syncCartCache(api),
    }),
    clearCart: builder.mutation<CartDto, void>({
      query: () => ({ url: '/api/cart', method: 'DELETE' }),
      transformResponse: unwrap<CartDto>,
      onQueryStarted: (_arg, api) => syncCartCache(api),
    }),
    applyCartDiscountCode: builder.mutation<CartDto, string>({
      query: (code) => ({ url: '/api/cart/discount', method: 'PUT', body: { code } }),
      transformResponse: unwrap<CartDto>,
      onQueryStarted: (_arg, api) => syncCartCache(api),
    }),
    removeCartDiscountCode: builder.mutation<CartDto, void>({
      query: () => ({ url: '/api/cart/discount', method: 'DELETE' }),
      transformResponse: unwrap<CartDto>,
      onQueryStarted: (_arg, api) => syncCartCache(api),
    }),

    // A mutation rather than a query: it's an on-demand calculation for the current form state
    // (and costs a tax-provider call), not a cacheable resource.
    quoteCheckout: builder.mutation<CheckoutQuoteDto, CheckoutDetailsInput>({
      query: (body) => ({ url: '/api/checkout/quote', method: 'POST', body }),
      transformResponse: unwrap<CheckoutQuoteDto>,
    }),
    placeOrder: builder.mutation<PlaceOrderResultDto, PlaceOrderInput>({
      query: (body) => ({ url: '/api/checkout', method: 'POST', body }),
      transformResponse: unwrap<PlaceOrderResultDto>,
      invalidatesTags: ['Cart', 'Order', 'Product'],
    }),
    confirmOrderPayment: builder.mutation<PlaceOrderResultDto, string>({
      query: (orderId) => ({ url: `/api/checkout/orders/${orderId}/confirm`, method: 'POST' }),
      transformResponse: unwrap<PlaceOrderResultDto>,
      invalidatesTags: ['Cart', 'Order', 'Product'],
    }),

    listMyOrders: builder.query<PaginatedList<OrderDto>, ListMyOrdersParams>({
      query: ({ page, pageSize }) => `/api/orders/mine?${new URLSearchParams({ page: String(page), pageSize: String(pageSize) })}`,
      transformResponse: buildPaginatedList<OrderDto>,
      providesTags: ['Order'],
    }),
    getMyOrder: builder.query<OrderDto, { userId: string; orderId: string }>({
      query: ({ orderId }) => `/api/orders/mine/${orderId}`,
      transformResponse: unwrap<OrderDto>,
      providesTags: ['Order'],
    }),
  }),
});

type CartMutationApi = {
  dispatch: (action: unknown) => unknown;
  getState: () => unknown;
  queryFulfilled: Promise<{ data: CartDto }>;
};

// Every cart mutation answers with the full, freshly priced cart, so the cached cart is replaced
// from that response instead of refetched.
async function syncCartCache({ dispatch, getState, queryFulfilled }: CartMutationApi): Promise<void> {
  try {
    const { data } = await queryFulfilled;
    const state = getState() as Parameters<typeof ecommerceApi.util.selectCachedArgsForQuery>[0];
    for (const userId of ecommerceApi.util.selectCachedArgsForQuery(state, 'getCart')) {
      dispatch(ecommerceApi.util.upsertQueryData('getCart', userId, data));
    }
  } catch {
    // The mutation's own caller surfaces the error; the cached cart stays as it was.
  }
}

export const {
  useGetStoreConfigQuery,
  useListProductsQuery,
  useListProductCategoriesQuery,
  useGetProductBySlugQuery,
  useListShippingMethodsQuery,
  useGetCartQuery,
  useAddCartLineMutation,
  useUpdateCartLineQuantityMutation,
  useRemoveCartLineMutation,
  useClearCartMutation,
  useApplyCartDiscountCodeMutation,
  useRemoveCartDiscountCodeMutation,
  useQuoteCheckoutMutation,
  usePlaceOrderMutation,
  useConfirmOrderPaymentMutation,
  useListMyOrdersQuery,
  useGetMyOrderQuery,
} = ecommerceApi;

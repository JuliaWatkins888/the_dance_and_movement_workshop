import type { ApiResponse } from '@inithium/api-utils';
import type { NavLocation, PageEntity } from '@inithium/db';
import { baseApi } from '../baseApi';

export type PageSearchField = 'title' | 'slug' | 'routePattern';

export interface ListPagesParams {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: PageSearchField;
}

export interface ListPagesResult {
  items: PageEntity[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// Excludes slug/isPluginPage/pluginOrigin/createdAt/updatedAt at the type level - these are
// developer/system-owned, not admin-editable, so accidentally including one in an update
// payload is a compile error here rather than something the CMS module has to remember by
// discipline alone.
export type UpdatePageInput = Partial<
  Omit<PageEntity, 'id' | 'slug' | 'isPluginPage' | 'pluginOrigin' | 'createdAt' | 'updatedAt'>
> & { id: string };

export const pageApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPageByRoute: builder.query<PageEntity, { route: string }>({
      query: ({ route }) => `/api/pages/resolve?route=${encodeURIComponent(route)}`,
      // Every core API response is wrapped as { success: true, data: T } by
      // createSuccessResponse — unwrap it here so the hook's declared return
      // type (PageEntity) matches what callers actually receive at runtime.
      transformResponse: (response: ApiResponse<PageEntity>) => response.data,
      providesTags: (result) => (result ? [{ type: 'Page', id: result.id }] : ['Page']),
    }),
    getNavPages: builder.query<PageEntity[], NavLocation>({
      query: (location) => `/api/pages/navigation/${location}`,
      transformResponse: (response: ApiResponse<PageEntity[]>) => response.data,
      providesTags: ['Page'],
    }),
    listPages: builder.query<ListPagesResult, ListPagesParams>({
      query: ({ page, pageSize, search, searchField }) => {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (search) params.set('search', search);
        if (searchField) params.set('searchField', searchField);
        return `/api/pages?${params.toString()}`;
      },
      transformResponse: (response: ApiResponse<PageEntity[]>): ListPagesResult => ({
        items: response.data,
        page: (response.meta?.['page'] as number) ?? 1,
        pageSize: (response.meta?.['pageSize'] as number) ?? response.data.length,
        total: (response.meta?.['total'] as number) ?? response.data.length,
        totalPages: (response.meta?.['totalPages'] as number) ?? 1,
      }),
      providesTags: ['Page'],
    }),
    updatePage: builder.mutation<PageEntity, UpdatePageInput>({
      query: ({ id, ...input }) => ({ url: `/api/pages/${id}`, method: 'PATCH', body: input }),
      transformResponse: (response: ApiResponse<PageEntity>) => response.data,
      invalidatesTags: ['Page'],
    }),
  }),
});

export const { useGetPageByRouteQuery, useGetNavPagesQuery, useListPagesQuery, useUpdatePageMutation } = pageApi;

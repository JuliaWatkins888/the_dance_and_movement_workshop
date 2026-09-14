import type { ApiResponse } from '@inithium/api-utils';
import { baseApi } from '../baseApi';

// Frontend-facing shape - dates cross the HTTP boundary as ISO strings, mirroring every other
// plugin's own Dto precedent (see StaffMemberDto). `content` is sanitized HTML produced by the
// CMS's Tiptap editor.
export interface PolicyItemDto {
  id: string;
  title: string;
  content: string;
  order: number;
}

export interface PolicyCategoryDto {
  id: string;
  title: string;
  icon?: string;
  order: number;
  items: PolicyItemDto[];
  createdAt: string;
  updatedAt: string;
}

export interface PolicyCategoryWriteInput {
  title: string;
  icon?: string;
  order?: number;
}

export type UpdatePolicyCategoryInput = Partial<PolicyCategoryWriteInput> & { id: string };

export interface PolicyItemWriteInput {
  categoryId: string;
  title: string;
  content: string;
  order?: number;
}

export type UpdatePolicyItemInput = Partial<Omit<PolicyItemWriteInput, 'categoryId'>> & {
  categoryId: string;
  itemId: string;
};

export const policiesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listPolicies: builder.query<PolicyCategoryDto[], void>({
      query: () => '/api/policies',
      transformResponse: (response: ApiResponse<PolicyCategoryDto[]>) => response.data,
      providesTags: ['PolicyCategory'],
    }),
    createPolicyCategory: builder.mutation<PolicyCategoryDto, PolicyCategoryWriteInput>({
      query: (input) => ({ url: '/api/policies/categories', method: 'POST', body: input }),
      transformResponse: (response: ApiResponse<PolicyCategoryDto>) => response.data,
      invalidatesTags: ['PolicyCategory'],
    }),
    updatePolicyCategory: builder.mutation<PolicyCategoryDto, UpdatePolicyCategoryInput>({
      query: ({ id, ...input }) => ({ url: `/api/policies/categories/${id}`, method: 'PUT', body: input }),
      transformResponse: (response: ApiResponse<PolicyCategoryDto>) => response.data,
      invalidatesTags: ['PolicyCategory'],
    }),
    deletePolicyCategory: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/policies/categories/${id}`, method: 'DELETE' }),
      invalidatesTags: ['PolicyCategory'],
    }),
    createPolicyItem: builder.mutation<PolicyCategoryDto, PolicyItemWriteInput>({
      query: ({ categoryId, ...input }) => ({
        url: `/api/policies/categories/${categoryId}/items`,
        method: 'POST',
        body: input,
      }),
      transformResponse: (response: ApiResponse<PolicyCategoryDto>) => response.data,
      invalidatesTags: ['PolicyCategory'],
    }),
    updatePolicyItem: builder.mutation<PolicyCategoryDto, UpdatePolicyItemInput>({
      query: ({ categoryId, itemId, ...input }) => ({
        url: `/api/policies/categories/${categoryId}/items/${itemId}`,
        method: 'PUT',
        body: input,
      }),
      transformResponse: (response: ApiResponse<PolicyCategoryDto>) => response.data,
      invalidatesTags: ['PolicyCategory'],
    }),
    deletePolicyItem: builder.mutation<PolicyCategoryDto, { categoryId: string; itemId: string }>({
      query: ({ categoryId, itemId }) => ({
        url: `/api/policies/categories/${categoryId}/items/${itemId}`,
        method: 'DELETE',
      }),
      transformResponse: (response: ApiResponse<PolicyCategoryDto>) => response.data,
      invalidatesTags: ['PolicyCategory'],
    }),
  }),
});

export const {
  useListPoliciesQuery,
  useCreatePolicyCategoryMutation,
  useUpdatePolicyCategoryMutation,
  useDeletePolicyCategoryMutation,
  useCreatePolicyItemMutation,
  useUpdatePolicyItemMutation,
  useDeletePolicyItemMutation,
} = policiesApi;

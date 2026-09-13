import type { ApiResponse } from '@inithium/api-utils';
import type { CommunicationAuthorRole, CommunicationSearchField } from '@inithium/db';
import { baseApi } from '../baseApi';

// Frontend-facing shape, not @inithium/db's CommunicationEntity - dates cross the HTTP boundary
// as ISO strings, not Date instances, mirroring GalleryImageDto's own precedent.
export interface CommunicationMessageDto {
  id: string;
  authorRole: CommunicationAuthorRole;
  authorUserId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface CommunicationDto {
  id: string;
  submitterUserId: string;
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  messages: CommunicationMessageDto[];
  createdAt: string;
  updatedAt: string;
}

export interface SubmitContactInput {
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
  // Honeypot - always sent empty by ContactPage's real form; only a bot that auto-fills every
  // field would ever populate it.
  companyWebsite?: string;
  turnstileToken?: string;
}

export interface AddContactMessageInput {
  id: string;
  body: string;
}

export interface ListContactInboxParams {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: CommunicationSearchField;
}

export interface ListContactInboxResult {
  items: CommunicationDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const buildListResult = (response: ApiResponse<CommunicationDto[]>): ListContactInboxResult => ({
  items: response.data,
  page: (response.meta?.['page'] as number) ?? 1,
  pageSize: (response.meta?.['pageSize'] as number) ?? response.data.length,
  total: (response.meta?.['total'] as number) ?? response.data.length,
  totalPages: (response.meta?.['totalPages'] as number) ?? 1,
});

export const contactApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    submitContact: builder.mutation<CommunicationDto | null, SubmitContactInput>({
      query: (input) => ({ url: '/api/contact', method: 'POST', body: input }),
      transformResponse: (response: ApiResponse<CommunicationDto | null>) => response.data,
      invalidatesTags: ['Communication'],
    }),
    addContactMessage: builder.mutation<CommunicationDto, AddContactMessageInput>({
      query: ({ id, body }) => ({ url: `/api/contact/${id}/messages`, method: 'POST', body: { body } }),
      transformResponse: (response: ApiResponse<CommunicationDto>) => response.data,
      invalidatesTags: ['Communication'],
    }),
    getContactInbox: builder.query<ListContactInboxResult, ListContactInboxParams>({
      query: ({ page, pageSize, search, searchField }) => {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (search) params.set('search', search);
        if (searchField) params.set('searchField', searchField);
        return `/api/contact?${params.toString()}`;
      },
      transformResponse: buildListResult,
      providesTags: ['Communication'],
    }),
    getMyContactThreads: builder.query<CommunicationDto[], void>({
      query: () => '/api/contact/mine',
      transformResponse: (response: ApiResponse<CommunicationDto[]>) => response.data,
      providesTags: ['Communication'],
    }),
    getContactThread: builder.query<CommunicationDto, string>({
      query: (id) => `/api/contact/${id}`,
      transformResponse: (response: ApiResponse<CommunicationDto>) => response.data,
      providesTags: ['Communication'],
    }),
    // Permanent - the server also sweeps every notification this thread ever generated (both
    // the submitter's and the recipient's), so nothing dangling is left in either notification
    // center. Admin/editor only, enforced server-side.
    deleteContact: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/contact/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Communication'],
    }),
  }),
});

export const {
  useSubmitContactMutation,
  useAddContactMessageMutation,
  useGetContactInboxQuery,
  useGetMyContactThreadsQuery,
  useGetContactThreadQuery,
  useDeleteContactMutation,
} = contactApi;

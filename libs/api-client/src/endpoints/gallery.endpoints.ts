import type { ApiResponse } from '@inithium/api-utils';
import type { GalleryImageSearchField, GalleryImageSourceType } from '@inithium/db';
import { baseApi } from '../baseApi';

// Frontend-facing shape, not @inithium/db's GalleryImageEntity - dates cross the HTTP boundary as
// ISO strings, not Date instances, mirroring BlogPostEntity's own precedent in blog.endpoints.ts.
export interface GalleryImageDto {
  id: string;
  title: string;
  description?: string;
  altText?: string;
  metadata?: Record<string, unknown>;
  sourceType: GalleryImageSourceType;
  url: string;
  assetId?: string;
  storageKey?: string;
  isPublished: boolean;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListPublishedGalleryImagesParams {
  page: number;
  pageSize: number;
}

export interface ListGalleryImagesAdminParams {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: GalleryImageSearchField;
}

export interface ListGalleryImagesResult {
  items: GalleryImageDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface GalleryImageWriteInput {
  title: string;
  description?: string;
  altText?: string;
  metadata?: Record<string, unknown>;
  isPublished?: boolean;
  sourceType: GalleryImageSourceType;
  url: string;
  assetId?: string;
  storageKey?: string;
}

export type UpdateGalleryImageInput = Partial<GalleryImageWriteInput> & { id: string };

export interface UploadGalleryImageLocalResult {
  url: string;
  storageKey: string;
}

const buildListResult = (response: ApiResponse<GalleryImageDto[]>): ListGalleryImagesResult => ({
  items: response.data,
  page: (response.meta?.['page'] as number) ?? 1,
  pageSize: (response.meta?.['pageSize'] as number) ?? response.data.length,
  total: (response.meta?.['total'] as number) ?? response.data.length,
  totalPages: (response.meta?.['totalPages'] as number) ?? 1,
});

export const galleryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listPublishedGalleryImages: builder.query<ListGalleryImagesResult, ListPublishedGalleryImagesParams>({
      query: ({ page, pageSize }) => `/api/gallery?${new URLSearchParams({ page: String(page), pageSize: String(pageSize) })}`,
      transformResponse: buildListResult,
      providesTags: ['GalleryImage'],
    }),
    listGalleryImagesAdmin: builder.query<ListGalleryImagesResult, ListGalleryImagesAdminParams>({
      query: ({ page, pageSize, search, searchField }) => {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (search) params.set('search', search);
        if (searchField) params.set('searchField', searchField);
        return `/api/gallery/admin?${params.toString()}`;
      },
      transformResponse: buildListResult,
      providesTags: ['GalleryImage'],
    }),
    // fetchBaseQuery passes a FormData body through untouched (no JSON.stringify, the browser
    // sets the multipart boundary), so no baseApi.ts change is needed for this - same pattern
    // storage.endpoints.ts's own uploadAsset mutation already uses.
    uploadGalleryImageLocal: builder.mutation<UploadGalleryImageLocalResult, { file: File }>({
      query: ({ file }) => {
        const formData = new FormData();
        formData.append('file', file);
        return { url: '/api/gallery/upload', method: 'POST', body: formData };
      },
      transformResponse: (response: ApiResponse<UploadGalleryImageLocalResult>) => response.data,
    }),
    createGalleryImage: builder.mutation<GalleryImageDto, GalleryImageWriteInput>({
      query: (input) => ({ url: '/api/gallery', method: 'POST', body: input }),
      transformResponse: (response: ApiResponse<GalleryImageDto>) => response.data,
      invalidatesTags: ['GalleryImage'],
    }),
    updateGalleryImage: builder.mutation<GalleryImageDto, UpdateGalleryImageInput>({
      query: ({ id, ...input }) => ({ url: `/api/gallery/${id}`, method: 'PUT', body: input }),
      transformResponse: (response: ApiResponse<GalleryImageDto>) => response.data,
      invalidatesTags: ['GalleryImage'],
    }),
    deleteGalleryImage: builder.mutation<void, string>({
      query: (id) => ({ url: `/api/gallery/${id}`, method: 'DELETE' }),
      invalidatesTags: ['GalleryImage'],
    }),
  }),
});

export const {
  useListPublishedGalleryImagesQuery,
  useListGalleryImagesAdminQuery,
  useUploadGalleryImageLocalMutation,
  useCreateGalleryImageMutation,
  useUpdateGalleryImageMutation,
  useDeleteGalleryImageMutation,
} = galleryApi;

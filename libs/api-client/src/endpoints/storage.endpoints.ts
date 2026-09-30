import type { ApiResponse } from '@inithium/api-utils';
import { baseApi } from '../baseApi';

export interface UploadAssetResult {
  url: string;
  assetId: string;
}

// Mirrors the server's closed UPLOAD_PURPOSE_CAPABILITIES (storage.schema.ts) - each purpose is
// gated by the capability owning that image field, and there is deliberately no avatar/banner.
export type UploadPurpose = 'gallery' | 'staff' | 'program' | 'workshop' | 'product' | 'setting';

export interface UploadAssetInput {
  file: File;
  purpose: UploadPurpose;
  altText?: string;
}

export const storageApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    uploadAsset: builder.mutation<UploadAssetResult, UploadAssetInput>({
      query: ({ file, altText, purpose }) => {
        // fetchBaseQuery passes a FormData body through untouched (no JSON.stringify, the
        // browser sets the multipart boundary), so no baseApi.ts change is needed for this.
        const formData = new FormData();
        formData.append('file', file);
        formData.append('purpose', purpose);
        if (altText) {
          formData.append('altText', altText);
        }
        return { url: '/api/storage/upload', method: 'POST', body: formData };
      },
      transformResponse: (response: ApiResponse<UploadAssetResult>) => response.data,
      invalidatesTags: ['Asset'],
    }),
    // Discards an upload that was never attached to a record (e.g. its dialog was cancelled).
    deleteAsset: builder.mutation<void, string>({
      query: (assetId) => ({ url: `/api/storage/assets/${assetId}`, method: 'DELETE' }),
      invalidatesTags: ['Asset'],
    }),
  }),
});

export const { useUploadAssetMutation, useDeleteAssetMutation } = storageApi;

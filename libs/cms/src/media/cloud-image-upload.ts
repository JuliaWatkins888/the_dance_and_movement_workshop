import { useCallback } from 'react';
import { readApiError, useUploadAssetMutation } from '@inithium/api-client';
import type { UploadAssetResult, UploadPurpose } from '@inithium/api-client';

// Mirrors the server's multer limits in api-core's storage.route.ts.
export const UPLOAD_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const UPLOAD_IMAGE_ACCEPT = UPLOAD_IMAGE_MIME_TYPES.join(',');
export const UPLOAD_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const UNSUPPORTED_IMAGE_MESSAGE = 'Only JPEG, PNG, WebP or GIF images (max 5 MB) can be uploaded here.';
const UNSUPPORTED_CROPPED_IMAGE_MESSAGE = 'Only JPEG, PNG, WebP or GIF images can be uploaded here.';

const UPLOAD_FAILED_FALLBACK = 'Upload failed. Please try again.';

const isUploadImageType = (file: File): boolean => (UPLOAD_IMAGE_MIME_TYPES as readonly string[]).includes(file.type);

// The picker's `accept` is only a hint - its "All files" option lets anything through - so the
// file is checked again before it's sent.
export const validateUploadImage = (file: File): string | undefined =>
  isUploadImageType(file) && file.size <= UPLOAD_IMAGE_MAX_BYTES ? undefined : UNSUPPORTED_IMAGE_MESSAGE;

// For MediaField's crop flow: the cropped output is re-encoded at <= 1600px, so a large source
// photo is fine - only its type needs checking.
export const validateCroppableImage = (file: File): string | undefined =>
  isUploadImageType(file) ? undefined : UNSUPPORTED_CROPPED_IMAGE_MESSAGE;

// Wraps the upload mutation so failures reject with an Error carrying the server's own message
// (permission denied, storage unavailable, ...) instead of RTK Query's raw { status, data } shape.
export const useCloudImageUpload = (purpose: UploadPurpose) => {
  const [uploadAsset, state] = useUploadAssetMutation();
  const upload = useCallback(
    async (file: File): Promise<UploadAssetResult> => {
      try {
        return await uploadAsset({ file, purpose }).unwrap();
      } catch (error) {
        throw new Error(readApiError(error, UPLOAD_FAILED_FALLBACK).message);
      }
    },
    [uploadAsset, purpose],
  );
  return [upload, state] as const;
};

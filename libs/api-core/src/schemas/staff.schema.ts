import { z } from 'zod';
import { STAFF_PHOTO_SOURCE_TYPES } from '@inithium/db';

// Cross-field: which of photoAssetId/photoStorageKey is required depends on photoSourceType, the
// same discriminated-shape approach gallery.schema.ts uses for its own sourceType/assetId/
// storageKey trio - a photo is entirely optional here (unlike a gallery image), so this only
// fires once photoSourceType itself is actually set.
const requirePhotoSourceFields = (
  data: { photoSourceType?: string; photoUrl?: string; photoAssetId?: string; photoStorageKey?: string },
  ctx: { addIssue: (issue: { code: 'custom'; path: (string | number)[]; message: string }) => void },
) => {
  if (!data.photoSourceType) return;
  if (!data.photoUrl) {
    ctx.addIssue({ code: 'custom', path: ['photoUrl'], message: 'photoUrl is required when photoSourceType is set' });
  }
  if (data.photoSourceType === 'cloud' && !data.photoAssetId) {
    ctx.addIssue({ code: 'custom', path: ['photoAssetId'], message: 'photoAssetId is required for photoSourceType "cloud"' });
  }
  if (data.photoSourceType === 'local' && !data.photoStorageKey) {
    ctx.addIssue({ code: 'custom', path: ['photoStorageKey'], message: 'photoStorageKey is required for photoSourceType "local"' });
  }
};

const staffShape = {
  userId: z.string().min(1, 'A linked user is required'),
  title: z.string().min(1, 'Title is required'),
  bio: z.string().max(2000).optional(),
  photoUrl: z.string().min(1).optional(),
  photoSourceType: z.enum(STAFF_PHOTO_SOURCE_TYPES).optional(),
  photoAssetId: z.string().min(1).optional(),
  photoStorageKey: z.string().min(1).optional(),
  order: z.number().int().optional(),
};

export const createStaffSchema = z.object(staffShape).superRefine(requirePhotoSourceFields);
export type CreateStaffRequestBody = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z.object(staffShape).partial().superRefine(requirePhotoSourceFields);
export type UpdateStaffRequestBody = z.infer<typeof updateStaffSchema>;

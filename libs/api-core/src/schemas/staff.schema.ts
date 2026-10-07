import { z } from 'zod';
import { httpUrlSchema } from './url.schema';
import { STAFF_PHOTO_SOURCE_TYPES } from '@inithium/db';

// Cross-field: a cloud photo must carry its assetId (the route derives photoUrl from it), an
// external one its photoUrl - a photo is entirely optional here (unlike a gallery image), so this
// only fires once photoSourceType itself is actually set.
const requirePhotoSourceFields = (
  data: { photoSourceType?: string | null; photoUrl?: string | null; photoAssetId?: string | null },
  ctx: { addIssue: (issue: { code: 'custom'; path: (string | number)[]; message: string }) => void },
) => {
  if (data.photoSourceType === 'cloud' && !data.photoAssetId) {
    ctx.addIssue({ code: 'custom', path: ['photoAssetId'], message: 'photoAssetId is required for photoSourceType "cloud"' });
  }
  if (data.photoSourceType === 'external' && !data.photoUrl) {
    ctx.addIssue({ code: 'custom', path: ['photoUrl'], message: 'photoUrl is required for photoSourceType "external"' });
  }
};

const staffShape = {
  userId: z.string().min(1, 'A linked user is required'),
  title: z.string().min(1, 'Title is required'),
  bio: z.string().max(2000).optional(),
  photoUrl: httpUrlSchema.optional(),
  photoSourceType: z.enum(STAFF_PHOTO_SOURCE_TYPES).optional(),
  photoAssetId: z.string().min(1).optional(),
  order: z.number().int().optional(),
};

export const createStaffSchema = z.object(staffShape).superRefine(requirePhotoSourceFields);
export type CreateStaffRequestBody = z.infer<typeof createStaffSchema>;

// Photo fields accept null to clear them (removing a photo), mirroring updateProductSchema.
export const updateStaffSchema = z
  .object({
    ...staffShape,
    photoUrl: staffShape.photoUrl.unwrap().nullable(),
    photoSourceType: staffShape.photoSourceType.unwrap().nullable(),
    photoAssetId: staffShape.photoAssetId.unwrap().nullable(),
  })
  .partial()
  .superRefine(requirePhotoSourceFields);
export type UpdateStaffRequestBody = z.infer<typeof updateStaffSchema>;

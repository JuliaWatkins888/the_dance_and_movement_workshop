import { z } from 'zod';
import { COURSE_IMAGE_SOURCE_TYPES } from '@inithium/db';

// Cross-field: which of imageAssetId/imageStorageKey is required depends on imageSourceType, the
// same discriminated-shape approach staff.schema.ts's own requirePhotoSourceFields follows - an
// image is entirely optional here, so this only fires once imageSourceType itself is actually set.
const requireImageSourceFields = (
  data: { imageSourceType?: string; imageUrl?: string; imageAssetId?: string; imageStorageKey?: string },
  ctx: { addIssue: (issue: { code: 'custom'; path: (string | number)[]; message: string }) => void },
) => {
  if (!data.imageSourceType) return;
  if (!data.imageUrl) {
    ctx.addIssue({ code: 'custom', path: ['imageUrl'], message: 'imageUrl is required when imageSourceType is set' });
  }
  if (data.imageSourceType === 'cloud' && !data.imageAssetId) {
    ctx.addIssue({ code: 'custom', path: ['imageAssetId'], message: 'imageAssetId is required for imageSourceType "cloud"' });
  }
  if (data.imageSourceType === 'local' && !data.imageStorageKey) {
    ctx.addIssue({ code: 'custom', path: ['imageStorageKey'], message: 'imageStorageKey is required for imageSourceType "local"' });
  }
};

const courseShape = {
  semesterId: z.string().min(1, 'Semester is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().max(4000).optional(),
  categories: z.array(z.string().min(1)).min(1, 'At least one category is required'),
  imageUrl: z.string().min(1).optional(),
  imageSourceType: z.enum(COURSE_IMAGE_SOURCE_TYPES).optional(),
  imageAssetId: z.string().min(1).optional(),
  imageStorageKey: z.string().min(1).optional(),
  isPublished: z.boolean().optional(),
};

export const createCourseSchema = z.object(courseShape).superRefine(requireImageSourceFields);
export type CreateCourseRequestBody = z.infer<typeof createCourseSchema>;

export const updateCourseSchema = z.object(courseShape).partial().superRefine(requireImageSourceFields);
export type UpdateCourseRequestBody = z.infer<typeof updateCourseSchema>;

import { z } from 'zod';
import { GALLERY_IMAGE_SOURCE_TYPES } from '@inithium/db';

// Cross-field: a cloud image must carry its assetId (the route derives the public url from it),
// an external one its url - superRefine (not a z.discriminatedUnion) because every other field on
// the object is shared and optional regardless of sourceType.
//
// ctx is typed structurally (just the one method actually used) rather than importing zod's own
// refinement-context type by name - that name has changed across zod's own versions/subpaths.
const requireSourceFields = (
  data: { sourceType?: string; url?: string; assetId?: string },
  ctx: { addIssue: (issue: { code: 'custom'; path: (string | number)[]; message: string }) => void },
) => {
  if (data.sourceType === 'cloud' && !data.assetId) {
    ctx.addIssue({ code: 'custom', path: ['assetId'], message: 'assetId is required for sourceType "cloud"' });
  }
  if (data.sourceType === 'external' && !data.url) {
    ctx.addIssue({ code: 'custom', path: ['url'], message: 'url is required for sourceType "external"' });
  }
};

const galleryImageShape = {
  title: z.string().min(1, 'Title is required'),
  description: z.string().max(2000).optional(),
  altText: z.string().max(300).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  isPublished: z.boolean().optional(),
  sourceType: z.enum(GALLERY_IMAGE_SOURCE_TYPES).optional(),
  url: z.string().min(1).optional(),
  assetId: z.string().min(1).optional(),
};

export const createGalleryImageSchema = z
  .object({ ...galleryImageShape, sourceType: z.enum(GALLERY_IMAGE_SOURCE_TYPES), url: z.string().min(1) })
  .superRefine(requireSourceFields);
export type CreateGalleryImageRequestBody = z.infer<typeof createGalleryImageSchema>;

export const updateGalleryImageSchema = z.object(galleryImageShape).partial().superRefine(requireSourceFields);
export type UpdateGalleryImageRequestBody = z.infer<typeof updateGalleryImageSchema>;

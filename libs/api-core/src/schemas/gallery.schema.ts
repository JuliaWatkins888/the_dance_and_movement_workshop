import { z } from 'zod';
import { GALLERY_IMAGE_SOURCE_TYPES } from '@inithium/db';

// Cross-field: which of assetId/storageKey is required depends on sourceType, the same
// discriminated-shape validation settings.schema.ts's upsertSettingSchema already does for
// type/value - superRefine (not a z.discriminatedUnion) because every other field on the object
// is shared and optional regardless of sourceType, so a union would just duplicate the shape
// three times for no benefit.
//
// ctx is typed structurally (just the one method actually used) rather than importing zod's own
// refinement-context type by name - that name has changed across zod's own versions/subpaths
// (v3 exported it as RefinementCtx; this workspace's installed v4 exports it from a different
// subpath as $RefinementCtx), so pinning to whichever one happens to be installed is more fragile
// than describing the shape this function actually depends on.
const requireSourceFields = (
  data: { sourceType?: string; url?: string; assetId?: string; storageKey?: string },
  ctx: { addIssue: (issue: { code: 'custom'; path: (string | number)[]; message: string }) => void },
) => {
  if (!data.sourceType) return;
  if (!data.url) {
    ctx.addIssue({ code: 'custom', path: ['url'], message: 'url is required when sourceType is set' });
  }
  if (data.sourceType === 'cloud' && !data.assetId) {
    ctx.addIssue({ code: 'custom', path: ['assetId'], message: 'assetId is required for sourceType "cloud"' });
  }
  if (data.sourceType === 'local' && !data.storageKey) {
    ctx.addIssue({ code: 'custom', path: ['storageKey'], message: 'storageKey is required for sourceType "local"' });
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
  storageKey: z.string().min(1).optional(),
};

export const createGalleryImageSchema = z
  .object({ ...galleryImageShape, sourceType: z.enum(GALLERY_IMAGE_SOURCE_TYPES), url: z.string().min(1) })
  .superRefine(requireSourceFields);
export type CreateGalleryImageRequestBody = z.infer<typeof createGalleryImageSchema>;

export const updateGalleryImageSchema = z.object(galleryImageShape).partial().superRefine(requireSourceFields);
export type UpdateGalleryImageRequestBody = z.infer<typeof updateGalleryImageSchema>;

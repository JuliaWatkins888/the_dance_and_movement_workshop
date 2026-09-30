import { z } from 'zod';

// Closed on purpose (the plugin ships this free-form): every upload must belong to a staff-managed
// image field, each gated by the capability that owns that field. Deliberately no 'avatar' or
// 'banner' - end users can't upload their own profile images on this site.
export const UPLOAD_PURPOSE_CAPABILITIES = {
  gallery: 'gallery:manage',
  staff: 'staff:manage',
  program: 'classes:manage',
  workshop: 'workshops:manage',
  event: 'events:manage',
  product: 'ecommerce:manage-products',
  setting: 'settings:manage',
} as const;

export type UploadPurpose = keyof typeof UPLOAD_PURPOSE_CAPABILITIES;

const UPLOAD_PURPOSES = Object.keys(UPLOAD_PURPOSE_CAPABILITIES) as [UploadPurpose, ...UploadPurpose[]];

// The uploaded file itself is validated by multer's fileFilter/limits, not Zod - this only
// covers the text fields multer parses alongside it.
export const uploadAssetSchema = z.object({
  altText: z.string().max(500).optional(),
  purpose: z.enum(UPLOAD_PURPOSES),
});
export type UploadAssetRequestBody = z.infer<typeof uploadAssetSchema>;

import { z } from 'zod';
import { NAV_LOCATIONS, PAGE_LAYOUT_TEMPLATES } from '@inithium/db';

const pageAnimationSchema = z.object({
  enter: z.string().min(1),
  exit: z.string().min(1),
  duration: z.number().int().nonnegative(),
  delay: z.number().int().nonnegative(),
});

const pageAccessSchema = z.object({
  isPublic: z.boolean(),
  isAnonymousOnly: z.boolean(),
  requiredRoles: z.array(z.string()),
});

const pageNavigationSchema = z.object({
  locations: z.array(z.enum(NAV_LOCATIONS)),
  label: z.string().min(1),
  order: z.number().int(),
  icon: z.string().optional(),
});

const pageSeoSchema = z
  .object({
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    ogImage: z.string().optional(),
  })
  .optional();

const pageColorSchema = z.object({
  color: z.string().min(1),
  intensity: z.number().int().optional(),
  opacity: z.number().int().optional(),
});

// Fields that have a Mongoose-side `default` are `.optional()` here WITHOUT
// `.default()`. If Zod applied its own default, `.partial()` below would
// re-inject that default into every PATCH request that omits the field,
// silently resetting it on update instead of leaving it untouched.
const pageShape = {
  slug: z.string().min(1),
  title: z.string().min(1),
  routePattern: z.string().min(1),
  isPluginPage: z.boolean().optional(),
  pluginOrigin: z.string().optional(),
  animation: pageAnimationSchema,
  backgroundColor: pageColorSchema.optional(),
  foregroundColor: pageColorSchema.optional(),
  access: pageAccessSchema,
  navigation: pageNavigationSchema,
  seo: pageSeoSchema,
  layoutTemplate: z.enum(PAGE_LAYOUT_TEMPLATES),
  isPublished: z.boolean().optional(),
};

export const createPageSchema = z.object(pageShape);
export type CreatePageRequestBody = z.infer<typeof createPageSchema>;

export const updatePageSchema = z.object(pageShape).partial();
export type UpdatePageRequestBody = z.infer<typeof updatePageSchema>;

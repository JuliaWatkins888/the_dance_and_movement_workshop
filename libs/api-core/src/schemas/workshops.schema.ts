import { z } from 'zod';
import { httpUrlSchema } from './url.schema';
import { COURSE_LEVELS } from '@inithium/db';

// 24-hour "HH:mm" and "YYYY-MM-DD" - native <input type="time"> / <input type="date"> values.
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected 24-hour HH:mm');
const calendarDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, 'Expected an id');
const slugString = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and single dashes');

const ageYears = z.number().min(0).max(120);
const imageUrl = httpUrlSchema;
const imageSourceType = z.enum(['cloud', 'external']);
const hexColor = z.string().regex(/^#[0-9a-f]{3,8}$/i, 'Expected a hex color');

// A cloud image carries its assetId - the route derives the url from the Asset row.
const checkImage = (
  data: { sourceType?: string; assetId?: string; url?: string },
  ctx: z.RefinementCtx,
  paths: { assetId: string; url: string },
) => {
  if (data.sourceType === 'cloud' && !data.assetId) {
    ctx.addIssue({
      code: 'custom',
      path: [paths.assetId],
      message: 'An uploaded image needs its assetId',
    });
  }
  if (data.sourceType === 'external' && !data.url) {
    ctx.addIssue({
      code: 'custom',
      path: [paths.url],
      message: 'An external image needs its url',
    });
  }
};

const workshopDaySchema = z
  .object({
    // Present for a day that already exists - keeps its seat count and registrations attached.
    id: objectIdString.optional(),
    date: calendarDateString,
    startTime: timeString,
    endTime: timeString,
    agenda: z.string().trim().max(4000).optional(),
    capacity: z.number().int().min(0, 'Capacity must be zero or greater'),
  })
  .superRefine((day, ctx) => {
    if (day.endTime <= day.startTime)
      ctx.addIssue({
        code: 'custom',
        path: ['endTime'],
        message: 'End time must be after start time',
      });
  });

const guestInstructorSchema = z
  .object({
    type: z.literal('guest'),
    name: z.string().trim().min(1, 'Guest instructor name is required').max(120),
    bio: z.string().trim().max(4000).optional(),
    photoUrl: imageUrl.optional(),
    photoSourceType: imageSourceType.optional(),
    photoAssetId: z.string().min(1).optional(),
  })
  .superRefine((guest, ctx) =>
    checkImage(
      {
        sourceType: guest.photoSourceType,
        assetId: guest.photoAssetId,
        url: guest.photoUrl,
      },
      ctx,
      {
        assetId: 'photoAssetId',
        url: 'photoUrl',
      },
    ),
  );

const workshopInstructorSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('staff'), staffId: objectIdString }),
  guestInstructorSchema,
]);

// Used for both create and update - the CMS always saves the whole workshop, so an optional field
// missing from an update means it was cleared.
export const workshopWriteSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(120),
    slug: slugString,
    description: z.string().trim().max(8000).optional(),
    dressCode: z.string().trim().max(2000).optional(),
    styles: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
    level: z.enum(COURSE_LEVELS).optional(),
    minAgeYears: ageYears.optional(),
    maxAgeYears: ageYears.optional(),
    instructors: z.array(workshopInstructorSchema).max(10).default([]),
    days: z.array(workshopDaySchema).min(1, 'Add at least one day').max(30),
    pricePerDayCents: z.number().int().min(0, 'Price must be zero or greater'),
    fullWorkshopDiscountPercent: z.number().int().min(0).max(100).default(0),
    imageUrl: imageUrl.optional(),
    imageSourceType: imageSourceType.optional(),
    imageAssetId: z.string().min(1).optional(),
    banner: z
      .object({
        cellSize: z.number().min(10).max(100),
        variance: z.number().min(0).max(1),
        xColors: z.array(hexColor).min(1).max(8),
        yColors: z.array(hexColor).min(1).max(8),
      })
      .optional(),
    isPublished: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.minAgeYears !== undefined && data.maxAgeYears !== undefined && data.maxAgeYears < data.minAgeYears) {
      ctx.addIssue({
        code: 'custom',
        path: ['maxAgeYears'],
        message: 'Max age must be greater than or equal to min age',
      });
    }
    const dates = data.days.map((day) => day.date);
    if (new Set(dates).size !== dates.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['days'],
        message: 'Each day must be on a different date',
      });
    }
    checkImage(
      {
        sourceType: data.imageSourceType,
        assetId: data.imageAssetId,
        url: data.imageUrl,
      },
      ctx,
      {
        assetId: 'imageAssetId',
        url: 'imageUrl',
      },
    );
  });

export type WorkshopWriteBody = z.infer<typeof workshopWriteSchema>;

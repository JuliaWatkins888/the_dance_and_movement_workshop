import { z } from 'zod';
import { EVENT_BULK_DISCOUNT_KINDS } from '@inithium/db';

// 24-hour "HH:mm" and "YYYY-MM-DD" - native <input type="time"> / <input type="date"> values.
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected 24-hour HH:mm');
const calendarDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, 'Expected an id');
const slugString = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and single dashes');
const hexColor = z.string().regex(/^#[0-9a-f]{3,8}$/i, 'Expected a hex color');

const ticketTypeSchema = z.object({
  // Present for a ticket type that already exists - keeps tickets already in carts valid.
  id: objectIdString.optional(),
  name: z.string().trim().min(1, 'Ticket type name is required').max(60),
  priceCents: z.number().int().min(0, 'Price must be zero or greater'),
});

const bulkDiscountSchema = z
  .object({
    minTickets: z.number().int().min(2, 'The group discount needs at least 2 tickets'),
    kind: z.enum(EVENT_BULK_DISCOUNT_KINDS),
    value: z.number().int().min(1, 'The group discount must be more than zero'),
  })
  .refine((bulk) => bulk.kind !== 'percent' || bulk.value <= 100, { path: ['value'], message: 'A percent discount can be at most 100' });

// Used for both create and update - the CMS always saves the whole event, so an optional field
// missing from an update means it was cleared.
export const eventWriteSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(120),
    slug: slugString,
    description: z.string().trim().max(8000).optional(),
    attendeeNotes: z.string().trim().max(4000).optional(),
    date: calendarDateString,
    startTime: timeString,
    endTime: timeString.optional(),
    doorsOpenTime: timeString.optional(),
    salesCloseDate: calendarDateString.optional(),
    salesCloseTime: timeString.optional(),
    isAtStudio: z.boolean(),
    venueName: z.string().trim().min(1).max(120).optional(),
    venueAddress: z.string().trim().min(1).max(300).optional(),
    ticketTypes: z.array(ticketTypeSchema).min(1, 'Add at least one ticket type').max(10),
    bulkDiscount: bulkDiscountSchema.optional(),
    imageUrl: z.string().trim().url().max(2000).optional(),
    imageSourceType: z.enum(['cloud', 'external']).optional(),
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
    if (data.endTime && data.endTime <= data.startTime) {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'End time must be after the start time' });
    }
    if (data.doorsOpenTime && data.doorsOpenTime > data.startTime) {
      ctx.addIssue({ code: 'custom', path: ['doorsOpenTime'], message: 'Doors must open at or before the start time' });
    }
    if (Boolean(data.salesCloseDate) !== Boolean(data.salesCloseTime)) {
      ctx.addIssue({ code: 'custom', path: ['salesCloseTime'], message: 'Give both a date and a time for when sales close' });
    }
    if (!data.isAtStudio && (!data.venueName || !data.venueAddress)) {
      ctx.addIssue({ code: 'custom', path: ['venueName'], message: 'An event away from the studio needs a venue name and address' });
    }
    const names = data.ticketTypes.map((ticketType) => ticketType.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      ctx.addIssue({ code: 'custom', path: ['ticketTypes'], message: 'Each ticket type needs a different name' });
    }
    if (data.imageSourceType === 'cloud' && !data.imageAssetId) {
      ctx.addIssue({ code: 'custom', path: ['imageAssetId'], message: 'An uploaded image needs its assetId' });
    }
    if (data.imageSourceType === 'external' && !data.imageUrl) {
      ctx.addIssue({ code: 'custom', path: ['imageUrl'], message: 'An external image needs its url' });
    }
  });

export type EventWriteBody = z.infer<typeof eventWriteSchema>;

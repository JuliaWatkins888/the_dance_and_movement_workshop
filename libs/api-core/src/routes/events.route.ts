import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, ConflictError, createSuccessResponse, NotFoundError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import { createEvent, deleteEvent, getEventById, getEventBySlug, getTimeSettings, listEvents, updateEvent } from '@inithium/db';
import type { CreateEventInput } from '@inithium/db';
import { eventWriteSchema } from '../schemas/events.schema';
import type { EventWriteBody } from '../schemas/events.schema';
import { buildPublicEventDetail, buildPublicEventList } from '../services/event-catalog.service';
import { releaseReplacedCloudAsset, resolveCloudAssetUrl } from '../services/cloud-image.service';
import { zonedWallTimeToUtc } from './time/timeZoneMath';

const router: RouterType = Router();

const MANAGE = requirePermission('events:manage');

const DAY_MS = 86_400_000;

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

const parseBody = (body: unknown): EventWriteBody => {
  const parsed = eventWriteSchema.safeParse(body);
  if (!parsed.success) throw ValidationError('Invalid request body', parsed.error.flatten());
  return parsed.data;
};

const assertSlugAvailable = async (slug: string, eventId?: string): Promise<void> => {
  const existing = await getEventBySlug(slug);
  if (existing && existing.id !== eventId) throw ConflictError('Another event already uses this URL slug');
};

const toUtcDate = (calendarDate: string): Date => new Date(`${calendarDate}T00:00:00.000Z`);

// The admin enters studio wall-clock times; the matching instants (what sales closing and "past"
// are measured against) are derived here from the studio's configured timezone. With no end time
// the event is treated as running to the end of its day.
const toSchedule = async (body: EventWriteBody) => {
  const { timezone } = await getTimeSettings();
  const nextDay = new Date(toUtcDate(body.date).getTime() + DAY_MS).toISOString().slice(0, 10);
  return {
    date: toUtcDate(body.date),
    startTime: body.startTime,
    startsAt: zonedWallTimeToUtc(`${body.date}T${body.startTime}`, timezone),
    endsAt: body.endTime ? zonedWallTimeToUtc(`${body.date}T${body.endTime}`, timezone) : zonedWallTimeToUtc(`${nextDay}T00:00`, timezone),
    salesClose:
      body.salesCloseDate && body.salesCloseTime
        ? {
            salesCloseDate: toUtcDate(body.salesCloseDate),
            salesCloseTime: body.salesCloseTime,
            salesClosesAt: zonedWallTimeToUtc(`${body.salesCloseDate}T${body.salesCloseTime}`, timezone),
          }
        : undefined,
  };
};

const resolveImage = async (body: EventWriteBody) => {
  if (body.imageSourceType === 'cloud' && body.imageAssetId) {
    return { imageSourceType: 'cloud' as const, imageAssetId: body.imageAssetId, imageUrl: await resolveCloudAssetUrl(body.imageAssetId) };
  }
  if (body.imageSourceType === 'external' && body.imageUrl) return { imageSourceType: 'external' as const, imageUrl: body.imageUrl };
  return {};
};

// Everything but the image and schedule, which are resolved separately.
const toEventFields = (body: EventWriteBody) => ({
  title: body.title,
  slug: body.slug,
  isAtStudio: body.isAtStudio,
  ticketTypes: body.ticketTypes,
});

// ---- Public ----------------------------------------------------------------------------------

router.get(
  '/api/events',
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await buildPublicEventList(new Date())));
  }),
);

// ---- Admin reads -----------------------------------------------------------------------------

// Drafts included, soonest first.
router.get(
  '/api/events/admin/all',
  requireAuth,
  MANAGE,
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await listEvents()));
  }),
);

// Registered after the /admin routes so "admin" is never read as a slug.
router.get(
  '/api/events/:slug',
  asyncHandler(async (req: Request, res: Response) => {
    const event = await buildPublicEventDetail(normalizeParam(req.params['slug']), new Date());
    if (!event) throw NotFoundError('Event not found');
    res.status(200).json(createSuccessResponse(event));
  }),
);

// ---- Writes ----------------------------------------------------------------------------------

router.post(
  '/api/events',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(req.body);
    await assertSlugAvailable(body.slug);
    const { salesClose, ...schedule } = await toSchedule(body);
    const input: CreateEventInput = {
      ...toEventFields(body),
      ...schedule,
      ...(salesClose ?? {}),
      ...(body.description ? { description: body.description } : {}),
      ...(body.attendeeNotes ? { attendeeNotes: body.attendeeNotes } : {}),
      ...(body.endTime ? { endTime: body.endTime } : {}),
      ...(body.doorsOpenTime ? { doorsOpenTime: body.doorsOpenTime } : {}),
      ...(!body.isAtStudio && body.venueName ? { venueName: body.venueName } : {}),
      ...(!body.isAtStudio && body.venueAddress ? { venueAddress: body.venueAddress } : {}),
      ...(body.bulkDiscount ? { bulkDiscount: body.bulkDiscount } : {}),
      ...(await resolveImage(body)),
      ...(body.banner ? { banner: body.banner } : {}),
      isPublished: body.isPublished ?? true,
    };
    res.status(201).json(createSuccessResponse(await createEvent(input)));
  }),
);

// Replaces the whole event - an optional field left out of the body is cleared.
router.put(
  '/api/events/:id',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params['id']);
    const existing = await getEventById(id);
    if (!existing) throw NotFoundError('Event not found');
    const body = parseBody(req.body);
    await assertSlugAvailable(body.slug, id);
    const knownTicketTypeIds = new Set(existing.ticketTypes.map((ticketType) => ticketType.id));
    if (body.ticketTypes.some((ticketType) => ticketType.id && !knownTicketTypeIds.has(ticketType.id))) {
      throw ValidationError('A ticket type being edited no longer exists - reload and try again');
    }

    const { salesClose, ...schedule } = await toSchedule(body);
    const image = await resolveImage(body);
    const event = await updateEvent(id, {
      ...toEventFields(body),
      ...schedule,
      salesCloseDate: salesClose?.salesCloseDate ?? null,
      salesCloseTime: salesClose?.salesCloseTime ?? null,
      salesClosesAt: salesClose?.salesClosesAt ?? null,
      description: body.description ?? null,
      attendeeNotes: body.attendeeNotes ?? null,
      endTime: body.endTime ?? null,
      doorsOpenTime: body.doorsOpenTime ?? null,
      venueName: !body.isAtStudio ? (body.venueName ?? null) : null,
      venueAddress: !body.isAtStudio ? (body.venueAddress ?? null) : null,
      bulkDiscount: body.bulkDiscount ?? null,
      imageUrl: image.imageUrl ?? null,
      imageSourceType: image.imageSourceType ?? null,
      imageAssetId: 'imageAssetId' in image ? image.imageAssetId : null,
      ...(body.banner ? { banner: body.banner } : {}),
      isPublished: body.isPublished ?? existing.isPublished,
    });
    if (!event) throw NotFoundError('Event not found');
    await releaseReplacedCloudAsset(existing.imageAssetId, event.imageAssetId);
    res.status(200).json(createSuccessResponse(event));
  }),
);

// Tickets already sold live on as order snapshots, so deleting an event never changes an order.
router.delete(
  '/api/events/:id',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params['id']);
    const event = await getEventById(id);
    if (!event) throw NotFoundError('Event not found');
    await deleteEvent(id);
    // Logged rather than thrown - the event itself is already gone.
    await releaseReplacedCloudAsset(event.imageAssetId, null);
    res.status(204).send();
  }),
);

export default router;

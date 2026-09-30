import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, ConflictError, createSuccessResponse, NotFoundError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import {
  createWorkshop,
  deleteWorkshop,
  getTimeSettings,
  getUserRepository,
  getWorkshopById,
  getWorkshopBySlug,
  getWorkshopRegistrationRepository,
  listWorkshops,
  updateWorkshop,
} from '@inithium/db';
import type { WorkshopDayInput, WorkshopEntity, WorkshopInstructor } from '@inithium/db';
import { workshopWriteSchema } from '../schemas/workshops.schema';
import type { WorkshopWriteBody } from '../schemas/workshops.schema';
import { buildPublicWorkshopDetail, buildPublicWorkshopList, loadStaffProfiles } from '../services/workshop-catalog.service';
import { releaseReplacedCloudAsset, resolveCloudAssetUrl } from '../services/cloud-image.service';
import { zonedWallTimeToUtc } from './time/timeZoneMath';

const router: RouterType = Router();

const MANAGE = requirePermission('workshops:manage');

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

const parseBody = (body: unknown): WorkshopWriteBody => {
  const parsed = workshopWriteSchema.safeParse(body);
  if (!parsed.success) throw ValidationError('Invalid request body', parsed.error.flatten());
  return parsed.data;
};

const assertSlugAvailable = async (slug: string, workshopId?: string): Promise<void> => {
  const existing = await getWorkshopBySlug(slug);
  if (existing && existing.id !== workshopId) throw ConflictError('Another workshop already uses this URL slug');
};

const assertStaffExist = async (instructors: WorkshopWriteBody['instructors']): Promise<void> => {
  const staffIds = instructors.flatMap((instructor) => (instructor.type === 'staff' ? [instructor.staffId] : []));
  if (staffIds.length === 0) return;
  const profiles = await loadStaffProfiles();
  if (staffIds.some((id) => !profiles.has(id))) throw ValidationError('Instructor not found');
};

// Every R2 object a workshop holds - its image and any guest instructor photos.
const cloudAssetIdsOf = (workshop: Pick<WorkshopEntity, 'imageAssetId' | 'instructors'>): string[] => [
  ...(workshop.imageAssetId ? [workshop.imageAssetId] : []),
  ...workshop.instructors.flatMap((instructor) =>
    instructor.type === 'guest' && instructor.photoSourceType === 'cloud' && instructor.photoAssetId ? [instructor.photoAssetId] : [],
  ),
];

const toInstructors = async (instructors: WorkshopWriteBody['instructors']): Promise<WorkshopInstructor[]> =>
  Promise.all(
    instructors.map(async (instructor): Promise<WorkshopInstructor> => {
      if (instructor.type === 'staff') return instructor;
      const { photoSourceType, photoAssetId, photoUrl, ...guest } = instructor;
      if (photoSourceType === 'cloud' && photoAssetId) {
        return {
          ...guest,
          photoSourceType,
          photoAssetId,
          photoUrl: await resolveCloudAssetUrl(photoAssetId),
        };
      }
      return photoSourceType === 'external' && photoUrl ? { ...guest, photoSourceType, photoUrl } : guest;
    }),
  );

// Days are entered as studio wall-clock times; the matching instants (what registration closing
// is measured against) are derived here from the studio's configured timezone. An existing day
// keeps its seat count; a new one starts empty.
const toDayInputs = async (days: WorkshopWriteBody['days'], existing: WorkshopEntity | null): Promise<WorkshopDayInput[]> => {
  const { timezone } = await getTimeSettings();
  return days.map((day) => {
    const current = day.id ? existing?.days.find((candidate) => candidate.id === day.id) : undefined;
    if (day.id && !current) throw ValidationError('A day being edited no longer exists - reload and try again');
    return {
      ...(current ? { id: current.id } : {}),
      date: new Date(`${day.date}T00:00:00.000Z`),
      startTime: day.startTime,
      endTime: day.endTime,
      startsAt: zonedWallTimeToUtc(`${day.date}T${day.startTime}`, timezone),
      endsAt: zonedWallTimeToUtc(`${day.date}T${day.endTime}`, timezone),
      ...(day.agenda ? { agenda: day.agenda } : {}),
      capacity: day.capacity,
      enrolled: current?.enrolled ?? 0,
    };
  });
};

// A day someone holds a seat on (paid, or reserved by a checkout in progress) can't be removed.
const assertRemovedDaysAreEmpty = async (existing: WorkshopEntity, keptDayIds: Set<string>): Promise<void> => {
  const removed = existing.days.filter((day) => !keptDayIds.has(day.id));
  if (removed.length === 0) return;
  const registrations = await getWorkshopRegistrationRepository().findByWorkshop(existing.id);
  const registeredDayIds = new Set(registrations.flatMap((registration) => registration.dayIds));
  if (removed.some((day) => day.enrolled > 0 || registeredDayIds.has(day.id))) {
    throw ConflictError('A removed day already has dancers registered - keep it, or reschedule it instead');
  }
};

const resolveImage = async (body: WorkshopWriteBody) => {
  if (body.imageSourceType === 'cloud' && body.imageAssetId) {
    return {
      imageSourceType: 'cloud' as const,
      imageAssetId: body.imageAssetId,
      imageUrl: await resolveCloudAssetUrl(body.imageAssetId),
    };
  }
  if (body.imageSourceType === 'external' && body.imageUrl) return { imageSourceType: 'external' as const, imageUrl: body.imageUrl };
  return {};
};

const withRegistrationCount = async (workshop: WorkshopEntity) => ({
  ...workshop,
  registrationCount: (await getWorkshopRegistrationRepository().findByWorkshop(workshop.id)).length,
});

// ---- Public ----------------------------------------------------------------------------------

router.get(
  '/api/workshops',
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await buildPublicWorkshopList(new Date())));
  }),
);

// ---- Admin reads -----------------------------------------------------------------------------

// Drafts included, newest first.
router.get(
  '/api/workshops/admin/all',
  requireAuth,
  MANAGE,
  asyncHandler(async (_req: Request, res: Response) => {
    const workshops = (await listWorkshops()).sort(
      (a, b) => (b.days[0]?.startsAt.getTime() ?? b.createdAt.getTime()) - (a.days[0]?.startsAt.getTime() ?? a.createdAt.getTime()),
    );
    res.status(200).json(createSuccessResponse(await Promise.all(workshops.map(withRegistrationCount))));
  }),
);

router.get(
  '/api/workshops/admin/staff',
  requireAuth,
  MANAGE,
  asyncHandler(async (_req: Request, res: Response) => {
    const profiles = [...(await loadStaffProfiles()).values()].sort((a, b) => a.name.localeCompare(b.name));
    res.status(200).json(
      createSuccessResponse(
        profiles.map(({ id, name, title, photoUrl }) => ({
          id,
          name,
          title,
          photoUrl,
        })),
      ),
    );
  }),
);

// Who's coming, for the studio's roster.
router.get(
  '/api/workshops/admin/:id/registrations',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const workshop = await getWorkshopById(normalizeParam(req.params['id']));
    if (!workshop) throw NotFoundError('Workshop not found');
    const registrations = await getWorkshopRegistrationRepository().findByWorkshop(workshop.id);
    const users = getUserRepository();
    const rows = await Promise.all(
      registrations.map(async (registration) => {
        const user = await users.findById(registration.userId);
        return {
          id: registration.id,
          attendee: registration.attendee,
          account: user
            ? {
                id: user.id,
                name: [user.firstName, user.lastName].filter(Boolean).join(' '),
                email: user.email,
              }
            : undefined,
          dayIds: registration.dayIds,
          isFullWorkshop: registration.isFullWorkshop,
          orderId: registration.orderId,
          createdAt: registration.createdAt,
        };
      }),
    );
    res.status(200).json(createSuccessResponse(rows));
  }),
);

// Registered after the /admin routes so "admin" is never read as a slug.
router.get(
  '/api/workshops/:slug',
  asyncHandler(async (req: Request, res: Response) => {
    const workshop = await buildPublicWorkshopDetail(normalizeParam(req.params['slug']), new Date());
    if (!workshop) throw NotFoundError('Workshop not found');
    res.status(200).json(createSuccessResponse(workshop));
  }),
);

// ---- Writes ----------------------------------------------------------------------------------

router.post(
  '/api/workshops',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(req.body);
    await assertSlugAvailable(body.slug);
    await assertStaffExist(body.instructors);
    const { imageUrl: _imageUrl, imageSourceType: _imageSourceType, imageAssetId: _imageAssetId, instructors, days, ...rest } = body;
    const workshop = await createWorkshop({
      ...rest,
      ...(await resolveImage(body)),
      instructors: await toInstructors(instructors),
      days: await toDayInputs(days, null),
      isPublished: body.isPublished ?? true,
    });
    res.status(201).json(createSuccessResponse(await withRegistrationCount(workshop)));
  }),
);

// Replaces the whole workshop - an optional field left out of the body is cleared.
router.put(
  '/api/workshops/:id',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params['id']);
    const existing = await getWorkshopById(id);
    if (!existing) throw NotFoundError('Workshop not found');
    const body = parseBody(req.body);
    await assertSlugAvailable(body.slug, id);
    await assertStaffExist(body.instructors);
    const days = await toDayInputs(body.days, existing);
    await assertRemovedDaysAreEmpty(existing, new Set(days.flatMap((day) => (day.id ? [day.id] : []))));

    const image = await resolveImage(body);
    const instructors = await toInstructors(body.instructors);
    const workshop = await updateWorkshop(id, {
      title: body.title,
      slug: body.slug,
      description: body.description ?? null,
      dressCode: body.dressCode ?? null,
      styles: body.styles,
      level: body.level ?? null,
      minAgeYears: body.minAgeYears ?? null,
      maxAgeYears: body.maxAgeYears ?? null,
      instructors,
      days,
      pricePerDayCents: body.pricePerDayCents,
      fullWorkshopDiscountPercent: body.fullWorkshopDiscountPercent,
      imageUrl: image.imageUrl ?? null,
      imageSourceType: image.imageSourceType ?? null,
      imageAssetId: 'imageAssetId' in image ? image.imageAssetId : null,
      ...(body.banner ? { banner: body.banner } : {}),
      isPublished: body.isPublished ?? existing.isPublished,
    });
    if (!workshop) throw NotFoundError('Workshop not found');

    const kept = new Set(cloudAssetIdsOf(workshop));
    await Promise.all(
      cloudAssetIdsOf(existing)
        .filter((assetId) => !kept.has(assetId))
        .map((assetId) => releaseReplacedCloudAsset(assetId, null)),
    );
    res.status(200).json(createSuccessResponse(await withRegistrationCount(workshop)));
  }),
);

// Paid registrations are the studio's record of who's attending - a workshop that has any is
// unpublished rather than deleted.
router.delete(
  '/api/workshops/:id',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params['id']);
    const workshop = await getWorkshopById(id);
    if (!workshop) throw NotFoundError('Workshop not found');
    const registrations = await getWorkshopRegistrationRepository().findByWorkshop(id);
    if (registrations.length > 0 || workshop.days.some((day) => day.enrolled > 0)) {
      throw ConflictError('This workshop has registrations - unpublish it instead of deleting it');
    }
    await deleteWorkshop(id);
    // Logged rather than thrown - the workshop itself is already gone.
    await Promise.all(cloudAssetIdsOf(workshop).map((assetId) => releaseReplacedCloudAsset(assetId, null)));
    res.status(204).send();
  }),
);

export default router;

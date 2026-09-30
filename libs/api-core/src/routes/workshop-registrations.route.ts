import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse, NotFoundError, UnauthorizedError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import {
  getUserRepository,
  getWorkshopById,
  getWorkshopRegistrationRepository,
  listEligibleAttendees,
  workshopEndsAt,
  workshopRegistrationClosesAt,
} from '@inithium/db';
import type { WorkshopRegistrationEntity } from '@inithium/db';

const router: RouterType = Router();

const currentUserId = (req: Request): string => {
  if (!req.user) throw UnauthorizedError();
  return req.user.sub;
};

const loadUserName = async (userId: string): Promise<string> => {
  const user = await getUserRepository().findById(userId);
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ');
};

// upcoming - the first registered day hasn't started; in_progress - underway; ended - all done.
const toRegistrationDto = async (registration: WorkshopRegistrationEntity, now: Date) => {
  const workshop = await getWorkshopById(registration.workshopId);
  // A day the admin later removed simply drops out.
  const days = workshop?.days.filter((day) => registration.dayIds.includes(day.id)) ?? [];
  const startsAt = workshopRegistrationClosesAt(days);
  const endsAt = workshopEndsAt(days);
  const status = startsAt && now < startsAt ? 'upcoming' : endsAt && now < endsAt ? 'in_progress' : 'ended';

  return {
    id: registration.id,
    attendee: registration.attendee,
    workshop: workshop ? { id: workshop.id, title: workshop.title, slug: workshop.slug } : undefined,
    days: days.map((day) => ({
      id: day.id,
      date: day.date,
      startTime: day.startTime,
      endTime: day.endTime,
    })),
    isFullWorkshop: registration.isFullWorkshop,
    status,
    orderId: registration.orderId,
    createdAt: registration.createdAt,
  };
};

// The account's attendees who may take this workshop today - only these are offered on the
// workshop page's dancer picker.
router.get(
  '/api/workshop-registrations/attendees',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const workshopId = typeof req.query['workshopId'] === 'string' ? req.query['workshopId'] : '';
    if (!workshopId) throw ValidationError('workshopId is required');
    const workshop = await getWorkshopById(workshopId);
    if (!workshop?.isPublished) throw NotFoundError('Workshop not found');

    const userId = currentUserId(req);
    res.status(200).json(createSuccessResponse(await listEligibleAttendees(userId, await loadUserName(userId), workshop, new Date())));
  }),
);

router.get(
  '/api/workshop-registrations/mine',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const now = new Date();
    const registrations = await getWorkshopRegistrationRepository().findByUserId(currentUserId(req));
    res
      .status(200)
      .json(createSuccessResponse(await Promise.all(registrations.map((registration) => toRegistrationDto(registration, now)))));
  }),
);

export default router;

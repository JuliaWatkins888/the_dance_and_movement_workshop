import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { countDaysBetweenKeys } from '@inithium/db';
import { requirePermission } from '@inithium/permissions';
import {
  MAX_PRIVATE_LESSON_SCHEDULE_DAYS,
  createPrivateLessonSchema,
  endPrivateLessonSchema,
  privateLessonExceptionSchema,
  privateLessonScheduleQuerySchema,
  updatePrivateLessonSchema,
} from '../schemas/private-lessons.schema';
import {
  buildPrivateLessonSchedule,
  clearPrivateLessonException,
  createPrivateLesson,
  deletePrivateLesson,
  endPrivateLesson,
  getPrivateLessonAdmin,
  listAccountPrivateLessons,
  listMyPrivateLessons,
  listPrivateLessonInstructors,
  listPrivateLessonsAdmin,
  setPrivateLessonException,
  updatePrivateLesson,
} from '../services/private-lesson.service';
import { currentUserId, normalizeParam, parseBody } from './ecommerce/ecommerceHttp';

const router: RouterType = Router();

export const PRIVATES_CAPABILITY = 'privates:manage';
const MANAGE = requirePermission(PRIVATES_CAPABILITY);
// A family's lessons also show wherever desk staff look at the account.
const VIEW_ACCOUNT_LESSONS = requirePermission([PRIVATES_CAPABILITY, 'registrations:desk']);

// ---- Family --------------------------------------------------------------------------------------

router.get(
  '/api/private-lessons/mine',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await listMyPrivateLessons(currentUserId(req))));
  }),
);

// ---- Staff ---------------------------------------------------------------------------------------

router.get(
  '/api/private-lessons/admin',
  requireAuth,
  MANAGE,
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await listPrivateLessonsAdmin()));
  }),
);

router.get(
  '/api/private-lessons/instructors',
  requireAuth,
  MANAGE,
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await listPrivateLessonInstructors()));
  }),
);

// Every lesson occurrence in [from, to), cancelled ones included. Never public: it names students.
router.get(
  '/api/private-lessons/schedule',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = privateLessonScheduleQuerySchema.safeParse(req.query);
    if (!parsed.success) throw ValidationError('Invalid schedule range', parsed.error.flatten());
    if (countDaysBetweenKeys(parsed.data.from, parsed.data.to) > MAX_PRIVATE_LESSON_SCHEDULE_DAYS) {
      throw ValidationError(`A schedule range can span at most ${MAX_PRIVATE_LESSON_SCHEDULE_DAYS} days`);
    }
    res.status(200).json(createSuccessResponse(await buildPrivateLessonSchedule(parsed.data)));
  }),
);

router.get(
  '/api/users/:id/private-lessons',
  requireAuth,
  VIEW_ACCOUNT_LESSONS,
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await listAccountPrivateLessons(normalizeParam(req.params['id']))));
  }),
);

router.get(
  '/api/private-lessons/:id',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await getPrivateLessonAdmin(normalizeParam(req.params['id']))));
  }),
);

router.post(
  '/api/private-lessons',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(createPrivateLessonSchema, req.body);
    res.status(201).json(createSuccessResponse(await createPrivateLesson(body, currentUserId(req))));
  }),
);

router.put(
  '/api/private-lessons/:id',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(updatePrivateLessonSchema, req.body);
    res.status(200).json(createSuccessResponse(await updatePrivateLesson(normalizeParam(req.params['id']), body)));
  }),
);

router.post(
  '/api/private-lessons/:id/end',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const { lastDate } = parseBody(endPrivateLessonSchema, req.body ?? {});
    res.status(200).json(createSuccessResponse(await endPrivateLesson(normalizeParam(req.params['id']), lastDate)));
  }),
);

router.delete(
  '/api/private-lessons/:id',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    await deletePrivateLesson(normalizeParam(req.params['id']));
    res.status(204).send();
  }),
);

// Cancel or move one occurrence. Sending a new change for the same date replaces the old one.
router.post(
  '/api/private-lessons/:id/exceptions',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(privateLessonExceptionSchema, req.body);
    res.status(200).json(createSuccessResponse(await setPrivateLessonException(normalizeParam(req.params['id']), body, currentUserId(req))));
  }),
);

router.delete(
  '/api/private-lessons/:id/exceptions/:date',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    res
      .status(200)
      .json(createSuccessResponse(await clearPrivateLessonException(normalizeParam(req.params['id']), normalizeParam(req.params['date']))));
  }),
);

export default router;

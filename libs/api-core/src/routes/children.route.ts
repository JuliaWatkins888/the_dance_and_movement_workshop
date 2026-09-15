import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission, hasCapability } from '@inithium/permissions';
import {
  createChild,
  deleteChild,
  getChildById,
  getChildrenCreatedByDay,
  getUserRepository,
  listChildren,
  listChildrenByParentUserId,
  listUsers,
  updateChild,
} from '@inithium/db';
import type { ChildEntity, ChildSearchField, UserEntity } from '@inithium/db';
import { createChildSchema, updateChildSchema } from '../schemas/children.schema';

const router: RouterType = Router();

const CHILDREN_MANAGE_CAPABILITY = 'children:manage';

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

const SEARCH_FIELDS = ['firstName', 'lastName'] as const;
const isSearchField = (value: unknown): value is ChildSearchField =>
  typeof value === 'string' && (SEARCH_FIELDS as readonly string[]).includes(value);

// A child never stores its own copy of the parent's name/email - resolves the linked UserEntity
// at response time, the same toStaffDto pattern staff.route.ts uses for its own userId FK.
// Falls back to empty strings if the linked parent has since been deleted rather than throwing
// and breaking the whole list over one orphaned record.
const toChildDto = async (child: ChildEntity) => {
  const parent = await getUserRepository().findById(child.parentUserId);
  return {
    id: child.id,
    parentUserId: child.parentUserId,
    firstName: child.firstName,
    lastName: child.lastName,
    age: child.age,
    gender: child.gender,
    activeRegistrations: child.activeRegistrations,
    createdAt: child.createdAt,
    updatedAt: child.updatedAt,
    parentFirstName: parent?.firstName ?? '',
    parentLastName: parent?.lastName,
    parentEmail: parent?.email ?? '',
  };
};

const toParentCandidateDto = (user: UserEntity) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
});

// Loads the full record for the authenticated caller - requireAuth only guarantees a valid JWT,
// not that the account it names still exists, matching requirePermission's own re-fetch instead
// of trusting req.user's JWT claims for anything but the id.
const loadRequester = async (req: Request): Promise<UserEntity> => {
  const user = await getUserRepository().findById(req.user!.sub);
  if (!user) {
    throw UnauthorizedError('User not found');
  }
  return user;
};

const isManager = (user: UserEntity): boolean => hasCapability(user, CHILDREN_MANAGE_CAPABILITY);

router.get(
  '/api/children/mine',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const children = await listChildrenByParentUserId(req.user!.sub);
    res.status(200).json(createSuccessResponse(await Promise.all(children.map(toChildDto))));
  }),
);

// Registered before "/api/children/:id" - literal segments ahead of a param route, matching
// staff.route.ts's own ordering (Express matches in registration order).
router.get(
  '/api/children/admin',
  requireAuth,
  requirePermission(CHILDREN_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query['page']) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query['pageSize']) || 20));
    const rawSearch = typeof req.query['search'] === 'string' ? req.query['search'].trim() : undefined;
    const rawSearchField = req.query['searchField'];
    const searchField = isSearchField(rawSearchField) ? rawSearchField : 'firstName';

    const result = await listChildren({
      page,
      pageSize,
      search: rawSearch || undefined,
      searchField: rawSearch ? searchField : undefined,
    });
    const items = await Promise.all(result.items.map(toChildDto));

    res.status(200).json(
      createSuccessResponse(items, {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
      }),
    );
  }),
);

// Mirrors /api/staff/user-candidates, but parents ARE ordinary 'user'-role accounts (unlike
// staff, which excludes them) and are never excluded for already having children (unlike staff's
// one-record-per-user constraint, a parent can have unlimited child accounts).
router.get(
  '/api/children/parent-candidates',
  requireAuth,
  requirePermission(CHILDREN_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const rawSearch = typeof req.query['search'] === 'string' ? req.query['search'].trim().toLowerCase() : '';
    const CANDIDATE_FETCH_LIMIT = 200;

    const result = await listUsers({ page: 1, pageSize: CANDIDATE_FETCH_LIMIT });

    const matchesSearch = (user: UserEntity): boolean => {
      if (!rawSearch) return true;
      const haystack = `${user.firstName} ${user.lastName ?? ''} ${user.email}`.toLowerCase();
      return haystack.includes(rawSearch);
    };

    const candidates = result.items.filter(matchesSearch);

    res.status(200).json(createSuccessResponse(candidates.map(toParentCandidateDto)));
  }),
);

router.get(
  '/api/children/stats/created',
  requireAuth,
  requirePermission(CHILDREN_MANAGE_CAPABILITY),
  asyncHandler(async (_req: Request, res: Response) => {
    const counts = await getChildrenCreatedByDay();
    res.status(200).json(createSuccessResponse(counts));
  }),
);

router.get(
  '/api/children/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const child = await getChildById(id);
    if (!child) {
      throw NotFoundError('Child not found');
    }

    const requester = await loadRequester(req);
    if (child.parentUserId !== requester.id && !isManager(requester)) {
      throw ForbiddenError('You do not have access to this child account');
    }

    res.status(200).json(createSuccessResponse(await toChildDto(child)));
  }),
);

router.post(
  '/api/children',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createChildSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const requester = await loadRequester(req);
    const requesterIsManager = isManager(requester);

    // A manager may create a child under any parent (the CMS's parent-picker flow); everyone
    // else can only ever create a child under their own account, regardless of what a
    // parentUserId in the body says - this is the actual security boundary of the whole route.
    let parentUserId = requester.id;
    if (requesterIsManager && parsed.data.parentUserId) {
      const parent = await getUserRepository().findById(parsed.data.parentUserId);
      if (!parent) {
        throw NotFoundError('Linked parent user not found');
      }
      parentUserId = parent.id;
    }

    const child = await createChild({
      parentUserId,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      age: parsed.data.age,
      gender: parsed.data.gender,
      activeRegistrations: [],
    });
    res.status(201).json(createSuccessResponse(await toChildDto(child)));
  }),
);

router.put(
  '/api/children/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const parsed = updateChildSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const existing = await getChildById(id);
    if (!existing) {
      throw NotFoundError('Child not found');
    }

    const requester = await loadRequester(req);
    const requesterIsManager = isManager(requester);
    if (existing.parentUserId !== requester.id && !requesterIsManager) {
      throw ForbiddenError('You do not have access to this child account');
    }

    let parentUserId: string | undefined;
    if (requesterIsManager && parsed.data.parentUserId) {
      const parent = await getUserRepository().findById(parsed.data.parentUserId);
      if (!parent) {
        throw NotFoundError('Linked parent user not found');
      }
      parentUserId = parent.id;
    }

    const child = await updateChild(id, {
      ...(parentUserId ? { parentUserId } : {}),
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      age: parsed.data.age,
      gender: parsed.data.gender,
    });
    if (!child) {
      throw NotFoundError('Child not found');
    }
    res.status(200).json(createSuccessResponse(await toChildDto(child)));
  }),
);

router.delete(
  '/api/children/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const child = await getChildById(id);
    if (!child) {
      throw NotFoundError('Child not found');
    }

    const requester = await loadRequester(req);
    if (child.parentUserId !== requester.id && !isManager(requester)) {
      throw ForbiddenError('You do not have access to this child account');
    }

    await deleteChild(id);
    res.status(204).send();
  }),
);

export default router;

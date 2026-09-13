import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import {
  asyncHandler,
  createSuccessResponse,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@inithium/api-utils';
import { requireAuth, hashPassword } from '@inithium/auth';
import { requirePermission, requireOwner } from '@inithium/permissions';
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  getUserRepository,
  getUserRegistrationsByDay,
  transferOwnership,
} from '@inithium/db';
import type { UserEntity, UserSearchField } from '@inithium/db';
import { createUserSchema, updateUserSchema, updateUserPermissionsSchema } from '../schemas/users.schema';

const router: RouterType = Router();

const SEARCH_FIELDS = ['firstName', 'lastName', 'email'] as const;
const isSearchField = (value: unknown): value is UserSearchField =>
  typeof value === 'string' && (SEARCH_FIELDS as readonly string[]).includes(value);

const normalizeId = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

// Every response strips passwordHash, matching auth.route.ts's existing convention of never
// returning the hash on any user-facing endpoint. capabilityOverrides is the raw per-user
// override map (not resolved against role defaults) - the Permissions module's edit dialog needs
// the raw map to show which keys are explicit overrides vs. role-default, the same distinction
// auth.route.ts's toAuthUser resolves away for "what can the signed-in viewer do".
const toPublicUser = (user: UserEntity) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  isOwner: user.isOwner,
  capabilityOverrides: user.capabilityOverrides,
  avatar: user.avatar,
  darkMode: user.darkMode,
  createdAt: user.createdAt,
});

router.get(
  '/api/users',
  requireAuth,
  requirePermission('users:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query['page']) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query['pageSize']) || 20));
    const rawSearch = typeof req.query['search'] === 'string' ? req.query['search'] : undefined;
    const search = rawSearch ? rawSearch.trim() : undefined;
    const rawSearchField = req.query['searchField'];
    const searchField = isSearchField(rawSearchField) ? rawSearchField : 'email';

    const result = await listUsers({
      page,
      pageSize,
      search: search || undefined,
      searchField: search ? searchField : undefined,
    });

    res.status(200).json(
      createSuccessResponse(result.items.map(toPublicUser), {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
      }),
    );
  }),
);

router.get(
  '/api/users/stats/registrations',
  requireAuth,
  requirePermission('users:manage'),
  asyncHandler(async (_req: Request, res: Response) => {
    const counts = await getUserRegistrationsByDay();
    res.status(200).json(createSuccessResponse(counts));
  }),
);

router.post(
  '/api/users',
  requireAuth,
  requirePermission('users:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const existing = await getUserRepository().findByEmail(parsed.data.email);
    if (existing) {
      throw ConflictError('A user with this email already exists');
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await createUser({
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      passwordHash,
      role: parsed.data.role,
    });

    res.status(201).json(createSuccessResponse(toPublicUser(user)));
  }),
);

router.patch(
  '/api/users/:id',
  requireAuth,
  requirePermission('users:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const id = normalizeId(req.params.id);

    // Generalizes the old "can't demote yourself out of admin" guard to a total rule now that
    // role is a 4-way template rather than an admin/non-admin binary - there's no longer a
    // single "safe" role to still allow changing yourself into.
    if (req.user?.sub === id && parsed.data.role !== undefined) {
      throw ValidationError('You cannot change your own role');
    }

    if (parsed.data.role !== undefined) {
      const target = await getUserRepository().findById(id);
      if (target?.isOwner) {
        throw ValidationError("You cannot change the owner's role");
      }
    }

    if (parsed.data.email) {
      const existing = await getUserRepository().findByEmail(parsed.data.email);
      if (existing && existing.id !== id) {
        throw ConflictError('A user with this email already exists');
      }
    }

    const passwordHash = parsed.data.password ? await hashPassword(parsed.data.password) : undefined;
    const user = await updateUser(id, {
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      role: parsed.data.role,
      ...(passwordHash ? { passwordHash } : {}),
    });

    if (!user) {
      throw NotFoundError('User not found');
    }

    res.status(200).json(createSuccessResponse(toPublicUser(user)));
  }),
);

// Separate from the general PATCH above so it can be gated behind its own
// users:managePermissions capability rather than the coarser users:manage one - editing other
// people's grants is a different trust tier than ordinary user-record CRUD (see
// role-capability-defaults.ts's comment on why this capability is never role-bundled).
router.patch(
  '/api/users/:id/permissions',
  requireAuth,
  requirePermission('users:managePermissions'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = updateUserPermissionsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const id = normalizeId(req.params.id);

    // The owner already bypasses every capability check unconditionally, so there's nothing
    // meaningful to self-edit here - blocking it closes a self-escalation loophole for a
    // users:managePermissions delegate who isn't the owner.
    if (req.user?.sub === id) {
      throw ValidationError('You cannot edit your own permission overrides');
    }

    const user = await updateUser(id, { capabilityOverrides: parsed.data.capabilityOverrides });
    if (!user) {
      throw NotFoundError('User not found');
    }

    res.status(200).json(createSuccessResponse(toPublicUser(user)));
  }),
);

router.post(
  '/api/users/:id/transfer-ownership',
  requireAuth,
  requireOwner,
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeId(req.params.id);

    if (req.user?.sub === id) {
      throw ValidationError('You are already the owner');
    }

    const target = await getUserRepository().findById(id);
    if (!target) {
      throw NotFoundError('User not found');
    }
    if (target.isOwner) {
      throw ConflictError('This user is already the owner');
    }

    const newOwner = await transferOwnership(id);
    res.status(200).json(createSuccessResponse(toPublicUser(newOwner)));
  }),
);

router.delete(
  '/api/users/:id',
  requireAuth,
  requirePermission('users:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeId(req.params.id);

    // Same self-lockout concern as PATCH's role guard, applied to deletion.
    if (req.user?.sub === id) {
      throw ValidationError('You cannot delete your own account');
    }

    const target = await getUserRepository().findById(id);
    if (target?.isOwner) {
      throw ValidationError('You cannot delete the owner account');
    }

    const deleted = await deleteUser(id);
    if (!deleted) {
      throw NotFoundError('User not found');
    }

    res.status(204).send();
  }),
);

export default router;

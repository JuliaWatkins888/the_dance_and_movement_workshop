import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, ConflictError, createSuccessResponse, NotFoundError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import {
  createStaff,
  deleteStaff,
  getStaffById,
  getStaffByUserId,
  getUserRepository,
  listStaff,
  listStaffUserIds,
  listUsers,
  updateStaff,
} from '@inithium/db';
import type { StaffEntity, StaffSearchField, UserEntity } from '@inithium/db';
import { createStaffSchema, updateStaffSchema } from '../schemas/staff.schema';
import { releaseCloudAsset, releaseReplacedCloudAsset, resolveCloudAssetUrl } from '../services/cloud-image.service';

const router: RouterType = Router();

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

const SEARCH_FIELDS = ['title'] as const;
const isSearchField = (value: unknown): value is StaffSearchField =>
  typeof value === 'string' && (SEARCH_FIELDS as readonly string[]).includes(value);

// Staff never stores its own copy of a name/email - this resolves the linked UserEntity at
// response time so every list a caller sees is already display-ready. Falls back to empty
// strings if the linked user has since been deleted (there's no cascade-delete hook between the
// core users route and this plugin's own collection) rather than throwing and breaking the whole
// list over one orphaned record.
const toStaffDto = async (staff: StaffEntity) => {
  const user = await getUserRepository().findById(staff.userId);
  return {
    id: staff.id,
    userId: staff.userId,
    title: staff.title,
    bio: staff.bio,
    photoUrl: staff.photoUrl,
    photoSourceType: staff.photoSourceType,
    photoAssetId: staff.photoAssetId,
    order: staff.order,
    createdAt: staff.createdAt,
    updatedAt: staff.updatedAt,
    firstName: user?.firstName ?? '',
    lastName: user?.lastName,
    email: user?.email ?? '',
  };
};

// The unauthenticated /staff listing - drops internal ids (the linked account's userId, the
// photo's storage asset) that only the CMS needs.
const toPublicStaffDto = async (staff: StaffEntity) => {
  const { userId: _userId, photoAssetId: _photoAssetId, ...publicFields } = await toStaffDto(staff);
  return publicFields;
};

const toCandidateDto = (user: UserEntity) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
});

router.get(
  '/api/staff',
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query['page']) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query['pageSize']) || 12));

    const result = await listStaff({ page, pageSize });
    const items = await Promise.all(result.items.map(toPublicStaffDto));

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

// Registered before "/api/staff/:id" - literal segments ahead of a param route, the same
// ordering gallery.route.ts and blog.route.ts use for their own literal routes and for the same
// reason (Express matches in registration order).
router.get(
  '/api/staff/admin',
  requireAuth,
  requirePermission('staff:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query['page']) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query['pageSize']) || 20));
    const rawSearch = typeof req.query['search'] === 'string' ? req.query['search'].trim() : undefined;
    const rawSearchField = req.query['searchField'];
    const searchField = isSearchField(rawSearchField) ? rawSearchField : 'title';

    const result = await listStaff({
      page,
      pageSize,
      search: rawSearch || undefined,
      searchField: rawSearch ? searchField : undefined,
    });
    const items = await Promise.all(result.items.map(toStaffDto));

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

// Gated on staff:manage alone (not users:manage) so a staff-only admin can link a user without
// also needing the broader Users module's own permission - see users.route.ts's own /api/users,
// which this deliberately does not reuse. A bounded, unfiltered fetch rather than delegating to
// listUsers' own single-field regex search - a staff-linking picker needs to match across
// firstName/lastName/email together, which FindManyUsersOptions' one-field-at-a-time contract
// doesn't support. Staff-eligible (non-'user'-role) accounts are expected to stay a small roster,
// so filtering this batch in memory is simpler than adding multi-field search to the core
// UserRepository contract for one caller.
router.get(
  '/api/staff/user-candidates',
  requireAuth,
  requirePermission('staff:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const rawSearch = typeof req.query['search'] === 'string' ? req.query['search'].trim().toLowerCase() : '';
    const CANDIDATE_FETCH_LIMIT = 200;

    const [result, linkedUserIds] = await Promise.all([
      listUsers({ page: 1, pageSize: CANDIDATE_FETCH_LIMIT }),
      listStaffUserIds(),
    ]);

    const linked = new Set(linkedUserIds);
    const matchesSearch = (user: UserEntity): boolean => {
      if (!rawSearch) return true;
      const haystack = `${user.firstName} ${user.lastName ?? ''} ${user.email}`.toLowerCase();
      return haystack.includes(rawSearch);
    };

    const candidates = result.items.filter((user) => user.role !== 'user' && !linked.has(user.id) && matchesSearch(user));

    res.status(200).json(createSuccessResponse(candidates.map(toCandidateDto)));
  }),
);

router.post(
  '/api/staff',
  requireAuth,
  requirePermission('staff:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createStaffSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const user = await getUserRepository().findById(parsed.data.userId);
    if (!user) {
      throw NotFoundError('Linked user not found');
    }
    if (user.role === 'user') {
      throw ValidationError('Only contributor, editor, or admin accounts can be staff members');
    }

    const existing = await getStaffByUserId(parsed.data.userId);
    if (existing) {
      throw ConflictError('This user is already a staff member');
    }

    const { photoAssetId, ...rest } = parsed.data;
    const staff = await createStaff({
      ...rest,
      ...(rest.photoSourceType === 'cloud' && photoAssetId
        ? { photoAssetId, photoUrl: await resolveCloudAssetUrl(photoAssetId) }
        : {}),
      order: parsed.data.order ?? 0,
    });
    res.status(201).json(createSuccessResponse(await toStaffDto(staff)));
  }),
);

router.put(
  '/api/staff/:id',
  requireAuth,
  requirePermission('staff:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const parsed = updateStaffSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    if (parsed.data.userId) {
      const user = await getUserRepository().findById(parsed.data.userId);
      if (!user) {
        throw NotFoundError('Linked user not found');
      }
      if (user.role === 'user') {
        throw ValidationError('Only contributor, editor, or admin accounts can be staff members');
      }
      const existing = await getStaffByUserId(parsed.data.userId);
      if (existing && existing.id !== id) {
        throw ConflictError('This user is already a staff member');
      }
    }

    const previous = await getStaffById(id);
    if (!previous) {
      throw NotFoundError('Staff member not found');
    }

    // photoSourceType present (a value or null) means the photo was changed or removed; absent
    // means the photo is untouched and keeps its existing asset.
    const { photoAssetId, ...rest } = parsed.data;
    const isPhotoChange = rest.photoSourceType !== undefined;
    const nextAssetId = isPhotoChange ? (rest.photoSourceType === 'cloud' ? photoAssetId : null) : previous.photoAssetId;
    const staff = await updateStaff(id, {
      ...rest,
      ...(isPhotoChange ? { photoAssetId: nextAssetId ?? null } : {}),
      ...(isPhotoChange && nextAssetId ? { photoUrl: await resolveCloudAssetUrl(nextAssetId) } : {}),
    });
    if (!staff) {
      throw NotFoundError('Staff member not found');
    }
    await releaseReplacedCloudAsset(previous.photoAssetId, nextAssetId);
    res.status(200).json(createSuccessResponse(await toStaffDto(staff)));
  }),
);

router.delete(
  '/api/staff/:id',
  requireAuth,
  requirePermission('staff:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const staff = await getStaffById(id);
    if (!staff) {
      throw NotFoundError('Staff member not found');
    }

    await releaseCloudAsset(staff.photoAssetId);
    await deleteStaff(id);
    res.status(204).send();
  }),
);

export default router;

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';
import type { NextFunction, Request, Response, Router as RouterType } from 'express';
import multer from 'multer';
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

const router: RouterType = Router();

// Lives in the source tree, never under dist/ (webpack's own output.clean wipes dist/apps/api on
// every build) and never under apps/api/src/assets (that folder is only copied into dist at BUILD
// time, so a runtime write there is invisible until a rebuild, and still gets wiped by the next
// clean regardless). process.cwd() is the monorepo root for both `nx serve api` and a typical
// Render "Start Command" run from the repo root. This directory must be committed to git for an
// upload to survive a redeploy - the whole reason it lives here instead of in dist. Mirrors
// gallery.route.ts's own GALLERY_UPLOAD_DIR precedent exactly.
const STAFF_UPLOAD_DIR = path.resolve(process.cwd(), 'apps/api/uploads/staff');
fs.mkdirSync(STAFF_UPLOAD_DIR, { recursive: true });

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
// No image/svg+xml - an uploaded SVG can carry <script> and is a stored-XSS vector once rendered
// as/inlined via <img>. Matches gallery.route.ts's and the storage plugin's own allowlist exactly.
const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

const SEARCH_FIELDS = ['title'] as const;
const isSearchField = (value: unknown): value is StaffSearchField =>
  typeof value === 'string' && (SEARCH_FIELDS as readonly string[]).includes(value);

// Bytes land on disk directly (not memoryStorage, which is what storage.route.ts uses before
// forwarding to S3) under a random filename - the original filename is never used for anything,
// including the response, which sidesteps path-traversal from a hostile original name entirely.
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, STAFF_UPLOAD_DIR),
    filename: (_req, file, callback) => {
      const extension = EXTENSION_BY_MIME_TYPE[file.mimetype] ?? 'bin';
      callback(null, `${randomUUID()}.${extension}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    if (!(file.mimetype in EXTENSION_BY_MIME_TYPE)) {
      callback(new Error(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    callback(null, true);
  },
});

// multer's own errors (and fileFilter rejections) don't compose with the shared errorHandler on
// their own - it only special-cases `instanceof AppError` - so this adapts them into a clean
// ValidationError before calling next(), the same adapter gallery.route.ts uses for the same
// reason.
const handleUpload = (req: Request, res: Response, next: NextFunction): void => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      next(ValidationError(err.code === 'LIMIT_FILE_SIZE' ? 'File too large. Max size is 5MB.' : err.message));
      return;
    }
    if (err) {
      next(ValidationError(err instanceof Error ? err.message : 'Invalid file upload'));
      return;
    }
    next();
  });
};

// Read live rather than cached at module scope - apps/web runs on a different origin, so a
// returned upload URL must be absolute. Document API_PUBLIC_URL in the consuming workspace's own
// .env, matching gallery.route.ts's identical precedent.
const resolvePublicOrigin = (): string =>
  process.env['API_PUBLIC_URL'] || `http://localhost:${process.env['PORT'] || 3000}`;

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
    photoStorageKey: staff.photoStorageKey,
    order: staff.order,
    createdAt: staff.createdAt,
    updatedAt: staff.updatedAt,
    firstName: user?.firstName ?? '',
    lastName: user?.lastName,
    email: user?.email ?? '',
  };
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

// Gated on studio-offerings:manage, deliberately not staff:manage - whoever manages Course/Class/
// Workshop offerings shouldn't need full staff-profile-management rights just to assign an
// instructor. Unlike /api/staff/user-candidates above, there's no exclusion-set logic here - a
// staff member can be the instructor for any number of classes/workshops, unlike the one-record-
// per-user constraint that route's exclusion set enforces.
router.get(
  '/api/staff/instructor-candidates',
  requireAuth,
  requirePermission('studio-offerings:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const rawSearch = typeof req.query['search'] === 'string' ? req.query['search'].trim().toLowerCase() : '';
    const CANDIDATE_FETCH_LIMIT = 200;

    const result = await listStaff({ page: 1, pageSize: CANDIDATE_FETCH_LIMIT });
    const candidates = await Promise.all(
      result.items.map(async (staff) => {
        const user = await getUserRepository().findById(staff.userId);
        return {
          id: staff.id,
          name: `${user?.firstName ?? ''}${user?.lastName ? ` ${user.lastName}` : ''}`.trim(),
          photoUrl: staff.photoUrl,
        };
      }),
    );

    const matchesSearch = (candidate: { name: string }): boolean => !rawSearch || candidate.name.toLowerCase().includes(rawSearch);
    res.status(200).json(createSuccessResponse(candidates.filter(matchesSearch)));
  }),
);

router.post(
  '/api/staff/upload',
  requireAuth,
  requirePermission('staff:manage'),
  handleUpload,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw ValidationError('No file was uploaded');
    }
    res.status(201).json(
      createSuccessResponse({
        url: `${resolvePublicOrigin()}/api/staff/uploads/${req.file.filename}`,
        storageKey: req.file.filename,
      }),
    );
  }),
);

router.use('/api/staff/uploads', express.static(STAFF_UPLOAD_DIR));

// Public single-record read for the Staff Detail page (bio + "what they teach") - unauthenticated
// like /api/staff above, since a staff bio is public-facing content. Registered after every
// literal /api/staff/* route above (admin, user-candidates, instructor-candidates, upload,
// uploads) so none of those get shadowed by this param route.
router.get(
  '/api/staff/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const staff = await getStaffById(id);
    if (!staff) {
      throw NotFoundError('Staff member not found');
    }
    res.status(200).json(createSuccessResponse(await toStaffDto(staff)));
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

    const staff = await createStaff({ ...parsed.data, order: parsed.data.order ?? 0 });
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

    const staff = await updateStaff(id, parsed.data);
    if (!staff) {
      throw NotFoundError('Staff member not found');
    }
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

    if (staff.photoSourceType === 'local' && staff.photoStorageKey) {
      fs.rm(path.join(STAFF_UPLOAD_DIR, staff.photoStorageKey), { force: true }, () => undefined);
    }
    // 'cloud' cleanup (deleteObject + deleteAsset) is handled by the storage-aware variant of
    // this same file, applied once the storage plugin is installed - without storage installed,
    // the CMS never offers a Cloud upload tab, so a 'cloud' photo can't exist here in the first
    // place.

    await deleteStaff(id);
    res.status(204).send();
  }),
);

export default router;

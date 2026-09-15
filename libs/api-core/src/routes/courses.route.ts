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
  countClassesByCourseId,
  createCourse,
  deleteCourse,
  getCourseRepository,
  getSemesterById,
  listCourses,
  listPublishedCourses,
  updateCourse,
} from '@inithium/db';
import type { CourseEntity, CourseSearchField } from '@inithium/db';
import { createCourseSchema, updateCourseSchema } from '../schemas/courses.schema';

const router: RouterType = Router();

const STUDIO_OFFERINGS_MANAGE_CAPABILITY = 'studio-offerings:manage';

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

const SEARCH_FIELDS = ['name'] as const;
const isSearchField = (value: unknown): value is CourseSearchField =>
  typeof value === 'string' && (SEARCH_FIELDS as readonly string[]).includes(value);

// Lives in the source tree, never under dist/ - see staff.route.ts's own STAFF_UPLOAD_DIR comment
// for why (webpack's output.clean wipes dist/apps/api on every build, and apps/api/src/assets is
// only copied into dist at build time). Mirrors that same precedent exactly for Course images.
const COURSE_UPLOAD_DIR = path.resolve(process.cwd(), 'apps/api/uploads/courses');
fs.mkdirSync(COURSE_UPLOAD_DIR, { recursive: true });

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
// No image/svg+xml - an uploaded SVG can carry <script> and is a stored-XSS vector once rendered
// as/inlined via <img>. Matches staff.route.ts's and gallery.route.ts's own allowlist exactly.
const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, COURSE_UPLOAD_DIR),
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
// their own - see staff.route.ts's identical handleUpload for why this adapter exists.
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

const resolvePublicOrigin = (): string => process.env['API_PUBLIC_URL'] || `http://localhost:${process.env['PORT'] || 3000}`;

// A Course never stores its own copy of the Semester's name/dates - resolved at response time the
// same way staff.route.ts's toStaffDto resolves userId. Falls back to empty/undefined if the
// linked semester has since been deleted rather than throwing and breaking the whole list over
// one orphaned record.
const toCourseDto = async (course: CourseEntity) => {
  const semester = await getSemesterById(course.semesterId);
  return {
    ...course,
    semesterName: semester?.name ?? '',
    semesterStartDate: semester?.startDate,
    semesterEndDate: semester?.endDate,
    semesterRegistrationOpensAt: semester?.registrationOpensAt,
  };
};

// Reading the catalog isn't sensitive - it's meant for every site visitor - so like
// classes.route.ts there's a single public, unpaged read (the public CourseBrowsePage fetches the
// whole published catalog and groups/filters it client-side); only the admin listing below and
// the mutations are gated.
router.get(
  '/api/courses',
  asyncHandler(async (_req: Request, res: Response) => {
    const courses = await listPublishedCourses();
    res.status(200).json(createSuccessResponse(await Promise.all(courses.map(toCourseDto))));
  }),
);

// Registered before "/api/courses/:id" - literal segments ahead of a param route, the same
// ordering classes.route.ts/staff.route.ts use for their own literal routes.
router.get(
  '/api/courses/admin',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query['page']) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query['pageSize']) || 20));
    const rawSearch = typeof req.query['search'] === 'string' ? req.query['search'].trim() : undefined;
    const rawSearchField = req.query['searchField'];
    const searchField = isSearchField(rawSearchField) ? rawSearchField : 'name';
    const semesterId = typeof req.query['semesterId'] === 'string' ? req.query['semesterId'] : undefined;

    const result = await listCourses({
      page,
      pageSize,
      search: rawSearch || undefined,
      searchField: rawSearch ? searchField : undefined,
      semesterId,
    });
    const items = await Promise.all(result.items.map(toCourseDto));

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

router.post(
  '/api/courses/upload',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  handleUpload,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw ValidationError('No file was uploaded');
    }
    res.status(201).json(
      createSuccessResponse({
        url: `${resolvePublicOrigin()}/api/courses/uploads/${req.file.filename}`,
        storageKey: req.file.filename,
      }),
    );
  }),
);

router.use('/api/courses/uploads', express.static(COURSE_UPLOAD_DIR));

router.post(
  '/api/courses',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createCourseSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const semester = await getSemesterById(parsed.data.semesterId);
    if (!semester) {
      throw NotFoundError('Linked semester not found');
    }

    const { isPublished, ...rest } = parsed.data;
    const course = await createCourse({ ...rest, isPublished: isPublished ?? true });
    res.status(201).json(createSuccessResponse(await toCourseDto(course)));
  }),
);

router.put(
  '/api/courses/:id',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const parsed = updateCourseSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    if (parsed.data.semesterId) {
      const semester = await getSemesterById(parsed.data.semesterId);
      if (!semester) {
        throw NotFoundError('Linked semester not found');
      }
    }

    const course = await updateCourse(id, parsed.data);
    if (!course) {
      throw NotFoundError('Course not found');
    }
    res.status(200).json(createSuccessResponse(await toCourseDto(course)));
  }),
);

router.delete(
  '/api/courses/:id',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);

    const classCount = await countClassesByCourseId(id);
    if (classCount > 0) {
      throw ConflictError(`This course still has ${classCount} class${classCount === 1 ? '' : 'es'} - remove or move them first`);
    }

    const course = await getCourseRepository().findById(id);
    if (!course) {
      throw NotFoundError('Course not found');
    }

    if (course.imageSourceType === 'local' && course.imageStorageKey) {
      fs.rm(path.join(COURSE_UPLOAD_DIR, course.imageStorageKey), { force: true }, () => undefined);
    }

    await deleteCourse(id);
    res.status(204).send();
  }),
);

export default router;

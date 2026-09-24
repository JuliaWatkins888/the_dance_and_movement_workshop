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
  getCourseById,
  listClassesUnpaged,
  listCourses,
  listPublishedCourses,
  updateCourse,
} from '@inithium/db';
import type { CourseEntity, CourseSearchField, SemesterEntity } from '@inithium/db';
import { createCourseSchema, updateCourseSchema } from '../schemas/courses.schema';
import { coversWholeYear, createAcademicYearContextLoader, pickSemesters, toSemesterSummary } from '../shared/academicContext';
import type { AcademicYearContextLoader } from '../shared/academicContext';
import { COURSE_UPLOAD_DIR, resolvePublicOrigin } from '../shared/courseUploads';

const router: RouterType = Router();

const STUDIO_OFFERINGS_MANAGE_CAPABILITY = 'studio-offerings:manage';

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

const SEARCH_FIELDS = ['name'] as const;
const isSearchField = (value: unknown): value is CourseSearchField =>
  typeof value === 'string' && (SEARCH_FIELDS as readonly string[]).includes(value);

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

// A Course never stores its own copy of its academic year's title or its semesters' names/dates -
// resolved at response time the same way staff.route.ts's toStaffDto resolves userId. Falls back to
// empty/undefined if the linked year has since been deleted rather than throwing and breaking the
// whole list over one orphaned record.
//
// `semesters` is only the ones this course runs in; `spansFullYear` is whether that's every semester
// its year has. isPubliclyVisible is kept out of the DTO itself - it only gates the public list.
const resolveCourse = async (course: CourseEntity, loadContext: AcademicYearContextLoader) => {
  const { academicYear, semesters: yearSemesters } = await loadContext(course.academicYearId);
  const offered = pickSemesters(yearSemesters, course.semesterIds);
  const now = Date.now();

  return {
    dto: {
      ...course,
      academicYearTitle: academicYear?.title ?? '',
      semesters: offered.map(toSemesterSummary),
      spansFullYear: coversWholeYear(yearSemesters, course.semesterIds),
    },
    // Hidden once its year is unpublished or every semester it runs in is unpublished or over -
    // mirrors class.repository.ts's rule that finished offerings drop out of the public catalog.
    isPubliclyVisible:
      academicYear?.isPublished === true && offered.some((semester) => semester.isPublished && semester.endDate.getTime() >= now),
  };
};

const assertSemestersBelongToYear = (semesterIds: string[], yearSemesters: SemesterEntity[]): void => {
  if (!semesterIds.every((semesterId) => yearSemesters.some((semester) => semester.id === semesterId))) {
    throw ValidationError('Every selected semester must belong to the selected academic year');
  }
};

// Reading the catalog isn't sensitive - it's meant for every site visitor - so like
// classes.route.ts there's a single public, unpaged read (the public CourseBrowsePage fetches the
// whole published catalog and groups/filters it client-side); only the admin listing below and
// the mutations are gated.
router.get(
  '/api/courses',
  asyncHandler(async (_req: Request, res: Response) => {
    const courses = await listPublishedCourses();
    const loadContext = createAcademicYearContextLoader();
    const resolved = await Promise.all(courses.map((course) => resolveCourse(course, loadContext)));
    res.status(200).json(createSuccessResponse(resolved.filter((entry) => entry.isPubliclyVisible).map((entry) => entry.dto)));
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
    const academicYearId = typeof req.query['academicYearId'] === 'string' ? req.query['academicYearId'] : undefined;
    const semesterId = typeof req.query['semesterId'] === 'string' ? req.query['semesterId'] : undefined;

    const result = await listCourses({
      page,
      pageSize,
      search: rawSearch || undefined,
      searchField: rawSearch ? searchField : undefined,
      academicYearId,
      semesterId,
    });
    const loadContext = createAcademicYearContextLoader();
    const items = (await Promise.all(result.items.map((course) => resolveCourse(course, loadContext)))).map((entry) => entry.dto);

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

    const loadContext = createAcademicYearContextLoader();
    const { academicYear, semesters } = await loadContext(parsed.data.academicYearId);
    if (!academicYear) {
      throw NotFoundError('Linked academic year not found');
    }
    assertSemestersBelongToYear(parsed.data.semesterIds, semesters);

    const { isPublished, ...rest } = parsed.data;
    const course = await createCourse({ ...rest, isPublished: isPublished ?? true });
    res.status(201).json(createSuccessResponse((await resolveCourse(course, loadContext)).dto));
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

    const existing = await getCourseById(id);
    if (!existing) {
      throw NotFoundError('Course not found');
    }

    const loadContext = createAcademicYearContextLoader();
    if (parsed.data.academicYearId !== undefined || parsed.data.semesterIds !== undefined) {
      const nextAcademicYearId = parsed.data.academicYearId ?? existing.academicYearId;
      const nextSemesterIds = parsed.data.semesterIds ?? existing.semesterIds;

      const { academicYear, semesters } = await loadContext(nextAcademicYearId);
      if (!academicYear) {
        throw NotFoundError('Linked academic year not found');
      }
      assertSemestersBelongToYear(nextSemesterIds, semesters);

      // A class can only run in semesters its course runs in - so narrowing a course (or moving it
      // to another year) is refused while any of its classes still run in a semester being dropped,
      // rather than silently leaving them pointing outside their course.
      const classes = await listClassesUnpaged({ courseId: id });
      const stranded = classes.filter((classItem) => classItem.semesterIds.some((semesterId) => !nextSemesterIds.includes(semesterId)));
      if (stranded.length > 0) {
        throw ConflictError(
          `${stranded.length} class${stranded.length === 1 ? '' : 'es'} in this course run in a semester you're removing - update or delete them first`,
        );
      }
    }

    const course = await updateCourse(id, parsed.data);
    if (!course) {
      throw NotFoundError('Course not found');
    }
    res.status(200).json(createSuccessResponse((await resolveCourse(course, loadContext)).dto));
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

    const course = await getCourseById(id);
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

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
  createClassSection,
  createCourse,
  createProgram,
  createSchoolYear,
  deleteClassSection,
  deleteCourse,
  deleteProgram,
  deleteSchoolYear,
  getClassSectionById,
  getCourseById,
  getCourseBySlug,
  getProgramById,
  getSchoolYearById,
  listClassSections,
  listCourses,
  listPrograms,
  listSchoolYears,
  updateClassSection,
  updateCourse,
  updateProgram,
  updateSchoolYear,
} from '@inithium/db';
import type { ProgramEntity, SchoolYearEntity } from '@inithium/db';
import type { ZodType } from 'zod';
import {
  createClassSectionSchema,
  createCourseSchema,
  createProgramSchema,
  createSchoolYearSchema,
  updateClassSectionSchema,
  updateCourseSchema,
  updateProgramSchema,
  updateSchoolYearSchema,
} from '../schemas/classes.schema';
import type { CreateSchoolYearBody, UpdateSchoolYearBody } from '../schemas/classes.schema';
import {
  buildPublicCatalog,
  buildPublicCourseDetail,
  buildPublicProgramDetail,
  loadInstructorDirectory,
  toAdminSectionDto,
} from '../services/class-catalog.service';

const router: RouterType = Router();

const MANAGE = requirePermission('classes:manage');

// Program images, stored the same way as staff photos and gallery uploads (see staff.route.ts's
// STAFF_UPLOAD_DIR for why this lives in the source tree and must be committed to survive a
// redeploy).
const CLASSES_UPLOAD_DIR = path.resolve(process.cwd(), 'apps/api/uploads/classes');
fs.mkdirSync(CLASSES_UPLOAD_DIR, { recursive: true });

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
// No image/svg+xml - an uploaded SVG can carry <script>.
const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, CLASSES_UPLOAD_DIR),
    filename: (_req, file, callback) => callback(null, `${randomUUID()}.${EXTENSION_BY_MIME_TYPE[file.mimetype] ?? 'bin'}`),
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

// Adapts multer's errors into a ValidationError the shared errorHandler understands.
const handleUpload = (req: Request, res: Response, next: NextFunction): void => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      next(ValidationError(err.code === 'LIMIT_FILE_SIZE' ? 'File too large. Max size is 5MB.' : err.message));
      return;
    }
    next(err ? ValidationError(err instanceof Error ? err.message : 'Invalid file upload') : undefined);
  });
};

const resolvePublicOrigin = (): string => process.env['API_PUBLIC_URL'] || `http://localhost:${process.env['PORT'] || 3000}`;

// path.basename guards against a storage key ever carrying directory segments.
const removeLocalImage = (program: ProgramEntity): void => {
  if (program.imageSourceType !== 'local' || !program.imageStorageKey) return;
  fs.rm(path.join(CLASSES_UPLOAD_DIR, path.basename(program.imageStorageKey)), { force: true }, () => undefined);
};

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

const parseBody = <T>(schema: ZodType<T>, body: unknown): T => {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw ValidationError('Invalid request body', parsed.error.flatten());
  return parsed.data;
};

const toUtcDate = (calendarDate: string): Date => new Date(`${calendarDate}T00:00:00.000Z`);

const toSemesterInputs = (semesters: NonNullable<CreateSchoolYearBody['semesters']>) =>
  semesters.map(({ id, name, startDate, endDate }) => ({
    ...(id ? { id } : {}),
    name,
    startDate: toUtcDate(startDate),
    endDate: toUtcDate(endDate),
  }));

const assertSlugAvailable = async (slug: string, courseId?: string): Promise<void> => {
  const existing = await getCourseBySlug(slug);
  if (existing && existing.id !== courseId) throw ConflictError('Another course already uses this URL slug');
};

const assertProgramSlugAvailable = async (slug: string, programId?: string): Promise<void> => {
  const existing = (await listPrograms()).find((program) => program.slug === slug);
  if (existing && existing.id !== programId) throw ConflictError('Another program already uses this URL slug');
};

const assertProgramExists = async (programId: string): Promise<void> => {
  if (!(await getProgramById(programId))) throw ValidationError('Program not found');
};

// A section's semesters must all belong to its school year.
const assertSectionSchedule = async (schoolYearId: string, semesterIds: string[]): Promise<SchoolYearEntity> => {
  const schoolYear = await getSchoolYearById(schoolYearId);
  if (!schoolYear) throw ValidationError('School year not found');
  const known = new Set(schoolYear.semesters.map((semester) => semester.id));
  if (semesterIds.some((id) => !known.has(id))) throw ValidationError('Semesters must belong to the chosen school year');
  return schoolYear;
};

const assertInstructorsExist = async (staffIds: string[]): Promise<void> => {
  if (staffIds.length === 0) return;
  const directory = await loadInstructorDirectory();
  if (staffIds.some((id) => !directory.has(id))) throw ValidationError('Instructor not found');
};

// ---- Public ----------------------------------------------------------------------------------

router.get(
  '/api/classes',
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await buildPublicCatalog(new Date())));
  }),
);

router.get(
  '/api/classes/programs/:slug',
  asyncHandler(async (req: Request, res: Response) => {
    const program = await buildPublicProgramDetail(normalizeParam(req.params['slug']), new Date());
    if (!program) throw NotFoundError('Program not found');
    res.status(200).json(createSuccessResponse(program));
  }),
);

router.get(
  '/api/classes/courses/:slug',
  asyncHandler(async (req: Request, res: Response) => {
    const course = await buildPublicCourseDetail(normalizeParam(req.params['slug']), new Date());
    if (!course) throw NotFoundError('Class not found');
    res.status(200).json(createSuccessResponse(course));
  }),
);

// ---- Admin reads -----------------------------------------------------------------------------

// Everything the CMS catalog editor needs in one unpaged call - drafts included.
router.get(
  '/api/classes/admin/catalog',
  requireAuth,
  MANAGE,
  asyncHandler(async (_req: Request, res: Response) => {
    const [programs, courses, sections, directory] = await Promise.all([
      listPrograms(),
      listCourses(),
      listClassSections(),
      loadInstructorDirectory(),
    ]);
    res.status(200).json(
      createSuccessResponse({
        programs,
        courses,
        sections: sections.map((section) => toAdminSectionDto(section, directory)),
      }),
    );
  }),
);

router.get(
  '/api/classes/admin/school-years',
  requireAuth,
  MANAGE,
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await listSchoolYears()));
  }),
);

router.get(
  '/api/classes/admin/instructors',
  requireAuth,
  MANAGE,
  asyncHandler(async (_req: Request, res: Response) => {
    const directory = await loadInstructorDirectory();
    const instructors = [...directory.values()].sort((a, b) => a.name.localeCompare(b.name));
    res.status(200).json(createSuccessResponse(instructors));
  }),
);

// ---- Programs --------------------------------------------------------------------------------

router.post(
  '/api/classes/upload',
  requireAuth,
  MANAGE,
  handleUpload,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw ValidationError('No file was uploaded');
    res.status(201).json(
      createSuccessResponse({
        url: `${resolvePublicOrigin()}/api/classes/uploads/${req.file.filename}`,
        storageKey: req.file.filename,
      }),
    );
  }),
);

router.use('/api/classes/uploads', express.static(CLASSES_UPLOAD_DIR));

router.post(
  '/api/classes/programs',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(createProgramSchema, req.body);
    await assertProgramSlugAvailable(body.slug);
    const order = body.order ?? (await listPrograms()).length;
    const program = await createProgram({ ...body, order, isPublished: body.isPublished ?? true });
    res.status(201).json(createSuccessResponse(program));
  }),
);

router.put(
  '/api/classes/programs/:id',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params['id']);
    const body = parseBody(updateProgramSchema, req.body);
    if (body.slug) await assertProgramSlugAvailable(body.slug, id);
    const previous = await getProgramById(id);
    const program = await updateProgram(id, body);
    if (!previous || !program) throw NotFoundError('Program not found');
    if (previous.imageStorageKey !== program.imageStorageKey) removeLocalImage(previous);
    res.status(200).json(createSuccessResponse(program));
  }),
);

router.delete(
  '/api/classes/programs/:id',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params['id']);
    if ((await listCourses({ programId: id })).length > 0) {
      throw ConflictError('Move or delete this program’s courses before deleting it');
    }
    const program = await getProgramById(id);
    if (!program || !(await deleteProgram(id))) throw NotFoundError('Program not found');
    removeLocalImage(program);
    res.status(204).send();
  }),
);

// ---- Courses ---------------------------------------------------------------------------------

router.post(
  '/api/classes/courses',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(createCourseSchema, req.body);
    await assertProgramExists(body.programId);
    await assertSlugAvailable(body.slug);
    const order = body.order ?? (await listCourses({ programId: body.programId })).length;
    const course = await createCourse({ ...body, order, isPublished: body.isPublished ?? true });
    res.status(201).json(createSuccessResponse(course));
  }),
);

router.put(
  '/api/classes/courses/:id',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params['id']);
    const body = parseBody(updateCourseSchema, req.body);
    if (body.programId) await assertProgramExists(body.programId);
    if (body.slug) await assertSlugAvailable(body.slug, id);
    const course = await updateCourse(id, body);
    if (!course) throw NotFoundError('Course not found');
    res.status(200).json(createSuccessResponse(course));
  }),
);

router.delete(
  '/api/classes/courses/:id',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params['id']);
    if ((await listClassSections({ courseId: id })).length > 0) {
      throw ConflictError('Delete this course’s time slots before deleting it');
    }
    if (!(await deleteCourse(id))) throw NotFoundError('Course not found');
    res.status(204).send();
  }),
);

// ---- Sections --------------------------------------------------------------------------------

router.post(
  '/api/classes/sections',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(createClassSectionSchema, req.body);
    if (!(await getCourseById(body.courseId))) throw ValidationError('Course not found');
    await assertSectionSchedule(body.schoolYearId, body.semesterIds);
    await assertInstructorsExist(body.instructorStaffIds);
    const section = await createClassSection({
      ...body,
      enrolled: body.enrolled ?? 0,
      isPublished: body.isPublished ?? true,
    });
    res.status(201).json(createSuccessResponse(toAdminSectionDto(section, await loadInstructorDirectory())));
  }),
);

router.put(
  '/api/classes/sections/:id',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params['id']);
    const existing = await getClassSectionById(id);
    if (!existing) throw NotFoundError('Time slot not found');

    const body = parseBody(updateClassSectionSchema, req.body);
    if (body.courseId && !(await getCourseById(body.courseId))) throw ValidationError('Course not found');
    if (body.schoolYearId || body.semesterIds) {
      await assertSectionSchedule(body.schoolYearId ?? existing.schoolYearId, body.semesterIds ?? existing.semesterIds);
    }
    if (body.instructorStaffIds) await assertInstructorsExist(body.instructorStaffIds);
    const merged = { startTime: body.startTime ?? existing.startTime, endTime: body.endTime ?? existing.endTime };
    if (merged.endTime <= merged.startTime) throw ValidationError('End time must be after start time');

    const section = await updateClassSection(id, body);
    if (!section) throw NotFoundError('Time slot not found');
    res.status(200).json(createSuccessResponse(toAdminSectionDto(section, await loadInstructorDirectory())));
  }),
);

router.delete(
  '/api/classes/sections/:id',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await deleteClassSection(normalizeParam(req.params['id'])))) throw NotFoundError('Time slot not found');
    res.status(204).send();
  }),
);

// ---- School years ----------------------------------------------------------------------------

router.post(
  '/api/classes/school-years',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(createSchoolYearSchema, req.body);
    const schoolYear = await createSchoolYear({
      name: body.name,
      ...(body.registrationOpensAt ? { registrationOpensAt: toUtcDate(body.registrationOpensAt) } : {}),
      semesters: toSemesterInputs(body.semesters).map(({ id: _id, ...semester }) => semester),
      isPublished: body.isPublished ?? true,
    });
    res.status(201).json(createSuccessResponse(schoolYear));
  }),
);

router.put(
  '/api/classes/school-years/:id',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params['id']);
    const body: UpdateSchoolYearBody = parseBody(updateSchoolYearSchema, req.body);

    // Dropping a semester that sections still run in would silently shorten their schedule.
    if (body.semesters) {
      const keptIds = new Set(body.semesters.flatMap((semester) => (semester.id ? [semester.id] : [])));
      const sections = await listClassSections({ schoolYearId: id });
      if (sections.some((section) => section.semesterIds.some((semesterId) => !keptIds.has(semesterId)))) {
        throw ConflictError('A removed semester still has time slots scheduled in it - update those time slots first');
      }
    }

    const schoolYear = await updateSchoolYear(id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.isPublished !== undefined ? { isPublished: body.isPublished } : {}),
      ...(body.registrationOpensAt !== undefined
        ? { registrationOpensAt: body.registrationOpensAt === null ? null : toUtcDate(body.registrationOpensAt) }
        : {}),
      ...(body.semesters ? { semesters: toSemesterInputs(body.semesters) } : {}),
    });
    if (!schoolYear) throw NotFoundError('School year not found');
    res.status(200).json(createSuccessResponse(schoolYear));
  }),
);

router.delete(
  '/api/classes/school-years/:id',
  requireAuth,
  MANAGE,
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params['id']);
    if ((await listClassSections({ schoolYearId: id })).length > 0) {
      throw ConflictError('Time slots are still scheduled in this school year');
    }
    if (!(await deleteSchoolYear(id))) throw NotFoundError('School year not found');
    res.status(204).send();
  }),
);

export default router;

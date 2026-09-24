import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import {
  countClassesByCourseIds,
  countCoursesByAcademicYearId,
  countWorkshopsBySemesterIds,
  listAcademicYearsUnpaged,
  listCourses,
  listSemestersByAcademicYearId,
} from '@inithium/db';

const router: RouterType = Router();

const STUDIO_OFFERINGS_MANAGE_CAPABILITY = 'studio-offerings:manage';

// Aggregate rollup for the Studio Offerings CMS dashboard's "1000-foot view" - reuses the same
// count* repository methods the cascade-delete guards already call, rather than fetching every
// Course/Class/Workshop in full just to count them. Class has no direct academic year of its own
// (see class.contract.ts), so its count is summed across that year's Course ids, and a Workshop's is
// summed across the year's semester ids - the one hop each of those needs that Course doesn't.
router.get(
  '/api/studio-offerings/stats',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const academicYearId = typeof req.query['academicYearId'] === 'string' ? req.query['academicYearId'] : undefined;

    const academicYearCount = (await listAcademicYearsUnpaged()).length;

    let courseCount = 0;
    let classCount = 0;
    let workshopCount = 0;
    if (academicYearId) {
      const [semesters, courses] = await Promise.all([
        listSemestersByAcademicYearId(academicYearId),
        listCourses({ page: 1, pageSize: 500, academicYearId }),
      ]);
      [courseCount, classCount, workshopCount] = await Promise.all([
        countCoursesByAcademicYearId(academicYearId),
        countClassesByCourseIds(courses.items.map((course) => course.id)),
        countWorkshopsBySemesterIds(semesters.map((semester) => semester.id)),
      ]);
    }

    res.status(200).json(createSuccessResponse({ academicYearCount, courseCount, classCount, workshopCount }));
  }),
);

export default router;

import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import { countClassesByCourseIds, countCoursesBySemesterId, countWorkshopsBySemesterId, listCourses, listSemesters } from '@inithium/db';

const router: RouterType = Router();

const STUDIO_OFFERINGS_MANAGE_CAPABILITY = 'studio-offerings:manage';

// Aggregate rollup for the Studio Offerings CMS dashboard's "1000-foot view" - reuses the same
// countBySemesterId/countByCourseIds repository methods the cascade-delete guards already call,
// rather than fetching every Course/Class/Workshop in full just to count them. Class has no direct
// semesterId of its own (see class.contract.ts), so its count is summed across that semester's
// Course ids - the one hop the other two counts don't need.
router.get(
  '/api/studio-offerings/stats',
  requireAuth,
  requirePermission(STUDIO_OFFERINGS_MANAGE_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const semesterId = typeof req.query['semesterId'] === 'string' ? req.query['semesterId'] : undefined;

    const [semesterTotal, courseCount, workshopCount] = await Promise.all([
      listSemesters({ page: 1, pageSize: 1 }).then((result) => result.total),
      semesterId ? countCoursesBySemesterId(semesterId) : Promise.resolve(0),
      semesterId ? countWorkshopsBySemesterId(semesterId) : Promise.resolve(0),
    ]);

    let classCount = 0;
    if (semesterId) {
      const courses = await listCourses({ page: 1, pageSize: 500, semesterId });
      classCount = await countClassesByCourseIds(courses.items.map((course) => course.id));
    }

    res.status(200).json(createSuccessResponse({ semesterCount: semesterTotal, courseCount, classCount, workshopCount }));
  }),
);

export default router;

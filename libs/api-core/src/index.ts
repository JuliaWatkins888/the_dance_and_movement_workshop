import type { Express } from 'express';
import healthRouter from './routes/health.route';
import authRouter from './routes/auth.route';
import apiUtilsCheckRouter from './routes/api-utils-check.route';
import pagesRouter from './routes/pages.route';
import presenceRouter from './routes/presence.route';
import notificationsRouter from './routes/notifications.route';
import usersRouter from './routes/users.route';
import settingsRouter from './routes/settings.route';
import profileRouter from './routes/profile.route';
// inithium:block:gallery:imports:start
import galleryRouter from './routes/gallery.route';
// inithium:block:gallery:imports:end
// inithium:block:contact:imports:start
import contactRouter from './routes/contact.route';
// inithium:block:contact:imports:end
// inithium:block:staff:imports:start
import staffRouter from './routes/staff.route';
// inithium:block:staff:imports:end
// inithium:block:time:imports:start
import timeClockRouter from './routes/time/time-clock.route';
import timeAdminRouter from './routes/time/time-admin.route';
import timeEntryTypesRouter from './routes/time/time-entry-types.route';
import timeSettingsRouter from './routes/time/time-settings.route';
import timeExportRouter from './routes/time/time-export.route';
// inithium:block:time:imports:end
// inithium:block:policy:imports:start
import policyRouter from './routes/policy.route';
// inithium:block:policy:imports:end
// inithium:block:classes:imports:start
import classesRouter from './routes/classes.route';
// inithium:block:classes:imports:end
// inithium:block:children:imports:start
import childrenRouter from './routes/children.route';
// inithium:block:children:imports:end
// inithium:block:studio-offerings:imports:start
import semestersRouter from './routes/semesters.route';
import coursesRouter from './routes/courses.route';
import workshopsRouter from './routes/workshops.route';
import studioOfferingsRouter from './routes/studio-offerings.route';
// inithium:block:studio-offerings:imports:end
// inithium:anchor:imports

export const registerCoreRoutes = (app: Express): void => {
  app.use(healthRouter);
  app.use(authRouter);
  app.use(apiUtilsCheckRouter);
  app.use(pagesRouter);
  app.use(presenceRouter);
  app.use(notificationsRouter);
  app.use(usersRouter);
  app.use(settingsRouter);
  app.use(profileRouter);
// inithium:block:gallery:routes:start
  app.use(galleryRouter);
// inithium:block:gallery:routes:end
// inithium:block:contact:routes:start
  app.use(contactRouter);
// inithium:block:contact:routes:end
// inithium:block:staff:routes:start
  app.use(staffRouter);
// inithium:block:staff:routes:end
// inithium:block:time:routes:start
  app.use(timeClockRouter);
  app.use(timeAdminRouter);
  app.use(timeEntryTypesRouter);
  app.use(timeSettingsRouter);
  app.use(timeExportRouter);
// inithium:block:time:routes:end
// inithium:block:policy:routes:start
  app.use(policyRouter);
// inithium:block:policy:routes:end
// inithium:block:classes:routes:start
  app.use(classesRouter);
// inithium:block:classes:routes:end
// inithium:block:children:routes:start
  app.use(childrenRouter);
// inithium:block:children:routes:end
// inithium:block:studio-offerings:routes:start
  app.use(semestersRouter);
  app.use(coursesRouter);
  app.use(workshopsRouter);
  app.use(studioOfferingsRouter);
// inithium:block:studio-offerings:routes:end
  // inithium:anchor:routes
  console.log('✅ Core routes registered');
};

export { createCrudService } from './services/createCrudService';
export type { CrudRepository, CrudService } from './services/createCrudService';

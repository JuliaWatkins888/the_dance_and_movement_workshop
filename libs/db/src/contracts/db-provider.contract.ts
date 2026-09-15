import { UserRepository } from './user.contract';
import { PageRepository } from './page.contract';
import { NotificationRepository } from './notification.contract';
import { SettingsRepository } from './settings.contract';
// inithium:block:gallery:imports:start
import { GalleryRepository } from './gallery-image.contract';
// inithium:block:gallery:imports:end
// inithium:block:contact:imports:start
import { CommunicationRepository } from './communication.contract';
// inithium:block:contact:imports:end
// inithium:block:staff:imports:start
import { StaffRepository } from './staff.contract';
// inithium:block:staff:imports:end
// inithium:block:time:imports:start
import { TimeEntryRepository } from './time-entry.contract';
import { TimeEntryTypeRepository } from './time-entry-type.contract';
import { TimeSettingsRepository } from './time-settings.contract';
import { TimeAuditLogRepository } from './time-audit-log.contract';
// inithium:block:time:imports:end
// inithium:block:policy:imports:start
import { PolicyRepository } from './policy.contract';
// inithium:block:policy:imports:end
// inithium:block:classes:imports:start
import { ClassRepository } from './class.contract';
// inithium:block:classes:imports:end
// inithium:block:children:imports:start
import { ChildRepository } from './child.contract';
// inithium:block:children:imports:end
// inithium:block:studio-offerings:imports:start
import { SemesterRepository } from './semester.contract';
import { CourseRepository } from './course.contract';
import { WorkshopRepository } from './workshop.contract';
// inithium:block:studio-offerings:imports:end
// inithium:anchor:imports

export interface DbConfig {
  uri?: string;
  credentials?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DbProvider {
  name: string;
  connect: (config: DbConfig) => Promise<void>;
  disconnect: () => Promise<void>;
  getUserRepository: () => UserRepository;
  getPageRepository: () => PageRepository;
  getNotificationRepository: () => NotificationRepository;
  getSettingRepository: () => SettingsRepository;
// inithium:block:gallery:members:start
  getGalleryRepository: () => GalleryRepository;
// inithium:block:gallery:members:end
// inithium:block:contact:members:start
  getCommunicationRepository: () => CommunicationRepository;
// inithium:block:contact:members:end
// inithium:block:staff:members:start
  getStaffRepository: () => StaffRepository;
// inithium:block:staff:members:end
// inithium:block:time:members:start
  getTimeEntryRepository: () => TimeEntryRepository;
  getTimeEntryTypeRepository: () => TimeEntryTypeRepository;
  getTimeSettingsRepository: () => TimeSettingsRepository;
  getTimeAuditLogRepository: () => TimeAuditLogRepository;
// inithium:block:time:members:end
// inithium:block:policy:members:start
  getPolicyRepository: () => PolicyRepository;
// inithium:block:policy:members:end
// inithium:block:classes:members:start
  getClassRepository: () => ClassRepository;
// inithium:block:classes:members:end
// inithium:block:children:members:start
  getChildRepository: () => ChildRepository;
// inithium:block:children:members:end
// inithium:block:studio-offerings:members:start
  getSemesterRepository: () => SemesterRepository;
  getCourseRepository: () => CourseRepository;
  getWorkshopRepository: () => WorkshopRepository;
// inithium:block:studio-offerings:members:end
  // inithium:anchor:members
}

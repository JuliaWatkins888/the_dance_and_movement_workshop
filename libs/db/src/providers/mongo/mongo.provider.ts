import mongoose from 'mongoose';
import { DbProvider, DbConfig } from '../../contracts/db-provider.contract';
import { UserRepository } from '../../contracts/user.contract';
import { PageRepository } from '../../contracts/page.contract';
import { NotificationRepository } from '../../contracts/notification.contract';
import { SettingsRepository } from '../../contracts/settings.contract';
import { createMongoUserRepository } from './user.repository';
import { createMongoPageRepository } from './page.repository';
import { createMongoNotificationRepository } from './notification.repository';
import { createMongoSettingsRepository } from './settings.repository';
import { UserModel } from './models/userModel';
import { PageModel } from '../../schemas/page.schema';
import { NotificationModel } from '../../schemas/notification.schema';
import { SettingsModel } from '../../schemas/settings.schema';
// inithium:block:gallery:imports:start
import { GalleryRepository } from '../../contracts/gallery-image.contract';
import { createMongoGalleryImageRepository } from './gallery-image.repository';
import { GalleryImageModel } from '../../schemas/gallery-image.schema';
// inithium:block:gallery:imports:end
// inithium:block:contact:imports:start
import { CommunicationRepository } from '../../contracts/communication.contract';
import { createMongoCommunicationRepository } from './communication.repository';
import { CommunicationModel } from '../../schemas/communication.schema';
// inithium:block:contact:imports:end
// inithium:block:staff:imports:start
import { StaffRepository } from '../../contracts/staff.contract';
import { createMongoStaffRepository } from './staff.repository';
import { StaffModel } from '../../schemas/staff.schema';
// inithium:block:staff:imports:end
// inithium:block:time:imports:start
import { TimeEntryRepository } from '../../contracts/time-entry.contract';
import { TimeEntryTypeRepository } from '../../contracts/time-entry-type.contract';
import { TimeSettingsRepository } from '../../contracts/time-settings.contract';
import { TimeAuditLogRepository } from '../../contracts/time-audit-log.contract';
import { createMongoTimeEntryRepository } from './time-entry.repository';
import { createMongoTimeEntryTypeRepository } from './time-entry-type.repository';
import { createMongoTimeSettingsRepository } from './time-settings.repository';
import { createMongoTimeAuditLogRepository } from './time-audit-log.repository';
import { TimeEntryModel } from '../../schemas/time-entry.schema';
import { TimeEntryTypeModel } from '../../schemas/time-entry-type.schema';
import { TimeSettingsModel } from '../../schemas/time-settings.schema';
import { TimeAuditLogModel } from '../../schemas/time-audit-log.schema';
// inithium:block:time:imports:end
// inithium:block:policy:imports:start
import { PolicyRepository } from '../../contracts/policy.contract';
import { createMongoPolicyRepository } from './policy.repository';
import { PolicyCategoryModel } from '../../schemas/policy.schema';
// inithium:block:policy:imports:end
// inithium:block:classes:imports:start
import { ClassRepository } from '../../contracts/class.contract';
import { createMongoClassRepository } from './class.repository';
import { ClassModel } from '../../schemas/class.schema';
// inithium:block:classes:imports:end
// inithium:block:children:imports:start
import { ChildRepository } from '../../contracts/child.contract';
import { createMongoChildRepository } from './child.repository';
import { ChildModel } from '../../schemas/child.schema';
// inithium:block:children:imports:end
// inithium:anchor:imports

const userRepository = createMongoUserRepository(UserModel);
const pageRepository = createMongoPageRepository(PageModel);
const notificationRepository = createMongoNotificationRepository(NotificationModel);
const settingsRepository = createMongoSettingsRepository(SettingsModel);
// inithium:block:gallery:repository-instances:start
const galleryRepository = createMongoGalleryImageRepository(GalleryImageModel);
// inithium:block:gallery:repository-instances:end
// inithium:block:contact:repository-instances:start
const communicationRepository = createMongoCommunicationRepository(CommunicationModel);
// inithium:block:contact:repository-instances:end
// inithium:block:staff:repository-instances:start
const staffRepository = createMongoStaffRepository(StaffModel);
// inithium:block:staff:repository-instances:end
// inithium:block:time:repository-instances:start
const timeEntryRepository = createMongoTimeEntryRepository(TimeEntryModel);
const timeEntryTypeRepository = createMongoTimeEntryTypeRepository(TimeEntryTypeModel);
const timeSettingsRepository = createMongoTimeSettingsRepository(TimeSettingsModel);
const timeAuditLogRepository = createMongoTimeAuditLogRepository(TimeAuditLogModel);
// inithium:block:time:repository-instances:end
// inithium:block:policy:repository-instances:start
const policyRepository = createMongoPolicyRepository(PolicyCategoryModel);
// inithium:block:policy:repository-instances:end
// inithium:block:classes:repository-instances:start
const classRepository = createMongoClassRepository(ClassModel);
// inithium:block:classes:repository-instances:end
// inithium:block:children:repository-instances:start
const childRepository = createMongoChildRepository(ChildModel);
// inithium:block:children:repository-instances:end
// inithium:anchor:repository-instances

export const mongoProvider: DbProvider = {
  name: 'MongoDB',
  connect: async (config: DbConfig) => {
    if (!config.uri) {
      throw new Error('MongoDB URI is required in DbConfig');
    }
    if (mongoose.connection.readyState >= 1) {
      return;
    }
    await mongoose.connect(config.uri);
  },
  disconnect: async () => {
    await mongoose.disconnect();
  },
  getUserRepository: (): UserRepository => userRepository,
  getPageRepository: (): PageRepository => pageRepository,
  getNotificationRepository: (): NotificationRepository => notificationRepository,
  getSettingRepository: (): SettingsRepository => settingsRepository,
// inithium:block:gallery:members:start
  getGalleryRepository: (): GalleryRepository => galleryRepository,
// inithium:block:gallery:members:end
// inithium:block:contact:members:start
  getCommunicationRepository: (): CommunicationRepository => communicationRepository,
// inithium:block:contact:members:end
// inithium:block:staff:members:start
  getStaffRepository: (): StaffRepository => staffRepository,
// inithium:block:staff:members:end
// inithium:block:time:members:start
  getTimeEntryRepository: (): TimeEntryRepository => timeEntryRepository,
  getTimeEntryTypeRepository: (): TimeEntryTypeRepository => timeEntryTypeRepository,
  getTimeSettingsRepository: (): TimeSettingsRepository => timeSettingsRepository,
  getTimeAuditLogRepository: (): TimeAuditLogRepository => timeAuditLogRepository,
// inithium:block:time:members:end
// inithium:block:policy:members:start
  getPolicyRepository: (): PolicyRepository => policyRepository,
// inithium:block:policy:members:end
// inithium:block:classes:members:start
  getClassRepository: (): ClassRepository => classRepository,
// inithium:block:classes:members:end
// inithium:block:children:members:start
  getChildRepository: (): ChildRepository => childRepository,
// inithium:block:children:members:end
  // inithium:anchor:members
};

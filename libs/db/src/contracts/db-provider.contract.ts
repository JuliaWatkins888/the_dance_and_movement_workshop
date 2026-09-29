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
import { ProgramRepository } from './program.contract';
import { CourseRepository } from './course.contract';
import { ClassSectionRepository } from './class-section.contract';
import { SchoolYearRepository } from './school-year.contract';
import { ClassRegistrationRepository } from './class-registration.contract';
// inithium:block:classes:imports:end
// inithium:block:children:imports:start
import { ChildRepository } from './child.contract';
// inithium:block:children:imports:end
// inithium:block:ecommerce:imports:start
import { ProductRepository } from './product.contract';
import { CartRepository } from './cart.contract';
import { OrderRepository } from './order.contract';
import { DiscountRepository } from './discount.contract';
import { BillingSubscriptionRepository } from './billing-subscription.contract';
import { ShippingMethodRepository } from './shipping-method.contract';
import { PaymentCustomerRepository } from './payment-customer.contract';
import { PaymentEventRepository } from './payment-event.contract';
// inithium:block:ecommerce:imports:end
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
  getProgramRepository: () => ProgramRepository;
  getCourseRepository: () => CourseRepository;
  getClassSectionRepository: () => ClassSectionRepository;
  getSchoolYearRepository: () => SchoolYearRepository;
  getClassRegistrationRepository: () => ClassRegistrationRepository;
// inithium:block:classes:members:end
// inithium:block:children:members:start
  getChildRepository: () => ChildRepository;
// inithium:block:children:members:end
// inithium:block:ecommerce:members:start
  getProductRepository: () => ProductRepository;
  getCartRepository: () => CartRepository;
  getOrderRepository: () => OrderRepository;
  getDiscountRepository: () => DiscountRepository;
  getBillingSubscriptionRepository: () => BillingSubscriptionRepository;
  getShippingMethodRepository: () => ShippingMethodRepository;
  getPaymentCustomerRepository: () => PaymentCustomerRepository;
  getPaymentEventRepository: () => PaymentEventRepository;
// inithium:block:ecommerce:members:end
  // inithium:anchor:members
}

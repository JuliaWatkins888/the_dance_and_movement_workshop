import type { CmsModule } from './registry';
import { SubscriptionsAdminModule } from './subscriptions/SubscriptionsAdminModule';

const subscriptionsAdminModule: CmsModule = {
  id: 'subscriptions',
  navLabel: 'Subscriptions',
  icon: 'ArrowsClockwise',
  order: 44,
  requiredCapability: 'ecommerce:manage-orders',
  Component: SubscriptionsAdminModule,
};

export default subscriptionsAdminModule;

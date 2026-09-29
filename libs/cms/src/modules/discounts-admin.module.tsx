import type { CmsModule } from './registry';
import { DiscountsAdminModule } from './discounts/DiscountsAdminModule';

const discountsAdminModule: CmsModule = {
  id: 'discounts',
  navLabel: 'Discounts',
  icon: 'Tag',
  order: 42,
  requiredCapability: 'ecommerce:manage-discounts',
  Component: DiscountsAdminModule,
};

export default discountsAdminModule;

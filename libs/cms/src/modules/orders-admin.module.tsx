import type { CmsModule } from './registry';
import { OrdersAdminModule } from './orders/OrdersAdminModule';

// Viewing and managing orders needs ecommerce:manage-orders; the module's "Create Order" button
// additionally needs ecommerce:record-sales, so the two can be granted separately.
const ordersAdminModule: CmsModule = {
  id: 'orders',
  navLabel: 'Orders',
  icon: 'Receipt',
  order: 41,
  requiredCapability: 'ecommerce:manage-orders',
  Component: OrdersAdminModule,
};

export default ordersAdminModule;

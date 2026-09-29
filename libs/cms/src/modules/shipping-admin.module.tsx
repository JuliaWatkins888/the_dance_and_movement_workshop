import type { CmsModule } from './registry';
import { ShippingMethodsAdminModule } from './shipping/ShippingMethodsAdminModule';

const shippingAdminModule: CmsModule = {
  id: 'shipping',
  navLabel: 'Shipping',
  icon: 'Truck',
  order: 43,
  requiredCapability: 'ecommerce:manage-shipping',
  Component: ShippingMethodsAdminModule,
};

export default shippingAdminModule;

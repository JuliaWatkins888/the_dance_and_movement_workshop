import type { CmsModule } from './registry';
import { ProductsAdminModule } from './products/ProductsAdminModule';

const productsAdminModule: CmsModule = {
  id: 'products',
  navLabel: 'Products',
  icon: 'Package',
  order: 40,
  requiredCapability: 'ecommerce:manage-products',
  Component: ProductsAdminModule,
};

export default productsAdminModule;

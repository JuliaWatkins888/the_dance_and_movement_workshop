import type { CapabilityDefinition } from './registry';

const ecommerceManageProductsCapability: CapabilityDefinition = {
  key: 'ecommerce:manage-products',
  label: 'Manage Products',
  description: 'Create, edit, publish, and delete store products, variants, and stock.',
  group: 'Commerce',
  order: 40,
  defaultRoles: ['admin'],
};

export default ecommerceManageProductsCapability;

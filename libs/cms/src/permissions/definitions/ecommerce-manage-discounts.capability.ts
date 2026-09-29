import type { CapabilityDefinition } from './registry';

const ecommerceManageDiscountsCapability: CapabilityDefinition = {
  key: 'ecommerce:manage-discounts',
  label: 'Manage Discount Codes',
  description: 'Create, edit, and delete promo codes.',
  group: 'Commerce',
  order: 42,
  defaultRoles: ['admin'],
};

export default ecommerceManageDiscountsCapability;

import type { CapabilityDefinition } from './registry';

const ecommerceManageShippingCapability: CapabilityDefinition = {
  key: 'ecommerce:manage-shipping',
  label: 'Manage Shipping Methods',
  description: 'Create, edit, and delete the shipping options offered at checkout.',
  group: 'Commerce',
  order: 43,
  defaultRoles: ['admin'],
};

export default ecommerceManageShippingCapability;

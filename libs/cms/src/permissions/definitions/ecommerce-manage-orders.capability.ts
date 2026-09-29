import type { CapabilityDefinition } from './registry';

const ecommerceManageOrdersCapability: CapabilityDefinition = {
  key: 'ecommerce:manage-orders',
  label: 'Manage Orders & Subscriptions',
  description: 'View every order and subscription, record fulfillment/cancellation/refund status, and cancel subscriptions.',
  group: 'Commerce',
  order: 41,
  defaultRoles: ['admin'],
};

export default ecommerceManageOrdersCapability;

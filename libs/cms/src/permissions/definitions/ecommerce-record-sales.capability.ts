import type { CapabilityDefinition } from './registry';

const ecommerceRecordSalesCapability: CapabilityDefinition = {
  key: 'ecommerce:record-sales',
  label: 'Record Sales',
  description:
    "Create orders on a customer's behalf for purchases paid outside the store (in person, by phone). Pair with Manage Orders to also see them in the Orders module.",
  group: 'Commerce',
  order: 44,
  defaultRoles: ['admin'],
};

export default ecommerceRecordSalesCapability;

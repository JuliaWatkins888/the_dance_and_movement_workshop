import type { UpsertSettingInput } from '../contracts/settings.contract';

// One currency per install (ISO 4217, lowercase as payment providers expect). Seeded rather than
// CMS-editable on purpose: changing it after orders and subscriptions exist would silently mix
// currencies across history and live billing.
const ecommerceCurrencySettingSeed: UpsertSettingInput = {
  key: 'ecommerce.currency',
  type: 'string',
  value: 'usd',
};

export default ecommerceCurrencySettingSeed;

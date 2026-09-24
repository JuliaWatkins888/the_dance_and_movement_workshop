import type { SettingDefinition } from './registry';

// Read by libs/api-core's classPricing.ts (key + default must match YEAR_DISCOUNT_SETTING_KEY /
// DEFAULT_YEAR_DISCOUNT_PERCENT there).
const pricingYearDiscountSetting: SettingDefinition = {
  key: 'pricing.yearDiscountPercent',
  label: 'Full-Year Discount (%)',
  description:
    'Percent off when a family pays for the whole academic year up front - only offered on classes that run in both semesters. A year price is the class’s monthly price × 12 months, less this discount (e.g. $100/mo at 10% = $1,080). 0-100.',
  group: 'Pricing',
  order: 1,
  type: 'number',
  default: 10,
};

export default pricingYearDiscountSetting;

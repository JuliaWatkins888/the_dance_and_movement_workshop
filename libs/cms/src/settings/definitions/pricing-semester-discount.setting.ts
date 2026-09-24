import type { SettingDefinition } from './registry';

// Read by libs/api-core's classPricing.ts (key + default must match SEMESTER_DISCOUNT_SETTING_KEY /
// DEFAULT_SEMESTER_DISCOUNT_PERCENT there).
const pricingSemesterDiscountSetting: SettingDefinition = {
  key: 'pricing.semesterDiscountPercent',
  label: 'Semester Discount (%)',
  description:
    'Percent off when a family pays for a whole semester up front. A semester price is the class’s monthly price × 6 months, less this discount (e.g. $100/mo at 5% = $570). 0-100.',
  group: 'Pricing',
  order: 0,
  type: 'number',
  default: 5,
};

export default pricingSemesterDiscountSetting;

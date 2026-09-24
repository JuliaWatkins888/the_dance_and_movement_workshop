import { getSetting } from '@inithium/db';

// Keys of the CMS-editable studio-wide settings (see libs/cms/src/settings/definitions/pricing-*.setting.ts,
// which must keep matching defaults - same by-hand duplication the other settings already accept).
export const SEMESTER_DISCOUNT_SETTING_KEY = 'pricing.semesterDiscountPercent';
export const YEAR_DISCOUNT_SETTING_KEY = 'pricing.yearDiscountPercent';

const DEFAULT_SEMESTER_DISCOUNT_PERCENT = 5;
const DEFAULT_YEAR_DISCOUNT_PERCENT = 10;

// A semester is six months and an academic year is twelve - fixed by how the studio calendar is
// split, not something the owner tunes, so they live in code while the discounts live in settings.
const MONTHS_PER_SEMESTER = 6;
const MONTHS_PER_YEAR = 12;

export interface PricingConfig {
  semesterDiscountPercent: number;
  yearDiscountPercent: number;
  monthsPerSemester: number;
  monthsPerYear: number;
}

export interface ClassPricing {
  monthly: number;
  semester: number;
  // Only present when the class runs in both semesters of its year.
  year?: number;
  semesterDiscountPercent: number;
  yearDiscountPercent: number;
}

// An unset, mistyped, or out-of-range setting falls back to (or is clamped into) something safe
// rather than throwing, so a bad admin edit can never break every class listing.
const readDiscountPercent = async (key: string, fallback: number): Promise<number> => {
  const setting = await getSetting(key);
  if (!setting || setting.type !== 'number' || !Number.isFinite(setting.value)) return fallback;
  return Math.min(100, Math.max(0, setting.value));
};

export const getPricingConfig = async (): Promise<PricingConfig> => {
  const [semesterDiscountPercent, yearDiscountPercent] = await Promise.all([
    readDiscountPercent(SEMESTER_DISCOUNT_SETTING_KEY, DEFAULT_SEMESTER_DISCOUNT_PERCENT),
    readDiscountPercent(YEAR_DISCOUNT_SETTING_KEY, DEFAULT_YEAR_DISCOUNT_PERCENT),
  ]);
  return { semesterDiscountPercent, yearDiscountPercent, monthsPerSemester: MONTHS_PER_SEMESTER, monthsPerYear: MONTHS_PER_YEAR };
};

const roundToCents = (amount: number): number => Math.round(amount * 100) / 100;

const discountedTotal = (monthly: number, months: number, discountPercent: number): number =>
  roundToCents(monthly * (1 - discountPercent / 100) * months);

// Semester in full = (monthly * (1 - semesterDiscount)) * 6; year in full = (monthly * (1 -
// yearDiscount)) * 12. Mirrored by libs/api-client's computeClassPricing for the CMS form's live
// preview - keep the two formulas identical.
export const computeClassPricing = (monthly: number, spansFullYear: boolean, config: PricingConfig): ClassPricing => ({
  monthly,
  semester: discountedTotal(monthly, config.monthsPerSemester, config.semesterDiscountPercent),
  ...(spansFullYear ? { year: discountedTotal(monthly, config.monthsPerYear, config.yearDiscountPercent) } : {}),
  semesterDiscountPercent: config.semesterDiscountPercent,
  yearDiscountPercent: config.yearDiscountPercent,
});

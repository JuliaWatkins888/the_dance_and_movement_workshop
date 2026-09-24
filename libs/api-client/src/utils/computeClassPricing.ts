import type { ClassPricingConfigDto, ClassPricingDto } from '../endpoints/classes.endpoints';

const roundToCents = (amount: number): number => Math.round(amount * 100) / 100;

const discountedTotal = (monthly: number, months: number, discountPercent: number): number =>
  roundToCents(monthly * (1 - discountPercent / 100) * months);

// Client-side twin of libs/api-core's classPricing.ts computeClassPricing, used for the CMS class
// form's live preview while the admin is still typing a monthly price the server hasn't seen yet.
// Every price a class is actually *sold* at comes from the server's own ClassDto.pricing - keep the
// two formulas identical.
export const computeClassPricing = (monthly: number, spansFullYear: boolean, config: ClassPricingConfigDto): ClassPricingDto => ({
  monthly,
  semester: discountedTotal(monthly, config.monthsPerSemester, config.semesterDiscountPercent),
  ...(spansFullYear ? { year: discountedTotal(monthly, config.monthsPerYear, config.yearDiscountPercent) } : {}),
  semesterDiscountPercent: config.semesterDiscountPercent,
  yearDiscountPercent: config.yearDiscountPercent,
});

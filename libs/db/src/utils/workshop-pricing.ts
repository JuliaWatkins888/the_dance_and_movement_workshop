import type { WorkshopDayEntity, WorkshopEntity } from '../contracts/workshop.contract';
import { applyDiscount } from './class-pricing';

export interface WorkshopPrice {
  amountCents: number;
  // Before the whole-workshop discount.
  fullPriceCents: number;
  isFullWorkshop: boolean;
  discountPercent: number;
}

// Days are priced individually; choosing every day of the workshop applies its discount.
export const resolveWorkshopPrice = (
  workshop: Pick<WorkshopEntity, 'pricePerDayCents' | 'fullWorkshopDiscountPercent'> & { days: unknown[] },
  selectedDayCount: number,
): WorkshopPrice => {
  const fullPriceCents = workshop.pricePerDayCents * selectedDayCount;
  const isFullWorkshop = selectedDayCount > 0 && selectedDayCount === workshop.days.length;
  const discountPercent = isFullWorkshop ? workshop.fullWorkshopDiscountPercent : 0;
  return {
    amountCents: applyDiscount(fullPriceCents, discountPercent),
    fullPriceCents,
    isFullWorkshop,
    discountPercent,
  };
};

// Registration closes for every day once the first one begins.
export const workshopRegistrationClosesAt = (days: Pick<WorkshopDayEntity, 'startsAt'>[]): Date | undefined =>
  days.reduce<Date | undefined>((earliest, day) => (!earliest || day.startsAt < earliest ? day.startsAt : earliest), undefined);

export const workshopEndsAt = (days: Pick<WorkshopDayEntity, 'endsAt'>[]): Date | undefined =>
  days.reduce<Date | undefined>((latest, day) => (!latest || day.endsAt > latest ? day.endsAt : latest), undefined);

export const isWorkshopRegistrationOpen = (days: Pick<WorkshopDayEntity, 'startsAt'>[], now: Date): boolean => {
  const closesAt = workshopRegistrationClosesAt(days);
  return closesAt !== undefined && now < closesAt;
};

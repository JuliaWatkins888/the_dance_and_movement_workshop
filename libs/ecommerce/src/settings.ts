import { getSetting } from '@inithium/db';

export const CURRENCY_SETTING_KEY = 'ecommerce.currency';
const DEFAULT_CURRENCY = 'usd';

export const getStoreCurrency = async (): Promise<string> => {
  const setting = await getSetting(CURRENCY_SETTING_KEY);
  return setting?.type === 'string' && setting.value.trim() ? setting.value.trim().toLowerCase() : DEFAULT_CURRENCY;
};

export const ACCESS_TOKEN_STORAGE_KEY = 'accessToken';

export const getStoredAccessToken = (): string | null => localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);

export const setStoredAccessToken = (token: string | null): void => {
  if (token) {
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  }
};

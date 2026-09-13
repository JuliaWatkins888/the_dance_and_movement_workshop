import { getStoredAccessToken, setStoredAccessToken } from '@inithium/api-client';

// Module-level pub/sub for "am I logged in" — the same recipe @inithium/ui's alert/dialog/drawer
// stores use for global state that needs to be read and updated from components that don't
// share a parent (the Navbar rendered from app.tsx, a Login test page rendered elsewhere via
// PageShell's slug lookup). No Redux slice for this: it's one string, and RTK Query's own cache
// (via `getMe`) already covers the "who is this token" half of the picture.
let token: string | null = getStoredAccessToken();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export const authStore = {
  getToken: (): string | null => token,
  setToken: (next: string | null): void => {
    token = next;
    setStoredAccessToken(next);
    emit();
  },
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

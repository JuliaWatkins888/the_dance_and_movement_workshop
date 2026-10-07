import type { Request } from 'express';
import rateLimit from 'express-rate-limit';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

// Keyed by client IP, which is only the real visitor's address when the API host sets
// `trust proxy` to the exact number of proxies in front of it (TRUST_PROXY in apps/api).
const createLimiter = (windowMs: number, limit: number, message: string, skipSuccessfulRequests = true) =>
  rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMITED', message } },
  });

// Failed attempts only, so a family that signs in normally never notices it.
export const loginRateLimiter = createLimiter(FIFTEEN_MINUTES_MS, 10, 'Too many sign-in attempts. Please try again in a few minutes.');

// Spreading guesses for one account across many IPs still hits this per-account cap.
export const loginAccountRateLimiter = rateLimit({
  windowMs: ONE_HOUR_MS,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return `login-account:${email}`;
  },
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts for this account. Please try again later.' } },
});

export const registerRateLimiter = createLimiter(ONE_HOUR_MS, 5, 'Too many accounts created from this address. Please try again later.', false);

export const passwordRateLimiter = createLimiter(FIFTEEN_MINUTES_MS, 10, 'Too many password attempts. Please try again in a few minutes.');

export const discountCodeRateLimiter = createLimiter(FIFTEEN_MINUTES_MS, 20, 'Too many promo code attempts. Please try again in a few minutes.');

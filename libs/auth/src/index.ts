import type { Request, Response, NextFunction } from 'express';
import './types/express';
import { AuthProvider, AuthTokenPayload, SessionValidator } from './contracts/auth-provider.contract';
import { activeProvider as defaultProvider } from './providers/active-provider';

let activeProvider: AuthProvider = defaultProvider;
let sessionValidator: SessionValidator | null = null;

export const setAuthProvider = (provider: AuthProvider): void => {
  activeProvider = provider;
};

export const getAuthProvider = (): AuthProvider => activeProvider;

// Wired once by the API host - this package stays free of any database dependency, so the
// "is this session still valid" lookup is injected rather than imported.
export const setSessionValidator = (validator: SessionValidator): void => {
  sessionValidator = validator;
};

export const hashPassword = (plain: string): Promise<string> => activeProvider.hashPassword(plain);

export const comparePassword = (plain: string, hash: string): Promise<boolean> =>
  activeProvider.comparePassword(plain, hash);

export const signAccessToken = (payload: AuthTokenPayload): string =>
  activeProvider.signAccessToken(payload);

export const verifyAccessToken = (token: string): AuthTokenPayload =>
  activeProvider.verifyAccessToken(token);

// Signature + expiry, then the injected session check. Null for any token that shouldn't be
// honored; never throws, so every caller (HTTP middleware, the WebSocket upgrade) treats a
// bad token the same way.
export const authenticateAccessToken = async (token: string): Promise<AuthTokenPayload | null> => {
  let payload: AuthTokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return null;
  }
  return sessionValidator ? sessionValidator(payload) : payload;
};

const bearerToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  try {
    const payload = await authenticateAccessToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    req.user = payload;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole =
  (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient role permissions' });
      return;
    }
    next();
  };

// Invalid, expired, or revoked token on an optional-auth route - the caller is treated as anonymous.
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const token = bearerToken(req);
  try {
    if (token) {
      const payload = await authenticateAccessToken(token);
      if (payload) req.user = payload;
    }
    next();
  } catch (error) {
    next(error);
  }
};

export type { AuthProvider, AuthTokenPayload, SessionValidator } from './contracts/auth-provider.contract';
export { jwtProvider } from './providers/jwt/jwt.provider';

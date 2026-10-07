export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: string;
  // The user's tokenVersion at signing time - bumping it on the user record revokes every token
  // signed before. Absent on tokens issued before revocation existed, which reads as 0.
  ver?: number;
}

// Re-checks a cryptographically valid token against current server state (account still exists,
// tokenVersion unchanged) and returns the payload refreshed from it, or null to reject the token.
export type SessionValidator = (payload: AuthTokenPayload) => Promise<AuthTokenPayload | null>;

export interface AuthProvider {
  name: string;
  hashPassword: (plain: string) => Promise<string>;
  comparePassword: (plain: string, hash: string) => Promise<boolean>;
  signAccessToken: (payload: AuthTokenPayload) => string;
  verifyAccessToken: (token: string) => AuthTokenPayload;
  assertConfigured?: () => void;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: string;
}

export interface AuthProvider {
  name: string;
  hashPassword: (plain: string) => Promise<string>;
  comparePassword: (plain: string, hash: string) => Promise<boolean>;
  signAccessToken: (payload: AuthTokenPayload) => string;
  verifyAccessToken: (token: string) => AuthTokenPayload;
  assertConfigured?: () => void;
}

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AuthProvider } from '../../contracts/auth-provider.contract';

const SALT_ROUNDS = 10;
const ALGORITHM = 'HS256';

const envSchema = z.object({
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters (e.g. `openssl rand -base64 48`)'),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+(ms|s|m|h|d|w|y)?$/, 'JWT_EXPIRES_IN must look like "3600", "1h", "7d", etc.')
    .default('1h'),
});

const tokenPayloadSchema = z.object({
  sub: z.string().min(1),
  email: z.string(),
  role: z.string(),
  ver: z.number().int().nonnegative().optional(),
});

const getEnv = () =>
  envSchema.parse({
    JWT_SECRET: process.env['JWT_SECRET'],
    JWT_EXPIRES_IN: process.env['JWT_EXPIRES_IN'],
  });

export const jwtProvider: AuthProvider = {
  name: 'JWT',
  hashPassword: async (plain) => bcrypt.hash(plain, SALT_ROUNDS),
  comparePassword: async (plain, hash) => bcrypt.compare(plain, hash),
  signAccessToken: (payload) => {
    const env = getEnv();
    return jwt.sign(payload, env.JWT_SECRET, {
      algorithm: ALGORITHM,
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  },
  verifyAccessToken: (token) => {
    const env = getEnv();
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITHM] });
    return tokenPayloadSchema.parse(decoded);
  },
  assertConfigured: () => {
    getEnv();
  },
};

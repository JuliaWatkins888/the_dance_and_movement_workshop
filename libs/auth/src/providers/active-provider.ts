import { AuthProvider } from '../contracts/auth-provider.contract';
import { jwtProvider } from './jwt/jwt.provider';

export const activeProvider: AuthProvider = jwtProvider;

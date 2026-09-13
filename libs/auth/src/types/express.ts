import { AuthTokenPayload } from '../contracts/auth-provider.contract';

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

import type { UserEntity } from '@inithium/db';
import { signAccessToken } from '@inithium/auth';

// `ver` ties the token to the account's current tokenVersion - see @inithium/permissions' resolveSession.
export const signTokenFor = (user: UserEntity): string =>
  signAccessToken({ sub: user.id, email: user.email, role: user.role, ver: user.tokenVersion });

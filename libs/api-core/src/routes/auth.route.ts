import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import type { UserEntity } from '@inithium/db';
import { getUserRepository } from '@inithium/db';
import { hashPassword, comparePassword, signAccessToken, requireAuth } from '@inithium/auth';
import { resolveEffectiveCapabilities } from '@inithium/permissions';
import { registerSchema, loginSchema } from '../schemas/auth.schema';

const router: RouterType = Router();

// Shared by register/login/me - the merge logic (role default bundle + overrides) stays
// single-sourced here rather than being re-derived on the client, the same "server resolves,
// client just reads" precedent getSetting's own default-fallback merge already follows.
const toAuthUser = (user: UserEntity) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  isOwner: user.isOwner,
  capabilities: resolveEffectiveCapabilities(user.role, user.capabilityOverrides),
  avatar: user.avatar,
  darkMode: user.darkMode,
});

router.post('/auth/register', async (req: Request, res: Response): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const { email, password, firstName, lastName } = parsed.data;
  const userRepository = getUserRepository();

  try {
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }

    const passwordHash = await hashPassword(password);
    let user = await userRepository.create({ email, firstName, lastName, passwordHash });

    // Zero-config "first user is owner" - self-limiting since a second registrant will always
    // see countAll() > 1. Covers a fresh workspace; ensureOwnerBootstrap (run at API startup)
    // covers a workspace upgrading into this refactor with pre-existing users.
    const totalUsers = await userRepository.countAll();
    if (totalUsers === 1) {
      user = await userRepository.transferOwnership(user.id);
    }

    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });

    res.status(201).json({
      user: toAuthUser(user),
      accessToken,
    });
  } catch (error) {
    console.error('❌ Registration failed:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/auth/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const user = await getUserRepository().findByEmail(email);
    if (!user || !(await comparePassword(password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
    res.status(200).json({
      user: toAuthUser(user),
      accessToken,
    });
  } catch (error) {
    console.error('❌ Login failed:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// The JWT payload only carries {sub, email, role} - it can't carry the rest of the profile
// without bloating every request's Authorization header, so "who am I" has to re-fetch the
// full record rather than just echoing req.user.
router.get('/auth/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  try {
    const user = await getUserRepository().findById(req.user.sub);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.status(200).json({
      user: toAuthUser(user),
    });
  } catch (error) {
    console.error('❌ Fetching current user failed:', error);
    res.status(500).json({ error: 'Failed to fetch current user' });
  }
});

export default router;

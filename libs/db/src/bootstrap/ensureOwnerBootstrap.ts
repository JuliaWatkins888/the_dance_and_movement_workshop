import { countAllUsers, getUserRepository, listUsers, transferOwnership } from '../index';

// OWNER_BOOTSTRAP_EMAIL names the one account allowed to claim ownership automatically. Without
// it, "first user to register becomes owner" would hand the whole site to whoever reaches the
// signup page first on a fresh deployment.
export const ownerBootstrapEmail = (): string | undefined => {
  const value = process.env['OWNER_BOOTSTRAP_EMAIL']?.trim().toLowerCase();
  return value ? value : undefined;
};

export const isOwnerBootstrapEmail = (email: string): boolean => {
  const configured = ownerBootstrapEmail();
  return configured !== undefined && configured === email.trim().toLowerCase();
};

// Called once at API startup (apps/api/src/main.ts, right after ensureSeededPages) - same
// idempotent, run-on-every-boot precedent. Ensures at most one user carries isOwner: true:
// - Already exactly one -> no-op (the common case).
// - None -> promote the OWNER_BOOTSTRAP_EMAIL account if it exists, else the earliest-created
//   'admin'-role user. Never an ordinary self-registered account.
// - More than one (shouldn't happen given transferOwnership's atomicity, but defensive against
//   hand-edited data) -> keep the earliest, demote the rest.
export const ensureOwnerBootstrap = async (): Promise<void> => {
  const total = await countAllUsers();
  if (total === 0) return;

  const { items: allUsers } = await listUsers({ page: 1, pageSize: total });
  const owners = allUsers.filter((user) => user.isOwner);

  if (owners.length === 1) return;

  if (owners.length > 1) {
    const [earliest] = [...owners].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    console.warn(
      `ensureOwnerBootstrap: found ${owners.length} owners, keeping earliest-created (${earliest.email}) and demoting the rest`
    );
    await transferOwnership(earliest.id);
    return;
  }

  const configuredEmail = ownerBootstrapEmail();
  const configuredUser = configuredEmail ? await getUserRepository().findByEmail(configuredEmail) : null;
  const sortedByCreatedAt = [...allUsers].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const newOwner = configuredUser ?? sortedByCreatedAt.find((user) => user.role === 'admin');
  if (!newOwner) {
    console.warn('ensureOwnerBootstrap: no owner exists - set OWNER_BOOTSTRAP_EMAIL to an existing account and restart');
    return;
  }
  await transferOwnership(newOwner.id);
  console.log(`ensureOwnerBootstrap: promoted ${newOwner.email} to owner`);
};

import { countAllUsers, listUsers, transferOwnership } from '../index';

// Called once at API startup (apps/api/src/main.ts, right after ensureSeededPages) - same
// idempotent, run-on-every-boot precedent. Ensures exactly one user carries isOwner: true:
// - Already exactly one -> no-op (the common case after the very first boot, since
//   /auth/register already promotes the very first user ever to register).
// - None (a workspace upgrading into this refactor with pre-existing users, or a fresh DB seeded
//   outside /auth/register) -> promote the earliest-created 'admin'-role user if one exists,
//   else the earliest-created user overall.
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

  const sortedByCreatedAt = [...allUsers].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const newOwner = sortedByCreatedAt.find((user) => user.role === 'admin') ?? sortedByCreatedAt[0];
  await transferOwnership(newOwner.id);
  console.log(`ensureOwnerBootstrap: promoted ${newOwner.email} to owner`);
};

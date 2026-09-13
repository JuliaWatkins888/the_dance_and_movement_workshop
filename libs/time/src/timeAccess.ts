import type { AuthUser } from '@inithium/api-client';

const EMPLOYEE_ROLES = ['contributor', 'editor', 'admin'];

// Mirrors the backend's identical rule (this plugin's api-core/routes/time/timeAccess.ts) -
// duplicated only because this is a different runtime with its own AuthUser shape; the backend
// route layer remains the actual enforcement point regardless of what this returns. Used purely
// to decide what to render (e.g. TimeRoot's gate), never as a security boundary on its own.
export const isEmployee = (user: AuthUser): boolean => user.isOwner || EMPLOYEE_ROLES.includes(user.role);

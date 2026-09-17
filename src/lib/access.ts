import type { UserRole } from '@/types/database';

const supervisorPaths = [
  '/dashboard',
  '/parking/layout',
  '/bob/requests',
  '/history/audit-log',
  '/reports',
];

const bobPaths = ['/dashboard', '/bob/requests', '/bob/completed'];

export function isPathAllowed(role: UserRole, pathname: string) {
  if (role === 'ADMINISTRATOR') return true;

  const allowedPaths = role === 'SUPERVISOR' ? supervisorPaths : bobPaths;
  return allowedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function getDefaultPath(role: UserRole) {
  return role === 'BOB' ? '/bob/requests' : '/dashboard';
}

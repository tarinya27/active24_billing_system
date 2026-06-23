import { useAuth } from '../context/AuthContext';

// Returns helpers to check the current user's RBAC permissions.
export function usePermission() {
  const { permissions } = useAuth();

  const can = (permission) => permissions.includes(permission);
  const canAny = (...perms) => perms.flat().some((p) => permissions.includes(p));
  const canAll = (...perms) => perms.flat().every((p) => permissions.includes(p));

  return { can, canAny, canAll, permissions };
}

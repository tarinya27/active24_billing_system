import { usePermission } from '../../hooks/usePermission';

// Conditionally renders children based on RBAC permissions.
// Usage: <Can permission="products.create">...</Can>
//        <Can anyOf={['reports.sales','reports.stock']}>...</Can>
export default function Can({ permission, anyOf, allOf, fallback = null, children }) {
  const { can, canAny, canAll } = usePermission();

  let allowed = true;
  if (permission) allowed = can(permission);
  else if (anyOf) allowed = canAny(anyOf);
  else if (allOf) allowed = canAll(allOf);

  return allowed ? children : fallback;
}

export function getHomePath(permissions = []) {
  if (permissions.includes('dashboard.view')) return '/';
  if (permissions.includes('sof.view')) return '/technical/sof';
  if (permissions.includes('estimates.view')) return '/technical/estimates';
  if (permissions.includes('customers.view')) return '/customers';
  return '/login';
}

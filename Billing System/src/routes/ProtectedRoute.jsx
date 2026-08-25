import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermission } from '../hooks/usePermission';

function FullScreenLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        <p className="text-sm text-slate-500">Loading Active24...</p>
      </div>
    </div>
  );
}

// Guards nested routes. Optionally requires a specific permission to enter.
export default function ProtectedRoute({ requiredPermission, anyOf }) {
  const { isAuthenticated, loading } = useAuth();
  const { can, canAny } = usePermission();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredPermission && !can(requiredPermission)) {
    return <Navigate to="/" replace />;
  }

  if (anyOf && !canAny(anyOf)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

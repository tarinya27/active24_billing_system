import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../components/layouts/MainLayout';
import ProtectedRoute from './ProtectedRoute';
import Login from '../pages/auth/Login';
import Dashboard from '../pages/Dashboard';
import ProductList from '../pages/products/ProductList';
import CategoryList from '../pages/categories/CategoryList';
import CustomerList from '../pages/customers/CustomerList';
import UserList from '../pages/users/UserList';
import PurchaseOrderList from '../pages/purchaseOrders/PurchaseOrderList';
import PurchaseOrderDetail from '../pages/purchaseOrders/PurchaseOrderDetail';
import GRNList from '../pages/grn/GRNList';
import GRNForm from '../pages/grn/GRNForm';
import GRNDetail from '../pages/grn/GRNDetail';
import StockManagement from '../pages/stock/StockManagement';
import Billing from '../pages/billing/Billing';
import Reports from '../pages/reports/Reports';
import Settings from '../pages/settings/Settings';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route index element={<Dashboard />} />

          <Route element={<ProtectedRoute requiredPermission="products.view" />}>
            <Route path="products" element={<ProductList />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="categories.manage" />}>
            <Route path="categories" element={<CategoryList />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="customers.view" />}>
            <Route path="customers" element={<CustomerList />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="users.view_all" />}>
            <Route path="users" element={<UserList />} />
          </Route>

          <Route element={<ProtectedRoute requiredPermission="purchase_orders.view" />}>
            <Route path="purchase-orders" element={<PurchaseOrderList />} />
            <Route path="purchase-orders/:id" element={<PurchaseOrderDetail />} />
          </Route>

          <Route element={<ProtectedRoute requiredPermission="grn.view" />}>
            <Route path="grn" element={<GRNList />} />
            <Route path="grn/:id" element={<GRNDetail />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="grn.create" />}>
            <Route path="grn/new" element={<GRNForm />} />
          </Route>
          <Route path="stock" element={<StockManagement />} />
          <Route path="billing" element={<Billing />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

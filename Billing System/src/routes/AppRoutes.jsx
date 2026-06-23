import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../components/layouts/MainLayout';
import ProtectedRoute from './ProtectedRoute';
import Login from '../pages/auth/Login';
import Dashboard from '../pages/Dashboard';
import PurchaseOrderList from '../pages/purchaseOrders/PurchaseOrderList';
import PurchaseOrderForm from '../pages/purchaseOrders/PurchaseOrderForm';
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
          <Route path="purchase-orders" element={<PurchaseOrderList />} />
          <Route path="purchase-orders/new" element={<PurchaseOrderForm />} />
          <Route path="purchase-orders/edit/:id" element={<PurchaseOrderForm />} />
          <Route path="purchase-orders/:id" element={<PurchaseOrderDetail />} />
          <Route path="grn" element={<GRNList />} />
          <Route path="grn/new" element={<GRNForm />} />
          <Route path="grn/:id" element={<GRNDetail />} />
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

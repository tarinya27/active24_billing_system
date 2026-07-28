import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../components/layouts/MainLayout';
import ProtectedRoute from './ProtectedRoute';
import Login from '../pages/auth/Login';
import Dashboard from '../pages/Dashboard';
import ProductList from '../pages/products/ProductList';
import ProductDetail from '../pages/products/ProductDetail';
import CategoryList from '../pages/categories/CategoryList';
import CustomerList from '../pages/customers/CustomerList';
import UserList from '../pages/users/UserList';
import PurchaseOrderLayout from '../components/layouts/PurchaseOrderLayout';
import PurchaseOrderList from '../pages/purchaseOrders/PurchaseOrderList';
import PurchaseOrderDetail from '../pages/purchaseOrders/PurchaseOrderDetail';
import PurchaseOrderForm from '../pages/purchaseOrders/PurchaseOrderForm';
import PurchaseOrderPrintPage from '../pages/purchaseOrders/PurchaseOrderPrintPage';
import PurchaseOrderMigration from '../pages/purchaseOrders/PurchaseOrderMigration';
import SupplierList from '../pages/suppliers/SupplierList';
import PurchaseInvoiceList from '../pages/purchaseInvoices/PurchaseInvoiceList';
import PurchaseInvoiceForm from '../pages/purchaseInvoices/PurchaseInvoiceForm';
import PurchaseInvoiceDetail from '../pages/purchaseInvoices/PurchaseInvoiceDetail';
import GRNList from '../pages/grn/GRNList';
import GRNForm from '../pages/grn/GRNForm';
import GRNDetail from '../pages/grn/GRNDetail';
import DeliveryNoteList from '../pages/deliveryNotes/DeliveryNoteList';
import DeliveryNoteForm from '../pages/deliveryNotes/DeliveryNoteForm';
import DeliveryNoteDetail from '../pages/deliveryNotes/DeliveryNoteDetail';
import StockManagement from '../pages/stock/StockManagement';
import Billing from '../pages/billing/Billing';
import Reports from '../pages/reports/Reports';
import Settings from '../pages/settings/Settings';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<ProtectedRoute requiredPermission="purchase_orders.print" />}>
          <Route path="purchase-orders/:id/print" element={<PurchaseOrderPrintPage />} />
        </Route>
        <Route element={<MainLayout />}>
          <Route index element={<Dashboard />} />

          <Route element={<ProtectedRoute requiredPermission="products.view" />}>
            <Route path="products" element={<ProductList />} />
            <Route path="products/:id" element={<ProductDetail />} />
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
            <Route path="purchase-orders" element={<PurchaseOrderLayout />}>
              <Route index element={<PurchaseOrderList />} />
              <Route path="migration" element={<ProtectedRoute requiredPermission="purchase_orders.sync" />}>
                <Route index element={<PurchaseOrderMigration />} />
              </Route>
              <Route path="new" element={<ProtectedRoute requiredPermission="purchase_orders.create" />}>
                <Route index element={<PurchaseOrderForm />} />
              </Route>
              <Route path=":id/edit" element={<ProtectedRoute requiredPermission="purchase_orders.edit" />}>
                <Route index element={<PurchaseOrderForm />} />
              </Route>
              <Route path=":id" element={<PurchaseOrderDetail />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute requiredPermission="suppliers.view" />}>
            <Route path="suppliers" element={<SupplierList />} />
          </Route>

          <Route element={<ProtectedRoute requiredPermission="purchase_invoices.view" />}>
            <Route path="purchase-invoices" element={<PurchaseInvoiceList />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="purchase_invoices.create" />}>
            <Route path="purchase-invoices/new" element={<PurchaseInvoiceForm />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="purchase_invoices.view" />}>
            <Route path="purchase-invoices/:id/edit" element={<PurchaseInvoiceForm />} />
            <Route path="purchase-invoices/:id" element={<PurchaseInvoiceDetail />} />
          </Route>

          <Route element={<ProtectedRoute requiredPermission="grn.view" />}>
            <Route path="grn" element={<GRNList />} />
            <Route path="grn/:id" element={<GRNDetail />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="grn.create" />}>
            <Route path="grn/new" element={<GRNForm />} />
          </Route>

          <Route element={<ProtectedRoute requiredPermission="delivery_notes.view" />}>
            <Route path="delivery-notes" element={<DeliveryNoteList />} />
            <Route path="delivery-notes/:id" element={<DeliveryNoteDetail />} />
          </Route>
          <Route element={<ProtectedRoute requiredPermission="delivery_notes.create" />}>
            <Route path="delivery-notes/new" element={<DeliveryNoteForm />} />
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

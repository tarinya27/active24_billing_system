import { createContext, useContext, useMemo, useState } from 'react';
import {
  mockProducts,
  mockCustomers,
  mockSuppliers,
  mockPurchaseOrders,
  mockGRNs,
  mockInvoices,
  mockStockTransfers,
  mockActivities,
} from '../data';
import { generateGRNNumber, generateInvoiceNumber, generatePONumber } from '../utils/helpers';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [products, setProducts] = useState(mockProducts);
  const [purchaseOrders, setPurchaseOrders] = useState(mockPurchaseOrders);
  const [grns, setGrns] = useState(mockGRNs);
  const [invoices, setInvoices] = useState(mockInvoices);
  const [stockTransfers, setStockTransfers] = useState(mockStockTransfers);
  const [activities, setActivities] = useState(mockActivities);
  const [customers, setCustomers] = useState(mockCustomers);
  const [settings, setSettings] = useState({
    companyName: 'Active24 (Pvt) Ltd',
    companyAddress: 'No. 128, Duplication Road, Colombo 04, Sri Lanka',
    companyPhone: '+94 11 456 7890',
    companyEmail: 'info@active24.lk',
    invoicePrefix: 'INV-2026-',
    defaultPaymentMethod: 'Cash',
    vatRate: 0,
    vatEnabled: true,
    currency: 'LKR',
    lowStockThreshold: 10,
    notificationsEnabled: true,
    autoPrint: false,
  });

  const addActivity = (activity) => {
    setActivities((prev) => [{ id: `ACT-${Date.now()}`, ...activity, timestamp: new Date().toISOString() }, ...prev]);
  };

  const addPurchaseOrder = (po) => {
    const newPO = {
      ...po,
      id: `PO-${Date.now()}`,
      poNumber: generatePONumber(purchaseOrders.length),
    };
    setPurchaseOrders((prev) => [newPO, ...prev]);
    addActivity({ type: 'po', title: 'Purchase Order Created', description: `New ${newPO.poNumber} created`, amount: newPO.totalAmount, user: 'Sanduni Fernando' });
    return newPO;
  };

  const updatePurchaseOrder = (id, updates) => {
    setPurchaseOrders((prev) => prev.map((po) => (po.id === id ? { ...po, ...updates } : po)));
  };

  const addGRN = (grn) => {
    const newGRN = {
      ...grn,
      id: `GRN-${Date.now()}`,
      grnNumber: generateGRNNumber(grns.length),
      status: 'Completed',
    };
    setGrns((prev) => [newGRN, ...prev]);

    newGRN.items.forEach((item) => {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === item.productId ? { ...p, quantity: p.quantity + item.quantityReceived } : p
        )
      );
      const product = products.find((p) => p.id === item.productId);
      setStockTransfers((prev) => [
        {
          id: `ST-${Date.now()}-${item.productId}`,
          date: new Date().toISOString(),
          productId: item.productId,
          productName: product?.name || 'Unknown',
          type: 'GRN In',
          quantity: item.quantityReceived,
          from: product?.source || 'Supplier',
          to: 'Active24 Warehouse',
          reference: newGRN.grnNumber,
          user: grn.receivedBy,
        },
        ...prev,
      ]);
    });

    addActivity({ type: 'grn', title: 'GRN Completed', description: `${newGRN.grnNumber} completed successfully`, amount: null, user: grn.receivedBy });
    return newGRN;
  };

  const addCustomer = (customerData) => {
    const nextNum = customers.reduce((max, c) => {
      const num = parseInt(c.id.replace('CUS-', ''), 10);
      return Number.isNaN(num) ? max : Math.max(max, num);
    }, 0) + 1;

    const newCustomer = {
      id: `CUS-${String(nextNum).padStart(3, '0')}`,
      name: customerData.name,
      mobile: customerData.mobile,
      address: customerData.address || '—',
      email: customerData.email || '—',
      type: customerData.type || 'Walk-in',
    };

    setCustomers((prev) => [...prev, newCustomer]);
    addActivity({
      type: 'invoice',
      title: 'Customer Registered',
      description: `${newCustomer.name} added to customer base`,
      amount: null,
      user: 'Sanduni Fernando',
    });
    return newCustomer;
  };

  const addInvoice = (invoice) => {
    const newInvoice = {
      ...invoice,
      id: `INV-${Date.now()}`,
      invoiceNumber: generateInvoiceNumber(invoices.length),
      date: new Date().toISOString(),
      status: 'Completed',
      creditStatus: invoice.paymentMethod === 'Credit' ? 'Outstanding' : undefined,
    };
    setInvoices((prev) => [newInvoice, ...prev]);

    invoice.items.forEach((item) => {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === item.productId ? { ...p, quantity: Math.max(0, p.quantity - item.quantity) } : p
        )
      );
      const product = products.find((p) => p.id === item.productId);
      setStockTransfers((prev) => [
        {
          id: `ST-${Date.now()}-${item.productId}`,
          date: new Date().toISOString(),
          productId: item.productId,
          productName: product?.name || 'Unknown',
          type: 'Sale Out',
          quantity: -item.quantity,
          from: 'Active24 Warehouse',
          to: 'Customer',
          reference: newInvoice.invoiceNumber,
          user: invoice.cashier,
        },
        ...prev,
      ]);
    });

    addActivity({ type: 'invoice', title: 'Invoice Generated', description: `Invoice ${newInvoice.invoiceNumber} created`, amount: newInvoice.grandTotal, user: invoice.cashier });
    return newInvoice;
  };

  const dashboardStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayInvoices = invoices.filter((inv) => inv.date.startsWith(today));
    const todaySales = todayInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const totalRevenue = invoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const availableStock = products.reduce((sum, p) => sum + p.quantity, 0);
    const pendingPOs = purchaseOrders.filter((po) => po.status === 'Pending').length;
    const todayGRNs = grns.filter((g) => g.date === today).length;
    const lowStockItems = products.filter((p) => p.quantity <= p.reorderLevel).length;

    return { todaySales, totalRevenue, availableStock, pendingPOs, todayGRNs, lowStockItems };
  }, [invoices, products, purchaseOrders, grns]);

  const value = {
    products,
    setProducts,
    customers,
    suppliers: mockSuppliers,
    purchaseOrders,
    grns,
    invoices,
    stockTransfers,
    activities,
    settings,
    setSettings,
    dashboardStats,
    addPurchaseOrder,
    updatePurchaseOrder,
    addGRN,
    addInvoice,
    addCustomer,
    addActivity,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}

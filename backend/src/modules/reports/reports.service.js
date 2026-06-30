import { prisma } from '../../config/prisma.js';
import { CREDIT_TERM_DAYS } from '../../utils/enums.js';
import { PAYMENT_METHOD_LABEL } from '../../utils/enums.js';

function csvEscape(val) {
  const s = val == null ? '' : String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows, columns) {
  const header = columns.map((c) => csvEscape(c.header)).join(',');
  const lines = rows.map((row) => columns.map((c) => csvEscape(c.value(row))).join(','));
  return [header, ...lines].join('\n');
}

export async function salesReport(period = 'daily') {
  const invoices = await prisma.invoice.findMany({
    where: { status: 'COMPLETED' },
    select: { createdAt: true, grandTotal: true },
    orderBy: { createdAt: 'asc' },
  });

  const buckets = new Map();

  for (const inv of invoices) {
    const d = inv.createdAt;
    let key;
    let label;
    if (period === 'weekly') {
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      key = weekStart.toISOString().slice(0, 10);
      label = `Week of ${key}`;
    } else if (period === 'monthly') {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      label = d.toLocaleString('en', { month: 'short', year: 'numeric' });
    } else {
      key = d.toISOString().slice(0, 10);
      label = key;
    }

    if (!buckets.has(key)) buckets.set(key, { key, label, sales: 0, count: 0 });
    const b = buckets.get(key);
    b.sales += Number(inv.grandTotal);
    b.count += 1;
  }

  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export async function stockReport() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      category: { select: { name: true } },
      _count: { select: { units: { where: { status: 'IN_STOCK' } } } },
    },
    orderBy: { name: 'asc' },
  });

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const threshold = settings?.lowStockThreshold ?? 10;

  return products.map((p) => {
    const qty = p._count.units;
    let status = 'In Stock';
    if (qty <= 0) status = 'Out of Stock';
    else if (qty <= (p.reorderLevel || threshold)) status = 'Low Stock';
    return {
      code: p.code,
      name: p.name,
      category: p.category?.name || '—',
      company: p.company,
      quantity: qty,
      reorderLevel: p.reorderLevel,
      status,
    };
  });
}

export async function purchaseReport() {
  const invoices = await prisma.purchaseInvoice.findMany({
    include: {
      supplier: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return invoices.map((pi) => ({
    id: pi.id,
    supplierInvoiceNo: pi.supplierInvoiceNo,
    supplier: pi.supplier.name,
    date: pi.invoiceDate,
    total: Number(pi.total),
    status: pi.status,
    itemCount: pi._count.items,
  }));
}

export async function grnReport() {
  const grns = await prisma.grn.findMany({
    include: {
      supplier: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return grns.map((g) => ({
    grnNumber: g.grnNumber,
    supplier: g.supplier.name,
    date: g.receivedAt,
    status: g.status,
    itemCount: g._count.items,
  }));
}

export async function debtorsReport() {
  const invoices = await prisma.invoice.findMany({
    where: { paymentMethod: 'CREDIT', status: 'COMPLETED' },
    include: { customer: { select: { name: true, mobile: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return invoices.map((inv) => {
    const dueDate = inv.dueDate || new Date(inv.createdAt.getTime() + CREDIT_TERM_DAYS * 86400000);
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customer.name,
      customerMobile: inv.customer.mobile || '—',
      date: inv.createdAt,
      dueDate,
      amount: Number(inv.grandTotal),
      creditStatus: inv.creditStatus === 'PAID' ? 'Paid' : 'Outstanding',
      paymentTerms: `${CREDIT_TERM_DAYS} days`,
    };
  });
}

export async function exportCsv(type, period) {
  switch (type) {
    case 'sales': {
      const rows = await salesReport(period);
      return {
        filename: `sales-${period}.csv`,
        content: toCsv(rows, [
          { header: 'Period', value: (r) => r.label },
          { header: 'Invoices', value: (r) => r.count },
          { header: 'Sales (LKR)', value: (r) => r.sales.toFixed(2) },
        ]),
      };
    }
    case 'stock': {
      const rows = await stockReport();
      return {
        filename: 'stock-report.csv',
        content: toCsv(rows, [
          { header: 'Code', value: (r) => r.code },
          { header: 'Product', value: (r) => r.name },
          { header: 'Category', value: (r) => r.category },
          { header: 'Company', value: (r) => r.company },
          { header: 'Qty', value: (r) => r.quantity },
          { header: 'Status', value: (r) => r.status },
        ]),
      };
    }
    case 'purchase': {
      const rows = await purchaseReport();
      return {
        filename: 'purchase-report.csv',
        content: toCsv(rows, [
          { header: 'Supplier Invoice', value: (r) => r.supplierInvoiceNo },
          { header: 'Supplier', value: (r) => r.supplier },
          { header: 'Date', value: (r) => new Date(r.date).toISOString().slice(0, 10) },
          { header: 'Total', value: (r) => r.total.toFixed(2) },
          { header: 'Status', value: (r) => r.status },
        ]),
      };
    }
    case 'grn': {
      const rows = await grnReport();
      return {
        filename: 'grn-report.csv',
        content: toCsv(rows, [
          { header: 'GRN', value: (r) => r.grnNumber },
          { header: 'Supplier', value: (r) => r.supplier },
          { header: 'Date', value: (r) => new Date(r.date).toISOString().slice(0, 10) },
          { header: 'Status', value: (r) => r.status },
          { header: 'Items', value: (r) => r.itemCount },
        ]),
      };
    }
    case 'debtors': {
      const rows = await debtorsReport();
      return {
        filename: 'credit-debtors.csv',
        content: toCsv(rows, [
          { header: 'Invoice', value: (r) => r.invoiceNumber },
          { header: 'Customer', value: (r) => r.customerName },
          { header: 'Mobile', value: (r) => r.customerMobile },
          { header: 'Due Date', value: (r) => new Date(r.dueDate).toISOString().slice(0, 10) },
          { header: 'Amount', value: (r) => r.amount.toFixed(2) },
          { header: 'Status', value: (r) => r.creditStatus },
        ]),
      };
    }
    default:
      return null;
  }
}

export { PAYMENT_METHOD_LABEL };

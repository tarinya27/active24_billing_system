import { prisma } from '../../config/prisma.js';

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export async function getDashboardStats() {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const threshold = settings?.lowStockThreshold ?? 10;

  const [
    todaySalesAgg,
    totalRevenueAgg,
    availableStock,
    pendingPOs,
    todayGRNs,
    stockByProduct,
    activities,
    monthlySales,
    topProducts,
    stockSource,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      where: { status: 'COMPLETED', createdAt: { gte: todayStart, lte: todayEnd } },
      _sum: { grandTotal: true },
    }),
    prisma.invoice.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { grandTotal: true },
    }),
    prisma.productUnit.count({ where: { status: 'IN_STOCK' } }),
    prisma.purchaseOrder.count({ where: { status: { in: ['PENDING', 'APPROVED'] } } }),
    prisma.grn.count({ where: { status: 'COMPLETED', createdAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.productUnit.groupBy({
      by: ['productId'],
      where: { status: 'IN_STOCK' },
      _count: { _all: true },
    }),
    prisma.activity.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: { select: { name: true } } },
    }),
    getMonthlySales(),
    getTopProducts(),
    getStockSourceDistribution(),
  ]);

  const productIds = stockByProduct.map((s) => s.productId);
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, reorderLevel: true },
      })
    : [];
  const reorderMap = Object.fromEntries(products.map((p) => [p.id, p.reorderLevel]));

  const lowStockItems = stockByProduct.filter((s) => {
    const qty = s._count._all;
    const reorder = reorderMap[s.productId] ?? threshold;
    return qty > 0 && qty <= reorder;
  }).length;

  const outOfStock = await prisma.product.count({
    where: {
      isActive: true,
      units: { none: { status: 'IN_STOCK' } },
    },
  });

  return {
    todaySales: Number(todaySalesAgg._sum.grandTotal || 0),
    totalRevenue: Number(totalRevenueAgg._sum.grandTotal || 0),
    availableStock,
    pendingPOs,
    todayGRNs,
    lowStockItems: lowStockItems + outOfStock,
    monthlySales,
    topProducts,
    stockSourceDistribution: stockSource,
    activities: activities.map((a) => ({
      ...a,
      amount: a.amount != null ? Number(a.amount) : null,
    })),
  };
}

async function getMonthlySales() {
  const year = new Date().getFullYear();
  const start = new Date(year, 0, 1);
  const invoices = await prisma.invoice.findMany({
    where: { status: 'COMPLETED', createdAt: { gte: start } },
    select: { createdAt: true, grandTotal: true },
  });

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const buckets = months.map((month, i) => ({ month, sales: 0, monthIndex: i }));

  for (const inv of invoices) {
    const m = inv.createdAt.getMonth();
    buckets[m].sales += Number(inv.grandTotal);
  }

  return buckets.map(({ month, sales }) => ({ month, sales }));
}

async function getTopProducts() {
  const items = await prisma.invoiceItem.groupBy({
    by: ['productId'],
    _count: { _all: true },
    orderBy: { _count: { productId: 'desc' } },
    take: 5,
  });

  if (!items.length) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
    select: { id: true, name: true },
  });
  const nameMap = Object.fromEntries(products.map((p) => [p.id, p.name]));

  return items.map((i) => ({
    name: nameMap[i.productId] || 'Unknown',
    sales: i._count._all,
  }));
}

async function getStockSourceDistribution() {
  const units = await prisma.productUnit.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  const labels = {
    IN_STOCK: 'In Stock',
    SOLD: 'Sold',
    RETURNED: 'Returned',
    VOID: 'Void',
  };

  return units.map((u) => ({
    name: labels[u.status] || u.status,
    value: u._count._all,
  }));
}

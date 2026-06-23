export const mockActivities = [
  { id: 'ACT-001', type: 'invoice', title: 'Invoice Generated', description: 'Invoice INV-2026-0030 created for Colombo City Computers', amount: 45200, timestamp: '2026-06-09T15:45:00', user: 'Sanduni Fernando' },
  { id: 'ACT-002', type: 'grn', title: 'GRN Completed', description: 'GRN-2026-0020 received gaming peripherals from Genius', amount: null, timestamp: '2026-06-09T14:30:00', user: 'Kamal Perera' },
  { id: 'ACT-003', type: 'stock', title: 'Stock Transferred', description: '25 units of Genius Wireless Mouse added to inventory', amount: null, timestamp: '2026-06-09T11:30:00', user: 'Kamal Perera' },
  { id: 'ACT-004', type: 'po', title: 'Purchase Order Approved', description: 'PO-2026-0017 approved for RAM modules restock', amount: 165000, timestamp: '2026-06-09T10:15:00', user: 'Nimal Silva' },
  { id: 'ACT-005', type: 'invoice', title: 'Invoice Generated', description: 'Invoice INV-2026-0029 for Walk-in Customer — LKR 12,800', amount: 12800, timestamp: '2026-06-09T09:20:00', user: 'Kamal Perera' },
  { id: 'ACT-006', type: 'grn', title: 'GRN Completed', description: 'GRN-2026-0019 — 3 Dell monitors received', amount: null, timestamp: '2026-06-09T08:45:00', user: 'Nimal Silva' },
  { id: 'ACT-007', type: 'po', title: 'Purchase Order Created', description: 'New PO-2026-0020 for whiteboard markers', amount: 22500, timestamp: '2026-06-09T08:00:00', user: 'Sanduni Fernando' },
  { id: 'ACT-008', type: 'stock', title: 'Low Stock Alert', description: 'Genius Ergonomic Mouse (PRD-043) — only 3 units remaining', amount: null, timestamp: '2026-06-08T17:00:00', user: 'System' },
  { id: 'ACT-009', type: 'invoice', title: 'Invoice Generated', description: 'Invoice INV-2026-0028 for Kandy Tech Solutions', amount: 89500, timestamp: '2026-06-08T16:30:00', user: 'Nimal Silva' },
  { id: 'ACT-010', type: 'grn', title: 'GRN Completed', description: 'GRN-2026-0014 office stationery received', amount: null, timestamp: '2026-06-08T14:00:00', user: 'Sanduni Fernando' },
];

export const mockMonthlySales = [
  { month: 'Jan', sales: 1250000, orders: 145 },
  { month: 'Feb', sales: 980000, orders: 118 },
  { month: 'Mar', sales: 1420000, orders: 162 },
  { month: 'Apr', sales: 1180000, orders: 138 },
  { month: 'May', sales: 1650000, orders: 189 },
  { month: 'Jun', sales: 890000, orders: 98 },
];

export const mockTopProducts = [
  { name: 'Genius Wireless Mouse', sales: 245, revenue: 318500 },
  { name: 'A4 Copy Paper', sales: 180, revenue: 225000 },
  { name: 'SanDisk 64GB USB', sales: 156, revenue: 436800 },
  { name: 'HDMI Cable 2m', sales: 134, revenue: 147400 },
  { name: 'USB Type-C Cable', sales: 128, revenue: 108800 },
];

export const mockStockSourceDistribution = [
  { name: 'Genius', value: 35, count: 18 },
  { name: 'Active24', value: 65, count: 32 },
];

export const mockDailySales = [
  { date: 'Jun 3', sales: 125000 },
  { date: 'Jun 4', sales: 98000 },
  { date: 'Jun 5', sales: 156000 },
  { date: 'Jun 6', sales: 142000 },
  { date: 'Jun 7', sales: 89000 },
  { date: 'Jun 8', sales: 178000 },
  { date: 'Jun 9', sales: 101000 },
];

export const mockWeeklySales = [
  { week: 'Week 1', sales: 520000 },
  { week: 'Week 2', sales: 680000 },
  { week: 'Week 3', sales: 745000 },
  { week: 'Week 4', sales: 890000 },
];

export const mockLowStockReport = [
  { code: 'ACC-MSE-003', name: 'Genius Ergonomic Mouse', quantity: 3, reorderLevel: 5 },
  { code: 'STR-MEM-002', name: 'Kingston 16GB DDR4 RAM', quantity: 4, reorderLevel: 3 },
  { code: 'ACC-CLN-001', name: 'Screen Cleaning Kit', quantity: 2, reorderLevel: 10 },
  { code: 'CAB-PWR-001', name: 'Laptop Power Adapter Universal', quantity: 1, reorderLevel: 5 },
  { code: 'OFF-WHT-001', name: 'Whiteboard Marker Set', quantity: 0, reorderLevel: 10 },
];

export const mockPurchaseReport = [
  { month: 'Jan', orders: 12, amount: 850000 },
  { month: 'Feb', orders: 8, amount: 620000 },
  { month: 'Mar', orders: 15, amount: 1120000 },
  { month: 'Apr', orders: 10, amount: 780000 },
  { month: 'May', orders: 18, amount: 1450000 },
  { month: 'Jun', orders: 14, amount: 980000 },
];

export const mockGRNReport = [
  { month: 'Jan', grns: 8, items: 245 },
  { month: 'Feb', grns: 6, items: 180 },
  { month: 'Mar', grns: 12, items: 320 },
  { month: 'Apr', grns: 9, items: 210 },
  { month: 'May', grns: 14, items: 385 },
  { month: 'Jun', grns: 11, items: 290 },
];

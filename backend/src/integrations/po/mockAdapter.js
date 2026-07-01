/** @typedef {import('./types.js').ExternalPurchaseOrder} ExternalPurchaseOrder */

const MOCK_ORDERS = [
  {
    externalRef: 'mock-po-10001',
    poNumber: '10001',
    company: 'ACTIVE24',
    supplierName: 'Ugreen Tech Brands (Pvt) Ltd',
    orderDate: '2026-06-23',
    expectedDelivery: '2026-07-05',
    status: 'APPROVED',
    notes: 'Imported sample PO (mock)',
    items: [
      { description: 'UGREEN USB-C Hub 7-in-1', quantity: 10, costPrice: 257 },
    ],
  },
  {
    externalRef: 'mock-po-10002',
    poNumber: '10002',
    company: 'ACTIVE24',
    supplierName: 'Laptop4u (Pvt) Ltd',
    orderDate: '2026-06-30',
    expectedDelivery: '2026-07-15',
    status: 'APPROVED',
    notes: 'Imported sample PO (mock)',
    items: [
      { description: 'Dell Latitude 5540 i7 16GB', quantity: 2, costPrice: 4500 },
      { description: 'Laptop carry case', quantity: 2, costPrice: 1500 },
    ],
  },
];

/** @returns {Promise<ExternalPurchaseOrder[]>} */
export async function fetchMockPurchaseOrders(company = 'ACTIVE24') {
  return MOCK_ORDERS.filter((po) => po.company === company);
}

export async function testMockConnection() {
  return {
    mode: 'mock',
    ok: true,
    message: 'Using local mock PO data (PO_USE_MOCK=true)',
    sampleCount: MOCK_ORDERS.length,
  };
}

/** @typedef {import('./types.js').ExternalPurchaseOrder} ExternalPurchaseOrder */

function mapStatus(raw) {
  const s = String(raw || '').toUpperCase();
  if (s.includes('RECEIV') || s.includes('COMPLETE')) return 'RECEIVED';
  if (s.includes('APPROV')) return 'APPROVED';
  if (s.includes('CANCEL')) return 'CANCELLED';
  return 'PENDING';
}

function mapCompany(raw, fallback = 'ACTIVE24') {
  const key = String(raw || fallback).toUpperCase();
  if (key === 'GENIUS') return 'GENIUS';
  if (key === 'ACTIVE' || key === 'ACTIVE24') return 'ACTIVE24';
  return fallback;
}

function mapLine(line) {
  return {
    productCode: line.product_code || line.productCode || line.code || undefined,
    description: line.description || line.product_name || line.name || line.item || 'Imported item',
    quantity: Number(line.quantity ?? line.qty ?? line.units ?? 1),
    costPrice: Number(line.unit_price ?? line.unitPrice ?? line.cost_price ?? line.costPrice ?? line.price ?? 0),
  };
}

function mapOrder(row, defaultCompany = 'ACTIVE24') {
  const extCompany = row.company ?? row.issuing_company ?? row.issuingCompany ?? defaultCompany;
  const poNumber = String(
    row.serial_no ?? row.serialNo ?? row.po_number ?? row.poNumber ?? row.number ?? row.id ?? ''
  ).trim();

  const summary = {
    externalRef: String(row.id ?? row._id ?? row.po_id ?? row.externalRef ?? poNumber),
    poNumber: poNumber || String(row.id ?? row._id ?? 'unknown'),
    company: mapCompany(extCompany, defaultCompany),
    supplierName:
      row.supplier_name
      ?? row.supplierName
      ?? row.supplier?.name
      ?? row.vendor_name
      ?? row.vendorName
      ?? 'Unknown supplier',
    supplierCode: row.supplier_code ?? row.supplierCode ?? row.supplier?.code,
    orderDate: (row.order_date ?? row.orderDate ?? row.date ?? row.created_at ?? row.createdAt ?? new Date())
      .toString()
      .slice(0, 10),
    expectedDelivery: row.expected_delivery ?? row.expectedDelivery ?? row.delivery_date ?? null,
    status: mapStatus(row.status),
    notes: row.notes ?? row.remarks ?? row.note ?? '',
    items: [],
  };

  const lines = row.items ?? row.lines ?? row.order_items ?? row.orderItems ?? row.purchase_order_items ?? [];
  if (Array.isArray(lines) && lines.length > 0) {
    summary.items = lines.map(mapLine);
  } else if (row.grand_total != null || row.grandTotal != null || row.total_amount != null) {
    const total = Number(row.grand_total ?? row.grandTotal ?? row.total_amount ?? row.totalAmount ?? 0);
    summary.items = [{ description: 'Imported PO total', quantity: 1, costPrice: total }];
  }

  return summary;
}

function extractOrderRows(payload) {
  if (!payload) return [];

  if (Array.isArray(payload)) return payload;

  if (typeof payload === 'object') {
    const candidates = [
      payload.purchase_orders,
      payload.purchaseOrders,
      payload.orders,
      payload.pos,
      payload.data,
      payload.export,
      payload.backup,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
      if (candidate && typeof candidate === 'object') {
        const nested = extractOrderRows(candidate);
        if (nested.length) return nested;
      }
    }

    if (payload.serial_no || payload.po_number || payload.poNumber || payload.supplier_name) {
      return [payload];
    }
  }

  return [];
}

function attachDetachedItems(orders, payload) {
  const itemRows =
    payload.purchase_order_items
    ?? payload.purchaseOrderItems
    ?? payload.po_items
    ?? payload.poItems
    ?? payload.items
    ?? null;

  if (!Array.isArray(itemRows) || itemRows.length === 0) return orders;

  const byPoId = new Map();
  for (const line of itemRows) {
    const poKey = String(
      line.purchase_order_id ?? line.purchaseOrderId ?? line.po_id ?? line.poId ?? line.order_id ?? ''
    );
    if (!poKey) continue;
    if (!byPoId.has(poKey)) byPoId.set(poKey, []);
    byPoId.get(poKey).push(mapLine(line));
  }

  return orders.map((order) => {
    const key = String(order.id ?? order._id ?? order.po_id ?? order.serial_no ?? order.poNumber ?? '');
    const attached = byPoId.get(key);
    if (!attached?.length) return order;
    return { ...order, items: attached, lines: attached };
  });
}

/**
 * Parse a JSON backup downloaded from the hosted PO system.
 * @param {unknown} payload
 * @param {string} [defaultCompany]
 * @returns {ExternalPurchaseOrder[]}
 */
export function parsePoBackup(payload, defaultCompany = 'ACTIVE24') {
  let rows = extractOrderRows(payload);
  if (!rows.length && payload && typeof payload === 'object') {
    rows = attachDetachedItems([], payload).length ? [] : rows;
    const withItems = attachDetachedItems(extractOrderRows(payload.purchase_orders ?? payload.orders ?? []), payload);
    if (withItems.length) rows = withItems;
  } else if (rows.length && typeof payload === 'object' && !Array.isArray(payload)) {
    rows = attachDetachedItems(rows, payload);
  }

  return rows
    .map((row) => mapOrder(row, defaultCompany))
    .filter((po) => po.poNumber && po.poNumber !== 'unknown');
}

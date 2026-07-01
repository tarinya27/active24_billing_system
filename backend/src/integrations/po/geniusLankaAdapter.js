import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';

/** @typedef {import('./types.js').ExternalPurchaseOrder} ExternalPurchaseOrder */

const EXTERNAL_QUERY_COMPANY = {
  GENIUS: 'GENIUS',
  ACTIVE24: 'ACTIVE',
};

const EXTERNAL_TO_OUR_COMPANY = {
  GENIUS: 'GENIUS',
  ACTIVE: 'ACTIVE24',
};

export const PO_SYNC_COMPANY = 'ACTIVE24';

let sessionCookie = null;
let sessionExpiresAt = 0;

function baseUrl() {
  return env.po.baseUrl.replace(/\/$/, '');
}

function parseCookies(res) {
  if (typeof res.headers.getSetCookie === 'function') {
    const cookies = res.headers.getSetCookie();
    return cookies.map((c) => c.split(';')[0]).join('; ');
  }
  const raw = res.headers.get('set-cookie');
  if (!raw) return null;
  return raw.split(',').map((c) => c.split(';')[0].trim()).join('; ');
}

async function login() {
  const { username, password } = env.po;
  if (!username || !password) {
    throw ApiError.badRequest(
      'PO system credentials missing. Set PO_SYSTEM_USERNAME and PO_SYSTEM_PASSWORD in backend/.env'
    );
  }

  const res = await fetch(`${baseUrl()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw ApiError.badGateway(`PO system login failed (${res.status}): ${body.slice(0, 200)}`);
  }

  sessionCookie = parseCookies(res);
  sessionExpiresAt = Date.now() + 25 * 60 * 1000;
  return sessionCookie;
}

async function poFetch(path) {
  if (!sessionCookie || Date.now() > sessionExpiresAt) {
    await login();
  }

  const res = await fetch(`${baseUrl()}${path}`, {
    headers: {
      Cookie: sessionCookie || '',
      Accept: 'application/json',
    },
  });

  if (res.status === 401) {
    await login();
    return poFetch(path);
  }

  if (!res.ok) {
    const body = await res.text();
    throw ApiError.badGateway(`PO system request failed (${res.status}): ${body.slice(0, 200)}`);
  }

  return res.json();
}

function mapStatus(raw) {
  const s = String(raw || '').toUpperCase();
  if (s.includes('RECEIV') || s.includes('COMPLETE')) return 'RECEIVED';
  if (s.includes('APPROV')) return 'APPROVED';
  if (s.includes('CANCEL')) return 'CANCELLED';
  return 'PENDING';
}

function mapCompany(raw) {
  const key = String(raw || '').toUpperCase();
  return EXTERNAL_TO_OUR_COMPANY[key] || 'ACTIVE24';
}

function mapLine(line) {
  return {
    productCode: line.product_code || line.productCode || line.code || undefined,
    description: line.description || line.product_name || line.name || line.item || 'Imported item',
    quantity: Number(line.quantity ?? line.qty ?? line.units ?? 1),
    costPrice: Number(line.unit_price ?? line.unitPrice ?? line.cost_price ?? line.costPrice ?? 0),
  };
}

function mapOrderSummary(row, company) {
  const extCompany = row.company || row.issuing_company || company;
  return {
    externalRef: String(row.id ?? row._id ?? row.po_id ?? row.serial_no ?? row.poNumber),
    poNumber: String(row.serial_no ?? row.po_number ?? row.poNumber ?? row.id),
    company: mapCompany(extCompany),
    supplierName: row.supplier_name ?? row.supplierName ?? row.supplier?.name ?? 'Unknown supplier',
    supplierCode: row.supplier_code ?? row.supplier?.code,
    orderDate: (row.order_date ?? row.orderDate ?? row.created_at ?? row.createdAt ?? new Date()).toString().slice(0, 10),
    expectedDelivery: row.expected_delivery ?? row.expectedDelivery ?? null,
    status: mapStatus(row.status),
    notes: row.notes ?? row.remarks ?? '',
    items: [],
  };
}

function mapOrderDetail(detail, summary) {
  const lines = detail.items ?? detail.lines ?? detail.order_items ?? [];
  return {
    ...summary,
    items: Array.isArray(lines) ? lines.map(mapLine) : [],
    notes: summary.notes || detail.notes || detail.remarks || '',
    status: mapStatus(detail.status ?? summary.status),
  };
}

/** @returns {Promise<ExternalPurchaseOrder[]>} */
export async function fetchGeniusLankaPurchaseOrders(company = PO_SYNC_COMPANY) {
  const queryCompany = EXTERNAL_QUERY_COMPANY[company];
  if (!queryCompany) {
    throw ApiError.badRequest(`Unsupported company for PO sync: ${company}`);
  }

  const listPayload = await poFetch(`/api/purchase-orders?company=${queryCompany}`);
  const rows = Array.isArray(listPayload) ? listPayload : listPayload.data ?? listPayload.items ?? [];

  const orders = [];
  for (const row of rows) {
    const summary = mapOrderSummary(row, queryCompany);
    if (summary.company !== company) continue;

    let detail = row;
    if (row.id && !row.items && !row.lines) {
      try {
        detail = await poFetch(`/api/purchase-orders/${row.id}`);
        if (detail.data) detail = detail.data;
      } catch {
        detail = row;
      }
    }

    const mapped = mapOrderDetail(detail, summary);
    if (mapped.items.length === 0 && row.grand_total) {
      mapped.items = [{ description: 'Imported PO total', quantity: 1, costPrice: Number(row.grand_total) }];
    }
    orders.push(mapped);
  }

  return orders;
}

export async function testGeniusLankaConnection() {
  const { username, password, baseUrl: url } = env.po;
  if (!username || !password) {
    return {
      mode: 'live',
      ok: false,
      message: 'PO credentials not configured',
      baseUrl: url,
    };
  }

  await login();
  const payload = await poFetch(`/api/purchase-orders?company=${EXTERNAL_QUERY_COMPANY.ACTIVE24}&limit=1`);
  const rows = Array.isArray(payload) ? payload : payload.data ?? payload.items ?? [];

  return {
    mode: 'live',
    ok: true,
    message: `Connected to ${url}`,
    sampleCount: rows.length,
  };
}

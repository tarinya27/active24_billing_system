import { api } from './client';

function createResource(base) {
  return {
    list: (params = {}) => api.get(base, { params }).then((r) => r.data.data),
    get: (id) => api.get(`${base}/${id}`).then((r) => r.data.data),
    create: (payload) => api.post(base, payload).then((r) => r.data.data),
    update: (id, payload) => api.patch(`${base}/${id}`, payload).then((r) => r.data.data),
    remove: (id) => api.delete(`${base}/${id}`).then((r) => r.data.data),
  };
}

export const stockApi = {
  summary: (params = {}) => api.get('/stock/summary', { params }).then((r) => r.data.data),
  listUnits: (params = {}) => api.get('/stock/units', { params }).then((r) => r.data.data),
  lookup: (barcode, params = {}) =>
    api.get(`/stock/units/lookup/${encodeURIComponent(barcode)}`, { params }).then((r) => r.data.data),
  movements: (params = {}) => api.get('/stock/movements', { params }).then((r) => r.data.data),
  adjust: (productUnitId, reason) =>
    api.post('/stock/adjust', { productUnitId, reason }).then((r) => r.data.data),
};

export const invoicesApi = {
  list: (params = {}) => api.get('/invoices', { params }).then((r) => r.data.data),
  get: (id) => api.get(`/invoices/${id}`).then((r) => r.data.data),
  create: (payload) => api.post('/invoices', payload).then((r) => r.data.data),
  update: (id, payload) => api.patch(`/invoices/${id}`, payload).then((r) => r.data.data),
  settle: (id, payload) => api.post(`/invoices/${id}/settle`, payload).then((r) => r.data.data),
  cancel: (id) => api.post(`/invoices/${id}/cancel`).then((r) => r.data.data),
};

export const dashboardApi = {
  stats: () => api.get('/dashboard/stats').then((r) => r.data.data),
};

export const reportsApi = {
  sales: (period = 'daily') => api.get('/reports/sales', { params: { period } }).then((r) => r.data.data),
  stock: () => api.get('/reports/stock').then((r) => r.data.data),
  purchase: () => api.get('/reports/purchase').then((r) => r.data.data),
  grn: () => api.get('/reports/grn').then((r) => r.data.data),
  debtors: () => api.get('/reports/debtors').then((r) => r.data.data),
  exportCsv: async (type, period = 'daily') => {
    const res = await api.get(`/reports/export/${type}`, {
      params: { period },
      responseType: 'blob',
    });
    const disposition = res.headers['content-disposition'] || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] || `${type}-report.csv`;
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};

export const settingsApi = {
  get: () => api.get('/settings').then((r) => r.data.data),
  update: (payload) => api.patch('/settings', payload).then((r) => r.data.data),
};

export const PAYMENT_METHOD_API = {
  Cash: 'CASH',
  Card: 'CARD',
  'Bank Transfer': 'BANK_TRANSFER',
  Credit: 'CREDIT',
};

export const PAYMENT_METHOD_LABEL = {
  CASH: 'Cash',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank Transfer',
  CREDIT: 'Credit',
};

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

export const purchaseOrdersApi = {
  ...createResource('/purchase-orders'),
  nextSerial: (company = 'ACTIVE24') =>
    api.get('/purchase-orders/next-serial', { params: { company } }).then((r) => r.data.data),
  sync: (company = 'ACTIVE24') => api.post('/purchase-orders/sync', { company }).then((r) => r.data.data),
  importBackup: (backup, company = 'ACTIVE24') =>
    api.post('/purchase-orders/import/backup', { backup, company }).then((r) => r.data.data),
  testConnection: () => api.get('/purchase-orders/sync/test').then((r) => r.data.data),
  tally: (id) => api.get(`/purchase-orders/${id}/tally`).then((r) => r.data.data),
};

export const purchaseInvoicesApi = {
  ...createResource('/purchase-invoices'),
  tally: (id) => api.get(`/purchase-invoices/${id}/tally`).then((r) => r.data.data),
  calculate: (payload) => api.post('/purchase-invoices/calculate', payload).then((r) => r.data.data),
};

export const grnsApi = {
  list: (params = {}) => api.get('/grns', { params }).then((r) => r.data.data),
  get: (id) => api.get(`/grns/${id}`).then((r) => r.data.data),
  update: (id, payload) => api.patch(`/grns/${id}`, payload).then((r) => r.data.data),
  reserveBarcode: (payload) => api.post('/grns/reserve-barcode', payload).then((r) => r.data.data),
  removePendingUnit: (id) => api.delete(`/grns/pending-unit/${id}`).then((r) => r.data.data),
  complete: (payload) => api.post('/grns/complete', payload).then((r) => r.data.data),
  cancel: (id, reason) => api.post(`/grns/${id}/cancel`, { reason }).then((r) => r.data.data),
};

export const deliveryNotesApi = {
  list: (params = {}) => api.get('/delivery-notes', { params }).then((r) => r.data.data),
  get: (id) => api.get(`/delivery-notes/${id}`).then((r) => r.data.data),
  create: (payload) => api.post('/delivery-notes', payload).then((r) => r.data.data),
  reserveBarcode: (payload) => api.post('/delivery-notes/reserve-barcode', payload).then((r) => r.data.data),
  removePendingUnit: (id) => api.delete(`/delivery-notes/pending-unit/${id}`).then((r) => r.data.data),
  complete: (deliveryNoteId) => api.post('/delivery-notes/complete', { deliveryNoteId }).then((r) => r.data.data),
  cancel: (id, reason) => api.post(`/delivery-notes/${id}/cancel`, { reason }).then((r) => r.data.data),
  createInvoice: (id, payload) => api.post(`/delivery-notes/${id}/create-invoice`, payload).then((r) => r.data.data),
};

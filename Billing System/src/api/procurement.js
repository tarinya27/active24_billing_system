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
  complete: (payload) => api.post('/grns/complete', payload).then((r) => r.data.data),
  cancel: (id, reason) => api.post(`/grns/${id}/cancel`, { reason }).then((r) => r.data.data),
};

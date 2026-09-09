import { api } from './client';

function createResource(base) {
  return {
    list: (params = {}) => api.get(base, { params }).then((r) => r.data.data),
    get: (id) => api.get(`${base}/${id}`).then((r) => r.data.data),
    create: (payload) => api.post(base, payload).then((r) => r.data.data),
    update: (id, payload) => api.patch(`${base}/${id}`, payload).then((r) => r.data.data),
  };
}

export const sofApi = {
  ...createResource('/service-orders'),
  nextNumber: () => api.get('/service-orders/next-number').then((r) => r.data.data),
};
export const estimatesApi = createResource('/estimates');

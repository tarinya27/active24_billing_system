import { api } from './client';

// Builds a CRUD client for a REST resource that returns the standard
// { data, error } envelope. List endpoints return { items, total, ... }.
function createResource(base) {
  return {
    list: (params = {}) => api.get(base, { params }).then((r) => r.data.data),
    get: (id) => api.get(`${base}/${id}`).then((r) => r.data.data),
    create: (payload) => api.post(base, payload).then((r) => r.data.data),
    update: (id, payload) => api.patch(`${base}/${id}`, payload).then((r) => r.data.data),
    remove: (id) => api.delete(`${base}/${id}`).then((r) => r.data.data),
  };
}

export const productsApi = createResource('/products');
export const suppliersApi = createResource('/suppliers');
export const customersApi = createResource('/customers');
export const usersApi = createResource('/users');

// Categories return a plain array (no pagination envelope).
export const categoriesApi = {
  list: (params = {}) => api.get('/categories', { params }).then((r) => r.data.data),
  create: (payload) => api.post('/categories', payload).then((r) => r.data.data),
  update: (id, payload) => api.patch(`/categories/${id}`, payload).then((r) => r.data.data),
  remove: (id) => api.delete(`/categories/${id}`).then((r) => r.data.data),
};

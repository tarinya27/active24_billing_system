import axios from 'axios';

const ACCESS_TOKEN_KEY = 'active24_access_token';

let accessToken = localStorage.getItem(ACCESS_TOKEN_KEY) || null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token;
  if (token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

// Same-origin '/api' (Vite dev proxy / Nginx in prod). withCredentials sends the refresh cookie.
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Single-flight refresh: if a 401 occurs, try to refresh once and replay the request.
let refreshPromise = null;
const AUTH_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'];

async function runRefresh() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post('/api/auth/refresh', null, { withCredentials: true })
      .then((res) => {
        const token = res.data?.data?.accessToken;
        setAccessToken(token || null);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const isAuthPath = original && AUTH_PATHS.some((p) => original.url?.includes(p));

    if (status === 401 && original && !original._retried && !isAuthPath) {
      original._retried = true;
      try {
        const token = await runRefresh();
        if (token) {
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        }
      } catch {
        setAccessToken(null);
      }
    }
    return Promise.reject(error);
  }
);

// Helper to surface backend error messages ({ data, error: { message } }).
export function getErrorMessage(error, fallback = 'Something went wrong') {
  const details = error?.response?.data?.error?.details;
  if (Array.isArray(details) && details.length) {
    return details.map((d) => d.message).join('; ');
  }
  return error?.response?.data?.error?.message || error?.message || fallback;
}

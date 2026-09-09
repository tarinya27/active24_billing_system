import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { customersApi } from '../api/masters';
import { getErrorMessage } from '../api/client';
import { useAuth } from './AuthContext';

const CustomersContext = createContext(null);

function unwrapList(data) {
  return Array.isArray(data) ? data : data?.items || [];
}

export function CustomersProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!isAuthenticated) {
      setCustomers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await customersApi.list();
      setCustomers(unwrapList(data));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load customers'));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(async (payload) => {
    const created = await customersApi.create(payload);
    setCustomers((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
    return created;
  }, []);

  const update = useCallback(async (id, payload) => {
    const updated = await customersApi.update(id, payload);
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
    return updated;
  }, []);

  const remove = useCallback(async (id) => {
    await customersApi.remove(id);
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const value = useMemo(
    () => ({ customers, loading, reload, create, update, remove }),
    [customers, loading, reload, create, update, remove]
  );

  return <CustomersContext.Provider value={value}>{children}</CustomersContext.Provider>;
}

export function useCustomers() {
  const ctx = useContext(CustomersContext);
  if (!ctx) throw new Error('useCustomers must be used within CustomersProvider');
  return ctx;
}

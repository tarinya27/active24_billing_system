import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { getErrorMessage } from '../api/client';

// Fetches a list resource and exposes { items, loading, reload }.
// Handles both array responses (categories) and { items } envelopes.
export function useResourceList(resource, params = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const paramsKey = JSON.stringify(params);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await resource.list({ pageSize: 200, ...JSON.parse(paramsKey) });
      setItems(Array.isArray(data) ? data : data.items || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load data'));
    } finally {
      setLoading(false);
    }
    // resource is stable (module singleton); params tracked via paramsKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { items, setItems, loading, reload };
}

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { getErrorMessage } from '../api/client';

export function useServerList(resourceApi, params = {}, deps = []) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(params.page || 1);
  const [pageSize, setPageSize] = useState(params.pageSize || 20);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await resourceApi.list({ ...params, page, pageSize });
      setItems(result.items || []);
      setTotal(result.total || 0);
      setTotalPages(result.totalPages || 1);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load data'));
      setItems([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, ...deps]);

  useEffect(() => {
    load();
  }, [load]);

  const goToPage = (nextPage) => setPage(Math.max(1, Math.min(nextPage, totalPages || 1)));

  const changePageSize = (size) => {
    setPageSize(size);
    setPage(1);
  };

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
    loading,
    reload: load,
    goToPage,
    changePageSize,
    setPage,
  };
}

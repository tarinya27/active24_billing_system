import { useState } from 'react';

export function usePagination(items, itemsPerPage = 10) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(items.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = items.slice(startIndex, startIndex + itemsPerPage);

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const resetPage = () => setCurrentPage(1);

  return {
    currentPage,
    totalPages,
    paginatedItems,
    goToPage,
    resetPage,
    totalItems: items.length,
    itemsPerPage,
  };
}

export function useSearch(items, searchFields) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return searchFields.some((field) => {
      const value = field.split('.').reduce((obj, key) => obj?.[key], item);
      return String(value || '').toLowerCase().includes(q);
    });
  });

  return { searchQuery, setSearchQuery, filteredItems };
}

export function useFilter(items, filterKey) {
  const [filter, setFilter] = useState('All');

  const filteredItems = items.filter((item) => {
    if (filter === 'All') return true;
    return item[filterKey] === filter;
  });

  return { filter, setFilter, filteredItems };
}

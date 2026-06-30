// Parses common list query params into Prisma-friendly pagination.
// Usage: const { skip, take, page, pageSize } = parsePagination(req.query);
export function parsePagination(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const rawSize = Number.parseInt(query.pageSize, 10) || 20;
  const pageSize = Math.min(200, Math.max(1, rawSize));
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

// Standard list response envelope.
export function listResult(items, total, { page, pageSize }) {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

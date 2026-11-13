// meta and links for paged lists, e.g. links.next = "/api/rounds?page=2&limit=10".
function pageLinks(basePath, query, page, totalPages) {
  const make = (p) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || k === 'page' || k === 'limit') continue;
      params.set(k, String(v));
    }
    params.set('page', String(p));
    params.set('limit', String(query.limit));
    return `${basePath}?${params.toString()}`;
  };
  return {
    self: make(page),
    next: page < totalPages ? make(page + 1) : null,
    prev: page > 1 ? make(Math.min(page - 1, Math.max(totalPages, 1))) : null,
  };
}

function totalPages(total, limit) {
  return Math.max(1, Math.ceil(total / limit));
}

module.exports = { pageLinks, totalPages };

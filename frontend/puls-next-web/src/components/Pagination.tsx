import React from 'react';

interface PaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

function buildVisiblePages(page: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);

  if (page <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }

  if (page >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }

  const sorted = Array.from(pages)
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((left, right) => left - right);

  const result: Array<number | 'ellipsis'> = [];
  let previousPage = 0;

  for (const currentPage of sorted) {
    if (previousPage > 0 && currentPage - previousPage > 1) {
      result.push('ellipsis');
    }

    result.push(currentPage);
    previousPage = currentPage;
  }

  return result;
}

export function Pagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = []
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = totalCount === 0 ? 0 : Math.min(safePage * pageSize, totalCount);
  const pages = buildVisiblePages(safePage, totalPages);

  return (
    <div className="pagination">
      <div className="pagination-meta">
        <div className="pagination-summary">
          {totalCount === 0 ? 'Нет записей' : `Показано ${start}-${end} из ${totalCount}`}
        </div>

        {onPageSizeChange && pageSizeOptions.length > 0 ? (
          <label className="pagination-size">
            <span>На странице</span>
            <select className="form-select pagination-select" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="pagination-actions">
        <button type="button" className="secondary-button button-inline" disabled={safePage <= 1} onClick={() => onPageChange(1)}>
          В начало
        </button>
        <button type="button" className="secondary-button button-inline" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>
          Назад
        </button>

        <div className="pagination-pages" aria-label="Страницы">
          {pages.map((item, index) => item === 'ellipsis' ? (
            <span key={`ellipsis-${safePage}-${index}`} className="pagination-ellipsis">…</span>
          ) : (
            <button
              key={item}
              type="button"
              className={`pagination-page-button${item === safePage ? ' active' : ''}`}
              aria-current={item === safePage ? 'page' : undefined}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="pagination-page">
          Страница {safePage} из {totalPages}
        </div>

        <button type="button" className="secondary-button button-inline" disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)}>
          Вперед
        </button>
        <button type="button" className="secondary-button button-inline" disabled={safePage >= totalPages} onClick={() => onPageChange(totalPages)}>
          В конец
        </button>
      </div>
    </div>
  );
}

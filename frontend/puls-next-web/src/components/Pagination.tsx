import React, { useEffect, useMemo, useRef, useState } from 'react';

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

function NavigationIcon({ kind }: { kind: 'first' | 'previous' | 'next' | 'last' }) {
  if (kind === 'first') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 5v14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M17 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === 'previous') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === 'next') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17 5v14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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
  const pages = useMemo(() => buildVisiblePages(safePage, totalPages), [safePage, totalPages]);
  const [pageSizeOpen, setPageSizeOpen] = useState(false);
  const [pageSizeMenuDirection, setPageSizeMenuDirection] = useState<'down' | 'up'>('down');
  const [pageSizeMenuWidth, setPageSizeMenuWidth] = useState<number | null>(null);
  const pageSizeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pageSizeOpen) {
      return;
    }

    const updateMenuPlacement = () => {
      const picker = pageSizeRef.current;
      if (!picker) {
        return;
      }

      const rect = picker.getBoundingClientRect();
      const estimatedHeight = Math.min(Math.max(pageSizeOptions.length, 1), 6) * 46 + 22;
      const viewportPadding = 16;
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;

      setPageSizeMenuDirection(spaceBelow >= estimatedHeight || spaceBelow >= spaceAbove ? 'down' : 'up');
      setPageSizeMenuWidth(Math.max(Math.round(rect.width), 92));
    };

    const handlePointerDown = (event: MouseEvent) => {
      if (!pageSizeRef.current?.contains(event.target as Node)) {
        setPageSizeOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPageSizeOpen(false);
      }
    };

    updateMenuPlacement();
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updateMenuPlacement);
    window.addEventListener('scroll', updateMenuPlacement, true);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updateMenuPlacement);
      window.removeEventListener('scroll', updateMenuPlacement, true);
    };
  }, [pageSizeOpen, pageSizeOptions.length]);

  return (
    <div className="pagination">
      <div className="pagination-meta">
        <div className="pagination-summary">
          {`Всего: ${totalCount}`}
        </div>

        {onPageSizeChange && pageSizeOptions.length > 0 ? (
          <div className={`pagination-size-picker${pageSizeOpen ? ' open' : ''}`} ref={pageSizeRef}>
            <span className="pagination-size-label">Отображать</span>
            <button
              type="button"
              className={`pagination-size-trigger${pageSizeOpen ? ' open' : ''}`}
              aria-haspopup="listbox"
              aria-expanded={pageSizeOpen}
              onClick={() => setPageSizeOpen((current) => !current)}
            >
              <span className="pagination-size-spacer" aria-hidden="true" />
              <span className="pagination-size-value">{pageSize}</span>
              <span className="pagination-size-icon">
                <ChevronIcon />
              </span>
            </button>

            {pageSizeOpen ? (
              <div
                className={`pagination-size-menu ${pageSizeMenuDirection}`}
                role="listbox"
                aria-label="Количество строк на странице"
                style={pageSizeMenuWidth ? { minWidth: `${pageSizeMenuWidth}px` } : undefined}
              >
                {pageSizeOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`pagination-size-option${option === pageSize ? ' active' : ''}`}
                    role="option"
                    aria-selected={option === pageSize}
                    onClick={() => {
                      onPageSizeChange(option);
                      setPageSizeOpen(false);
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="pagination-actions">
        <button
          type="button"
          className="secondary-button button-inline icon-button pagination-nav-button"
          aria-label="В начало"
          title="В начало"
          disabled={safePage <= 1}
          onClick={() => onPageChange(1)}
        >
          <NavigationIcon kind="first" />
        </button>
        <button
          type="button"
          className="secondary-button button-inline icon-button pagination-nav-button"
          aria-label="Назад"
          title="Назад"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          <NavigationIcon kind="previous" />
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
          {safePage} из {totalPages}
        </div>

        <button
          type="button"
          className="secondary-button button-inline icon-button pagination-nav-button"
          aria-label="Вперед"
          title="Вперед"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          <NavigationIcon kind="next" />
        </button>
        <button
          type="button"
          className="secondary-button button-inline icon-button pagination-nav-button"
          aria-label="В конец"
          title="В конец"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(totalPages)}
        >
          <NavigationIcon kind="last" />
        </button>
      </div>
    </div>
  );
}

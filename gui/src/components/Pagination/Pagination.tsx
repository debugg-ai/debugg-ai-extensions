import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { useCallback } from "react";

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface PaginationProps {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  showPageInfo?: boolean;
  compact?: boolean;
  disabled?: boolean;
}

export default function Pagination({
  pagination,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showPageSizeSelector = true,
  showPageInfo = true,
  compact = false,
  disabled = false,
}: PaginationProps) {
  const { page, pageSize, total, hasNext, hasPrevious } = pagination;
  
  const totalPages = Math.ceil(total / pageSize);
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  const handlePageChange = useCallback((newPage: number) => {
    if (disabled || newPage === page || newPage < 1 || newPage > totalPages) return;
    onPageChange(newPage);
  }, [disabled, page, totalPages, onPageChange]);

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    if (disabled || !onPageSizeChange || newPageSize === pageSize) return;
    onPageSizeChange(newPageSize);
  }, [disabled, pageSize, onPageSizeChange]);

  const handleFirstPage = useCallback(() => handlePageChange(1), [handlePageChange]);
  const handlePreviousPage = useCallback(() => handlePageChange(page - 1), [handlePageChange, page]);
  const handleNextPage = useCallback(() => handlePageChange(page + 1), [handlePageChange, page]);
  const handleLastPage = useCallback(() => handlePageChange(totalPages), [handlePageChange, totalPages]);

  // Don't render if there's no data or only one page and no page size selector
  if (total === 0 || (totalPages <= 1 && !showPageSizeSelector)) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center justify-between text-xs text-vsc-descriptionForeground">
        <div className="flex items-center space-x-1">
          <button
            onClick={handlePreviousPage}
            disabled={disabled || !hasPrevious}
            className="p-1 text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-list-hoverBackground rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Previous page"
          >
            <ChevronLeftIcon className="h-3 w-3" />
          </button>
          <span className="px-2">
            {page} / {totalPages}
          </span>
          <button
            onClick={handleNextPage}
            disabled={disabled || !hasNext}
            className="p-1 text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-list-hoverBackground rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Next page"
          >
            <ChevronRightIcon className="h-3 w-3" />
          </button>
        </div>
        {showPageInfo && (
          <span className="text-xs">
            {startItem}-{endItem} of {total}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-2 py-1 border-t border-vsc-panel-border bg-vsc-editor-background">
      {/* Page info */}
      <div className="flex items-center space-x-2 text-xs text-vsc-descriptionForeground">
        {showPageInfo && (
          <span>
            Showing {startItem}-{endItem} of {total} items
          </span>
        )}
        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center space-x-1">
            <span>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              disabled={disabled}
              className="px-1 py-0.5 text-xs bg-vsc-input-background border border-vsc-input-border rounded-sm text-vsc-input-foreground focus:outline-none focus:border-vsc-focusBorder disabled:opacity-50"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Navigation controls */}
      <div className="flex items-center space-x-1">
        <button
          onClick={handleFirstPage}
          disabled={disabled || !hasPrevious}
          className="p-1 text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-list-hoverBackground rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="First page"
        >
          <ChevronDoubleLeftIcon className="h-4 w-4" />
        </button>
        <button
          onClick={handlePreviousPage}
          disabled={disabled || !hasPrevious}
          className="p-1 text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-list-hoverBackground rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Previous page"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        
        <span className="px-2 text-xs text-vsc-foreground">
          Page {page} of {totalPages}
        </span>
        
        <button
          onClick={handleNextPage}
          disabled={disabled || !hasNext}
          className="p-1 text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-list-hoverBackground rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Next page"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
        <button
          onClick={handleLastPage}
          disabled={disabled || !hasNext}
          className="p-1 text-vsc-tab-inactiveForeground hover:text-vsc-tab-activeForeground hover:bg-vsc-list-hoverBackground rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Last page"
        >
          <ChevronDoubleRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
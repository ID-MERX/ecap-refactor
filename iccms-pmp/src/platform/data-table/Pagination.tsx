/**
 * Pagination control.
 *
 * Works for both modes. In server mode the total comes from the API; in client mode it is derived.
 * A 5-slot numbered window with ellipses, as the legacy registers used, because caseworkers navigate by
 * page number rather than by "next".
 */

import { ChevronLeft, ChevronRight } from "lucide-react";

export const PAGE_SIZES = [50, 100, 500] as const;

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  /** Server mode must not offer "All" — the whole point is never to download everything. */
  allowAll?: boolean;
  disabled?: boolean;
};

/** The page numbers to render, with `null` standing in for an ellipsis. */
export function pageWindow(
  page: number,
  totalPages: number,
  width = 5,
): ReadonlyArray<number | null> {
  if (totalPages <= width) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const half = Math.floor(width / 2);
  let first = Math.max(1, page - half);
  const last = Math.min(totalPages, first + width - 1);
  first = Math.max(1, last - width + 1);

  const pages: Array<number | null> = [];
  // Leading: page 1, then a gap only if it stands for at least one hidden page.
  if (first > 1) {
    pages.push(1);
    if (first === 3) pages.push(2);
    else if (first > 3) pages.push(null);
  }

  for (let n = first; n <= last; n += 1) pages.push(n);

  // Trailing: the same rule on the other side.
  if (last < totalPages) {
    const remaining = totalPages - last;
    if (remaining === 1) pages.push(totalPages);
    else if (remaining === 2) pages.push(totalPages - 1, totalPages);
    else pages.push(null, totalPages);
  }

  return pages;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  allowAll = false,
  disabled = false,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-3 py-2 text-sm">
      <p className="text-slate-600">
        Showing <span className="font-medium">{start.toLocaleString()}</span> to{" "}
        <span className="font-medium">{end.toLocaleString()}</span> of{" "}
        <span className="font-medium">{total.toLocaleString()}</span> entries
      </p>

      <div className="flex items-center gap-2">
        {onPageSizeChange ? (
          <label className="flex items-center gap-1 text-slate-600">
            <span className="sr-only">Rows per page</span>
            <select
              className="rounded border border-slate-300 bg-white px-1.5 py-1"
              value={pageSize}
              disabled={disabled}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
              {allowAll ? <option value={Number.MAX_SAFE_INTEGER}>All</option> : null}
            </select>
          </label>
        ) : null}

        {totalPages > 1 ? (
          <nav className="flex items-center gap-1" aria-label="Pagination">
            <button
              type="button"
              className="rounded p-1 disabled:opacity-40"
              disabled={disabled || page <= 1}
              onClick={() => onPageChange(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </button>

            {pageWindow(page, totalPages).map((n, index) =>
              n === null ? (
                <span key={`gap-${index}`} className="px-1 text-slate-400">
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  aria-current={n === page ? "page" : undefined}
                  className={`min-w-8 rounded px-2 py-1 ${
                    n === page ? "bg-brand-600 font-medium text-white" : "hover:bg-slate-100"
                  }`}
                  disabled={disabled}
                  onClick={() => onPageChange(n)}
                >
                  {n}
                </button>
              ),
            )}

            <button
              type="button"
              className="rounded p-1 disabled:opacity-40"
              disabled={disabled || page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </button>
          </nav>
        ) : null}
      </div>
    </div>
  );
}

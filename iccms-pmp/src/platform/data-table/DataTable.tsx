/**
 * The table.
 *
 * **Server mode is the default** (decision 33): the component never receives more than one page of
 * rows, so 260,000-row registers cost one page of memory and one page of DOM. Client mode remains for
 * small collections and keeps the same look, sorting, column picker and empty/error states, so a page
 * looks identical in either mode.
 *
 * Virtualisation is deliberately absent: virtualising a 50-row page is pointless, and virtualising a
 * 260k-row download is the problem we removed rather than a solution to it.
 */

import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3 } from "lucide-react";

import { applyFilters } from "@/platform/filters/applyFilters";
import { compareIds } from "@/core/lib/values";
import { storage } from "@/core/lib/storage";

import { ErrorState } from "./states";
import { Pagination } from "./Pagination";
import type { ColumnDef, DataTableProps, TableSource } from "./types";

function visibilityKey(tableId: string): string {
  return `table.columns.${tableId}`;
}

function loadHiddenColumns(tableId: string): ReadonlyArray<string> {
  return (
    storage.getJson<string[]>(visibilityKey(tableId), {
      safeParse: (value) => {
        if (!Array.isArray(value)) return { success: false };
        return { success: true, data: value.filter((v): v is string => typeof v === "string") };
      },
    }) ?? []
  );
}

function saveHiddenColumns(tableId: string, hidden: ReadonlyArray<string>): void {
  storage.setJson(visibilityKey(tableId), [...hidden]);
}

export function DataTable<T>({
  tableId,
  columns,
  getRowId,
  rowHref,
  emptyTitle = "No records found",
  emptyDescription = "Try removing a filter or widening the date range.",
  source,
}: DataTableProps<T>): ReactNode {
  const [hidden, setHidden] = useState<ReadonlyArray<string>>(() => loadHiddenColumns(tableId));
  const [pickerOpen, setPickerOpen] = useState(false);

  const visibleColumns = useMemo(
    () => columns.filter((column) => !hidden.includes(column.id)),
    [columns, hidden],
  );

  const isServer = source.mode === "server";

  // --- rows for this render ----------------------------------------------------------------
  const rows: ReadonlyArray<T> = useMemo(() => {
    if (isServer) return source.data?.rows ?? [];
    const filtered = source.filters
      ? applyFilters(
          source.rows as ReadonlyArray<Record<string, unknown>>,
          source.filters.defs,
          source.filters.state,
        )
      : source.rows;
    return filtered as ReadonlyArray<T>;
  }, [isServer, source]);

  const total = isServer ? (source.data?.total ?? 0) : rows.length;
  const page = isServer ? (source.data?.page ?? 1) : 1;
  const pageSize = isServer ? (source.data?.pageSize ?? 50) : Math.max(rows.length, 1);

  const sort = isServer ? { field: source.query.sort, direction: source.query.order } : null;

  function toggleSort(column: ColumnDef<T>) {
    if (!isServer) return;
    const field = column.sortField ?? column.meta?.field ?? column.id;
    if (source.sortableFields && !source.sortableFields.includes(field)) return;
    const nextDirection: "asc" | "desc" =
      source.query.sort === field && source.query.order === "asc" ? "desc" : "asc";
    source.onQueryChange({ sort: field, order: nextDirection, page: 1 });
  }

  function toggleColumn(column: ColumnDef<T>) {
    if (column.meta?.locked) return;
    const next = hidden.includes(column.id)
      ? hidden.filter((id) => id !== column.id)
      : [...hidden, column.id];
    setHidden(next);
    saveHiddenColumns(tableId, next);
  }

  const error = source.error;
  if (error) {
    return <ErrorState error={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-end border-b border-slate-200 px-3 py-1.5">
        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
            onClick={() => setPickerOpen((open) => !open)}
            aria-expanded={pickerOpen}
          >
            <Columns3 className="size-4" />
            Columns
          </button>
          {pickerOpen ? (
            <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
              {columns.map((column) => (
                <label
                  key={column.id}
                  className={`flex items-center gap-2 rounded px-1.5 py-1 text-sm ${
                    column.meta?.locked ? "opacity-50" : "hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!hidden.includes(column.id)}
                    disabled={column.meta?.locked}
                    onChange={() => toggleColumn(column)}
                  />
                  {column.meta?.label ?? column.header}
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr>
              {visibleColumns.map((column) => {
                const field = column.sortField ?? column.meta?.field ?? column.id;
                const isSorted = sort?.field === field;
                const align = column.meta?.align ?? "left";
                return (
                  <th
                    key={column.id}
                    scope="col"
                    className={`whitespace-nowrap border-b border-slate-200 px-3 py-2 font-medium text-slate-600 text-${align}`}
                  >
                    {isServer ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort(column)}
                      >
                        {column.header}
                        {isSorted ? (
                          sort?.direction === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3 text-slate-300" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {source.isLoading ? (
              <tr>
                <td
                  colSpan={visibleColumns.length}
                  className="px-3 py-10 text-center text-slate-500"
                >
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-3 py-10 text-center">
                  <p className="font-medium text-slate-700">{emptyTitle}</p>
                  <p className="mt-1 text-slate-500">{emptyDescription}</p>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = getRowId(row);
                return (
                  <tr
                    key={id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    {visibleColumns.map((column, index) => {
                      const align = column.meta?.align ?? "left";
                      const content = column.cell
                        ? column.cell(row)
                        : String(
                            (row as Record<string, unknown>)[column.meta?.field ?? column.id] ?? "",
                          );
                      // The first column becomes a real link, so middle-click and "open in new tab"
                      // work — the legacy register used a click handler on a div.
                      const wrapped =
                        index === 0 && rowHref ? (
                          <Link
                            to={rowHref(row)}
                            className="font-medium text-brand-600 hover:underline"
                          >
                            {content}
                          </Link>
                        ) : (
                          content
                        );
                      return (
                        <td
                          key={column.id}
                          className={`px-3 py-2 align-top text-${align} ${
                            column.meta?.className ?? ""
                          } ${column.meta?.className?.includes("whitespace-pre-line") ? "" : "whitespace-nowrap"}`}
                        >
                          {wrapped}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isServer ? (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          disabled={source.isFetching ?? false}
          onPageChange={(next) => source.onQueryChange({ page: next })}
          onPageSizeChange={(size) => source.onQueryChange({ pageSize: size, page: 1 })}
        />
      ) : (
        <div className="border-t border-slate-200 px-3 py-2 text-sm text-slate-600">
          {rows.length.toLocaleString()} {rows.length === 1 ? "entry" : "entries"}
          {source.unfilteredCount !== undefined && source.unfilteredCount !== rows.length
            ? ` of ${source.unfilteredCount.toLocaleString()}`
            : ""}
        </div>
      )}
    </div>
  );
}

export { compareIds };
export type { TableSource };

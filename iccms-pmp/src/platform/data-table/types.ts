/**
 * Table column definitions.
 *
 * `meta` carries everything the table, the export and the (future) server query need, so a column is
 * declared once. The legacy registers defined their columns separately for the table, the sort, the
 * search and the CSV — four lists that disagreed about which raw field to read.
 */

import type { FilterDef } from "@/platform/filters/types";

export type ColumnAlign = "left" | "right" | "center";

export type ColumnMeta<T> = {
  /** The field name in the domain type — also the sort key sent to the server. */
  field: string;
  label: string;
  /** Header used in the CSV/PDF export. Defaults to `label`. */
  exportHeader?: string;
  /** Text shown in the export for one row. Defaults to `String(value)`. */
  exportValue?: (row: T) => string;
  /** Extra class names for the cell — e.g. a monospace ID chip. */
  className?: string;
  align?: ColumnAlign;
  /** Hidden by default in the column picker. */
  hidden?: boolean;
  /** Never offered in the picker (identifiers the table cannot function without). */
  locked?: boolean;
  /** Only expose this column for these modes. */
  showFor?: ReadonlyArray<"client" | "server">;
};

export type ColumnDef<T> = {
  id: string;
  header: string;
  meta?: ColumnMeta<T>;
  /** Server-mode sorting: the column name the backend will accept. */
  sortField?: string;
  /** Client-mode sort/comparison, when the raw value needs work. */
  sortValue?: (row: T) => string | number;
  cell?: (row: T) => React.ReactNode;
};

/**
 * How the table gets its rows.
 *
 * `server` is the default for registers (decision 33): the front end never holds more than one page.
 * `client` stays available for small, fully-loaded collections where sorting and filtering are cheap.
 */
export type TableMode = "server" | "client";

export type ServerPage<T> = {
  rows: ReadonlyArray<T>;
  /** Total matching rows across all pages — needed for "page 47 of 5,200". */
  total: number;
  page: number;
  pageSize: number;
};

export type ServerTableQuery = {
  page: number;
  pageSize: number;
  sort: string;
  order: "asc" | "desc";
  /** Filter state already turned into query params by `toQueryParams`. */
  filters: Record<string, string>;
};

/** What a module must supply to use `<DataTable>` in server mode. */
export type ServerTableSource<T> = {
  mode: "server";
  query: ServerTableQuery;
  onQueryChange: (next: Partial<ServerTableQuery>) => void;
  data: ServerPage<T> | undefined;
  isLoading: boolean;
  isFetching?: boolean;
  error: unknown;
  /** Sorting only works on columns the backend can order by. */
  sortableFields?: ReadonlyArray<string>;
};

export type ClientTableSource<T> = {
  mode: "client";
  rows: ReadonlyArray<T>;
  isLoading: boolean;
  error: unknown;
  /** Total before filtering, for the "showing X of Y" line. */
  unfilteredCount?: number;
  /** Filter defs + state, so the table can filter in client mode. */
  filters?: { defs: ReadonlyArray<FilterDef>; state: Record<string, string> };
  /** Sorting happens here. */
  sortable?: boolean;
};

export type TableSource<T> = ServerTableSource<T> | ClientTableSource<T>;

export type DataTableProps<T> = {
  /** Identifies the table for persisted column visibility. */
  tableId: string;
  columns: ReadonlyArray<ColumnDef<T>>;
  getRowId: (row: T) => string;
  /** Builds the href for the row's primary link. A real `<a>`, so middle-click works. */
  rowHref?: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  source: TableSource<T>;
};

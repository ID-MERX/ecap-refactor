/**
 * CSV export.
 *
 * The rule: **the file contains exactly what the user sees** — the same rows the filters selected, the
 * same columns they have visible, in the same order. The legacy register hand-built its CSV and used a
 * *different* set of source fields than the table (export read `household_id` while the table fell back
 * to `householdId`), so the download could disagree with the screen (`docs/audit/households.md`,
 * "Exports").
 *
 * Escaping is done here rather than left to a library default, because Excel and the legacy consumers
 * both expect RFC-4180 quoting plus a BOM.
 */

import type { ColumnDef } from "@/platform/data-table/types";

export type ExportRow = ReadonlyArray<string>;

/** RFC-4180: wrap in quotes, double any embedded quote. */
export function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * A cell value that Excel will not mangle.
 *
 * A value starting with `=`, `+`, `-` or `@` is interpreted as a formula — the classic CSV injection
 * path, and a real one here because household IDs and names come from the field. A leading TAB stops
 * Excel evaluating it while staying readable.
 */
export function sanitizeCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /^[=+\-@\t\r]/.test(text) ? `\t${text}` : text;
}

export function toCsv<T>(rows: ReadonlyArray<T>, columns: ReadonlyArray<ColumnDef<T>>): string {
  const header = columns
    .map((column) => escapeCell(column.meta?.exportHeader ?? column.header))
    .join(",");

  const body = rows.map((row) =>
    columns
      .map((column) => {
        const meta = column.meta;
        const raw = meta?.exportValue
          ? meta.exportValue(row)
          : (row as Record<string, unknown>)[meta?.field ?? column.id];
        return escapeCell(sanitizeCell(raw));
      })
      .join(","),
  );

  return [header, ...body].join("\r\n");
}

/** Excel needs the BOM or it reads UTF-8 as the local codepage and mangles non-ASCII names. */
export function withBom(csv: string): string {
  return `\uFEFF${csv}`;
}

export type ExportFilenameParts = {
  appShortName: string;
  table: string;
  /** Scope slug, e.g. the district name or `all_districts`. */
  scope?: string;
  /** FY slug or `all_time`. */
  period?: string;
  /** `yyyy-MM-dd`. Passed in so the caller controls the clock (and tests are stable). */
  date: string;
  extension: "csv" | "pdf";
};

/**
 * `ICCMS_households_Kabwe_FY2026_2026-11-04.csv`
 *
 * The legacy filenames embedded only the district and today's date, so two exports from different
 * fiscal years collided in the Downloads folder.
 */
export function exportFilename(parts: ExportFilenameParts): string {
  const segments = [parts.appShortName, parts.table, parts.scope, parts.period, parts.date]
    .filter((segment): segment is string => Boolean(segment))
    .map((segment) => segment.replace(/\s+/g, "_"))
    .join("_");
  return `${segments}.${parts.extension}`;
}

/** Trigger a download without leaking the object URL. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([withBom(csv)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next tick: revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

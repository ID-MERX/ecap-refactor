import { describe, expect, it } from "vitest";

import type { ColumnDef } from "@/platform/data-table/types";

import { escapeCell, exportFilename, sanitizeCell, toCsv } from "../csv";

type Row = { id: string; name: string; note?: string | null; count?: number };

const COLUMNS: ReadonlyArray<ColumnDef<Row>> = [
  { id: "id", header: "Household ID", meta: { field: "id", label: "Household ID" } },
  { id: "name", header: "Name", meta: { field: "name", label: "Name" } },
  {
    id: "note",
    header: "Note",
    meta: { field: "note", label: "Note" },
  },
  {
    id: "count",
    header: "Count",
    meta: {
      field: "count",
      label: "Count",
      exportHeader: "Members",
      exportValue: (row) => (row.count === undefined ? "" : String(row.count)),
    },
  },
];

describe("escapeCell", () => {
  it("quotes every cell and doubles embedded quotes", () => {
    expect(escapeCell('He said "hi"')).toBe('"He said ""hi"""');
  });

  it("renders null and undefined as a bare empty cell, not a quoted empty string", () => {
    // `""` would make Excel treat the cell as a non-empty string, which breaks COUNT/ISBLANK.
    expect(escapeCell(null)).toBe("");
    expect(escapeCell(undefined)).toBe("");
  });

  it("keeps commas safe by quoting", () => {
    expect(escapeCell("Kabwe, Central")).toBe('"Kabwe, Central"');
  });
});

describe("sanitizeCell", () => {
  it("defuses values Excel would evaluate as a formula", () => {
    // A CSV injection path that is real here: household IDs and names come from the field.
    for (const dangerous of ["=1+1", "+SUM(A1)", "-2+3", "@cmd", "\tcat"]) {
      expect(sanitizeCell(dangerous).startsWith("\t")).toBe(true);
    }
  });

  it("leaves ordinary text alone", () => {
    expect(sanitizeCell("Kabwe")).toBe("Kabwe");
    expect(sanitizeCell("HH-0001")).toBe("HH-0001");
  });
});

describe("toCsv", () => {
  it("writes the header from exportHeader where given, else the column header", () => {
    const csv = toCsv<Row>([], COLUMNS);
    expect(csv).toBe('"Household ID","Name","Note","Members"');
  });

  it("writes rows in the given order with CRLF separators", () => {
    const rows: Row[] = [
      { id: "HH1", name: "Alpha", note: null, count: 3 },
      { id: "HH2", name: "Beta", note: "x", count: undefined },
    ];
    const csv = toCsv(rows, COLUMNS);
    expect(csv.split("\r\n")).toEqual([
      '"Household ID","Name","Note","Members"',
      '"HH1","Alpha","","3"',
      '"HH2","Beta","x",""',
    ]);
  });

  it("uses exportValue so the file matches the rendered cell", () => {
    // The legacy export read a different raw field than the table, so the download could disagree
    // with the screen. `exportValue` is the single source for both.
    const csv = toCsv<Row>([{ id: "HH1", name: "A", count: 42 }], COLUMNS);
    expect(csv).toContain('"42"');
  });
});

describe("exportFilename", () => {
  it("includes the period so two FY exports do not collide", () => {
    expect(
      exportFilename({
        appShortName: "ICCMS",
        table: "households",
        scope: "Kabwe",
        period: "FY2026",
        date: "2026-11-04",
        extension: "csv",
      }),
    ).toBe("ICCMS_households_Kabwe_FY2026_2026-11-04.csv");
  });

  it("omits empty segments and replaces whitespace", () => {
    expect(
      exportFilename({
        appShortName: "ICCMS",
        table: "vcas",
        scope: "Kapiri Mposhi",
        date: "2026-11-04",
        extension: "csv",
      }),
    ).toBe("ICCMS_vcas_Kapiri_Mposhi_2026-11-04.csv");
  });
});

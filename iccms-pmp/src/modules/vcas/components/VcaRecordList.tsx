import type { ReactNode } from "react";

export function vcaValue(row: Record<string, unknown>, keys: ReadonlyArray<string>): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") return String(value);
  }
  return "—";
}

type Props = {
  title: string;
  rows: ReadonlyArray<Record<string, unknown>>;
  fields: ReadonlyArray<readonly [string, ...string[]]>;
  empty: string;
  maskFields?: ReadonlySet<string>;
};

export function VcaRecordList({
  title,
  rows,
  fields,
  empty,
  maskFields = new Set<string>(),
}: Props): ReactNode {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <h2 className="border-b px-4 py-3 font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {fields.map(([label]) => (
                  <th key={label} className="px-3 py-2 text-left font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={String(row.id ?? index)} className="border-t">
                  {fields.map(([label, ...keys]) => (
                    <td key={label} className="max-w-64 px-3 py-2">
                      {keys.some((key) => maskFields.has(key)) && keys.some((key) => row[key])
                        ? "Hidden for privacy"
                        : vcaValue(row, keys)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

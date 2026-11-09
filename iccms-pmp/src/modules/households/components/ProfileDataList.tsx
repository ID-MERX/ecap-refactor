import type { ReactNode } from "react";

type DataField = readonly [string, ...string[]];

type Props = {
  title: string;
  rows: ReadonlyArray<Record<string, unknown>>;
  fields: ReadonlyArray<DataField>;
  maskFields?: ReadonlySet<string>;
  empty: string;
};

export function profileValue(row: Record<string, unknown>, keys: ReadonlyArray<string>): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") return String(value);
  }
  return "—";
}

export function ProfileDataList({
  title,
  rows,
  fields,
  maskFields = new Set<string>(),
  empty,
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
                      {maskFields.has(keys[0] ?? "") && keys.some((key) => row[key])
                        ? "Hidden for privacy"
                        : profileValue(row, keys)}
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

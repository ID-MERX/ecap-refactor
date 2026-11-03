type CsvValue = string | number | boolean | null | undefined;

const normalizeValue = (value: CsvValue) => (value === null || value === undefined ? "" : String(value));

const escapeCsvValue = (value: CsvValue) => {
  const normalized = normalizeValue(value);
  if (normalized.includes("\"") || normalized.includes(",") || normalized.includes("\n")) {
    return `"${normalized.replace(/"/g, "\"\"")}"`;
  }
  return normalized;
};

const buildCsv = (headers: string[], rows: CsvValue[][]) => {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(","));
  return `${lines.join("\n")}\n`;
};

export const downloadCsv = (filename: string, headers: string[], rows: CsvValue[][]) => {
  const content = buildCsv(headers, rows);
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

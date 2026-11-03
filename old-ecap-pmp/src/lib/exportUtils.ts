/**
 * Escapes a CSV field if it contains special characters.
 */
export const escapeCsvField = (value: string): string => {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

/**
 * Creates and triggers a CSV file download.
 */
export const downloadCsv = (headers: string[], rows: string[][], filename: string) => {
  const csvContent =
    "data:text/csv;charset=utf-8," +
    [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => escapeCsvField(cell)).join(",")),
    ].join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

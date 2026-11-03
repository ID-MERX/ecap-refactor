/**
 * Checks if a service category has been provided with meaningful data.
 * This handles JSON-serialized arrays or simple values, and filters out
 * meaningless values like "not applicable", "none", or "null".
 * 
 * @param record The service record object
 * @param key The key to check in the record
 * @returns true if the category contains at least one meaningful intervention
 */
export const isCategoryProvided = (record: Record<string, any>, key: string): boolean => {
  const val = record[key];
  if (!val) return false;

  try {
    // Attempt to parse if it's a string that looks like JSON
    const parsed = typeof val === "string" && (val.startsWith("[") || val.startsWith("{"))
      ? JSON.parse(val)
      : val;

    // Handle array case
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return false;

      const cleaned = parsed
        .map(v => String(v).trim().toLowerCase())
        .filter(v =>
          v !== "not applicable" &&
          v !== "none" &&
          v !== "null" &&
          v !== "n/a" &&
          v !== "na" &&
          v !== "no" &&
          v !== "false" &&
          v !== "0" &&
          v !== ""
        );

      return cleaned.length > 0;
    }

    // Handle single values (string, boolean, number)
    const sVal = String(parsed).trim().toLowerCase();
    return sVal !== "" && ![
      "not applicable",
      "n/a",
      "na",
      "none",
      "no",
      "false",
      "0",
      "[]",
      "{}",
      "null"
    ].includes(sVal);

  } catch {
    // If parsing fails, fall back to simple string check
    const sVal = String(val).trim().toLowerCase();
    return sVal !== "" && ![
      "not applicable",
      "n/a",
      "na",
      "none",
      "no",
      "false",
      "0",
      "null"
    ].includes(sVal);
  }
};

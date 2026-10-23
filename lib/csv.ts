// CSV helpers for admin exports (RFC 4180 quoting + spreadsheet formula-injection guard).

export type CsvValue = string | number | boolean | null | undefined;

/** One CSV cell. Text that a spreadsheet would run as a formula (=, +, -, @, tab, CR) is prefixed with '. */
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvLine(values: CsvValue[]): string {
  return `${values.map(csvCell).join(',')}\r\n`;
}

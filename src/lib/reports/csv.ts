/**
 * CSV utilities for the reporting suite.
 * Produces RFC 4180-compatible CSV with a UTF-8 BOM so Excel opens it correctly.
 */

export type CsvCell = string | number;

export function toCsv(columns: string[], rows: CsvCell[][]): string {
  const escape = (value: CsvCell): string => {
    const s = String(value ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines: string[] = [columns.map(escape).join(',')];
  for (const row of rows) {
    lines.push(row.map(escape).join(','));
  }

  // Prepend BOM for Excel compatibility
  return '\uFEFF' + lines.join('\r\n');
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
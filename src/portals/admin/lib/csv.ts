// src/portals/admin/lib/csv.ts
//
// CSV-injection guard: a cell beginning with =, +, - or @ is evaluated as a
// formula by Excel/Sheets when the file is opened, not rendered as text. The
// Yellow Card export releases full_name/email straight from the database, so
// a resident whose name happens to start with one of these characters would
// otherwise have it executed as a formula in whatever spreadsheet app opens
// the file. Prefixing with a single quote neutralizes it (Excel's own
// documented mitigation) without changing what a human reader sees.
const FORMULA_PREFIX_RE = /^[=+\-@]/;

function escapeCell(value: string | number): string {
  let text = String(value);
  if (FORMULA_PREFIX_RE.test(text)) {
    text = `'${text}`;
  }
  // \r is included alongside \n and a bare \r (old Mac line ending, or a
  // stray carriage return in freeform text) would otherwise slip through
  // unquoted and corrupt the row structure the same way an unescaped \n does.
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(header: string[], rows: (string | number)[][]): string {
  return [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
}

export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]): void {
  const blob = new Blob([toCsv(header, rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

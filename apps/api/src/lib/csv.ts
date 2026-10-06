/** Minimal RFC-4180 CSV serialization for report exports. */

export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
}

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`
  return s
}

export function toCsv<T>(columns: CsvColumn<T>[], data: T[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(',')
  const lines = data.map((row) => columns.map((c) => escapeCell(c.value(row))).join(','))
  return [header, ...lines].join('\r\n') + '\r\n'
}

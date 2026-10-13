import type { AdminClaim } from './adminApi'
import {
  SHEET_HEADERS,
  SHEET_NAME,
  claimToRow,
  parseLegacyRow,
  type LegacyRow,
} from './legacySheet'

/**
 * Excel export + legacy import share ONE workbook shape (legacySheet.ts), so the
 * file the client already has round-trips. exceljs is lazy-loaded: it is a heavy
 * dependency that the public wizard must never download.
 */

type ExcelJS = typeof import('exceljs')

async function loadExcel(): Promise<ExcelJS> {
  const mod = (await import('exceljs')) as unknown as { default?: ExcelJS } & ExcelJS
  return (mod.default ?? mod) as ExcelJS
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export async function buildWorkbook(claims: AdminClaim[]): Promise<Blob> {
  const ExcelJS = await loadExcel()
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(SHEET_NAME)

  sheet.addRow([...SHEET_HEADERS])
  sheet.getRow(1).font = { bold: true }
  sheet.columns = SHEET_HEADERS.map((header) => ({ width: Math.max(12, header.length + 2) }))

  const sorted = [...claims].sort((a, b) =>
    (a.activation_code ?? '').localeCompare(b.activation_code ?? '', 'en'),
  )
  for (const claim of sorted) sheet.addRow(claimToRow(claim))

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer as ArrayBuffer], { type: XLSX_MIME })
}

export type LegacyImport = {
  rows: LegacyRow[]
  errors: Array<{ row: number; error: string }>
}

export async function readLegacyWorkbook(file: File): Promise<LegacyImport> {
  const ExcelJS = await loadExcel()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())

  const sheet = workbook.getWorksheet(SHEET_NAME) ?? workbook.worksheets[0]
  if (!sheet) throw new Error('الملف لا يحتوي على ورقة عمل.')

  const rows: LegacyRow[] = []
  const errors: Array<{ row: number; error: string }> = []

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return

    const values: unknown[] = []
    for (let col = 1; col <= SHEET_HEADERS.length; col++) {
      const cell = row.getCell(col)
      values.push(cell.value instanceof Date ? cell.value : cell.text)
    }

    if (values.every((value) => String(value ?? '').trim() === '')) return

    const parsed = parseLegacyRow(values)
    if ('error' in parsed) errors.push({ row: rowNumber, error: parsed.error })
    else rows.push(parsed.row)
  })

  return { rows, errors }
}

/** Trigger a browser download for a generated file. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

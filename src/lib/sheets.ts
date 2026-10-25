// Lectura de los exports de Empretienda (Excel .xlsx o .csv) como lista de filas { columna: valor }.
import { readSheet } from 'read-excel-file/node'
import Papa from 'papaparse'

export interface Table { headers: string[]; rows: Record<string, string>[] }

const cell = (v: unknown) => v == null ? '' : v instanceof Date ? v.toISOString() : String(v).trim()

export async function parseTable(file: File): Promise<Table> {
  const buf = Buffer.from(await file.arrayBuffer())
  let matrix: string[][]
  if (/\.xlsx$/i.test(file.name) || file.type.includes('spreadsheetml')) {
    matrix = (await readSheet(buf)).map(r => r.map(cell))
  } else {
    // CSV: Empretienda suele exportar con ; y en UTF-8 o Latin-1
    let text = buf.toString('utf8')
    if (text.includes('�')) text = buf.toString('latin1')
    matrix = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: true }).data.map(r => r.map(cell))
  }
  const start = matrix.findIndex(r => r.filter(Boolean).length >= 2)
  if (start < 0) return { headers: [], rows: [] }
  const headers = matrix[start].map((h, i) => h || `Columna ${i + 1}`)
  const rows = matrix.slice(start + 1).filter(r => r.some(Boolean)).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])))
  return { headers, rows }
}

/** Convierte "$ 12.500,00", "12500.5" o "12.500" a número. */
export function parseMoney(v: string | undefined): number | null {
  if (!v) return null
  let s = v.replace(/[^\d,.-]/g, '')
  if (!s) return null
  if (s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  else s = s.replace(/,/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** "21/10/2026 18:30", "2026-10-21", serial de Excel... a Date. */
export function parseDate(v: string | undefined): Date | null {
  if (!v) return null
  const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?/)
  if (m) {
    const y = Number(m[3].length === 2 ? '20' + m[3] : m[3])
    return new Date(y, Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 12), Number(m[5] ?? 0))
  }
  if (/^\d{5}(\.\d+)?$/.test(v)) return new Date(Math.round((Number(v) - 25569) * 86400000))
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

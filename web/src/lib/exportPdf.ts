import { pdf } from '@react-pdf/renderer'
import { createElement } from 'react'
import PdfTemplate, { type PdfCard } from '../components/PdfTemplate'

interface ExportArgs {
  cards: PdfCard[]
  longCards: PdfCard[]
  date: Date
  title?: string
  filename: string
}

export async function exportPdfDoc({ cards, longCards, date, title, filename }: ExportArgs) {
  if (cards.length === 0) throw new Error('No cards to export')

  const doc = createElement(PdfTemplate, { cards, longCards, date, title })
  const blob = await pdf(doc).toBlob()

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function formatDatePdf(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// A4 페이지 크기(mm)
const A4_WIDTH = 210
const A4_HEIGHT = 297

/**
 * 주어진 root 엘리먼트 안의 `.pdf-page` 각각을 1페이지씩 캡처하여 PDF로 다운로드.
 * 각 .pdf-page는 A4 비율(210×297 mm ≈ 794×1123 px @ 96DPI) 로 고정 사이즈여야 함.
 */
export async function exportPagesToPdf(root: HTMLElement, filename: string) {
  const pages = Array.from(root.querySelectorAll<HTMLElement>('.pdf-page'))
  if (pages.length === 0) throw new Error('No pages to export')

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  for (let i = 0; i < pages.length; i++) {
    const canvas = await html2canvas(pages[i], {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
    })
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    if (i > 0) pdf.addPage()
    pdf.addImage(dataUrl, 'JPEG', 0, 0, A4_WIDTH, A4_HEIGHT, undefined, 'FAST')
  }

  pdf.save(filename)
}

export function formatDatePdf(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

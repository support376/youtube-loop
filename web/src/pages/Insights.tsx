import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import type { WeeklyReport } from '../hooks/useSupabase'

export default function Insights() {
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [selected, setSelected] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('weekly_reports')
        .select('*')
        .order('week_start', { ascending: false })
        .limit(20)
      setReports(data || [])
      setLoading(false)
    }
    fetch()
  }, [])

  if (loading) return <div className="animate-pulse h-64 bg-[var(--bg-card)] rounded-2xl" />

  if (!reports.length) {
    return (
      <div className="text-center py-20 text-[var(--text-secondary)]">
        아직 주간 리포트가 없습니다. 매주 월요일 오전 9시에 자동 생성됩니다.
      </div>
    )
  }

  const report = reports[selected]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <h2 className="text-2xl font-bold">주간 인사이트</h2>

      {/* 기간 선택 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {reports.map((r, i) => (
          <button
            key={r.id}
            onClick={() => setSelected(i)}
            className={`px-4 py-2 text-sm rounded-full whitespace-nowrap transition ${
              i === selected
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {fmtDate(r.week_start)} ~ {fmtDate(r.week_end)}
          </button>
        ))}
      </div>

      {/* 리포트 본문 */}
      <motion.div
        key={report.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-6"
      >
        <div
          className="prose prose-invert prose-sm max-w-none
            [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-3
            [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2
            [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2
            [&_p]:text-[var(--text-secondary)] [&_p]:leading-relaxed [&_p]:mb-3
            [&_li]:text-[var(--text-secondary)] [&_li]:mb-1
            [&_strong]:text-[var(--text-primary)]
            [&_ul]:pl-5 [&_ol]:pl-5"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(report.report_md || '') }}
        />
      </motion.div>

      {/* TOP 영상 */}
      {report.top_videos && (
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-6">
          <h3 className="text-lg font-semibold mb-3">TOP 영상</h3>
          {(report.top_videos as any[]).map((v: any, i: number) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <span className="text-[var(--accent)] font-bold text-lg">{i + 1}</span>
              <span className="flex-1">{v.title}</span>
              <span className="text-sm text-[var(--text-secondary)]">조회수 {(v.views || 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

function fmtDate(d: string) {
  return d?.replace(/-/g, '.') || ''
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\- (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(?!<[hulo])(.+)/gm, '<p>$1</p>')
}

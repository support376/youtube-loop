import { useEffect, useState, type ComponentPropsWithoutRef } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { supabase } from '../lib/supabase'
import type { WeeklyReport } from '../hooks/useSupabase'

// --- 마크다운을 섹션(## 기준)별로 분리 ---
function splitSections(md: string): { title: string; body: string }[] {
  const lines = md.split('\n')
  const sections: { title: string; body: string[] }[] = []
  let current: { title: string; body: string[] } | null = null

  for (const line of lines) {
    const h2 = line.match(/^## (.+)/)
    if (h2) {
      if (current) sections.push(current)
      current = { title: h2[1], body: [] }
    } else if (current) {
      current.body.push(line)
    }
    // h1이나 --- 앞의 내용은 스킵 (제목/날짜)
  }
  if (current) sections.push(current)

  return sections.map(s => ({
    title: s.title,
    body: s.body.join('\n').replace(/^---$/gm, '').trim(),
  }))
}

// --- 섹션 아이콘 매핑 ---
function sectionIcon(title: string): string {
  if (/TOP/.test(title)) return '🏆'
  if (/주제/.test(title)) return '🔥'
  if (/제목/.test(title)) return '✍️'
  if (/추천|기획/.test(title)) return '🎯'
  if (/인사이트/.test(title)) return '💡'
  return '📊'
}

// --- 커스텀 마크다운 컴포넌트 ---
const mdComponents = {
  table: (props: ComponentPropsWithoutRef<'table'>) => (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border-collapse" {...props} />
    </div>
  ),
  thead: (props: ComponentPropsWithoutRef<'thead'>) => (
    <thead className="border-b border-[var(--border)]" {...props} />
  ),
  th: (props: ComponentPropsWithoutRef<'th'>) => (
    <th className="text-left p-3 text-[var(--text-secondary)] font-medium text-xs uppercase" {...props} />
  ),
  td: (props: ComponentPropsWithoutRef<'td'>) => (
    <td className="p-3 border-b border-[var(--border)] text-[var(--text-secondary)]" {...props} />
  ),
  tr: (props: ComponentPropsWithoutRef<'tr'>) => (
    <tr className="hover:bg-[var(--bg-hover)] transition" {...props} />
  ),
  hr: () => (
    <div className="my-6 border-t border-[var(--border)]" />
  ),
  blockquote: (props: ComponentPropsWithoutRef<'blockquote'>) => (
    <blockquote className="border-l-3 border-[var(--accent)] pl-4 my-3 text-[var(--text-secondary)] italic" {...props} />
  ),
  strong: (props: ComponentPropsWithoutRef<'strong'>) => (
    <strong className="text-[var(--text-primary)] font-semibold" {...props} />
  ),
  h3: (props: ComponentPropsWithoutRef<'h3'>) => (
    <h3 className="text-base font-semibold mt-5 mb-2 text-[var(--text-primary)]" {...props} />
  ),
  h4: (props: ComponentPropsWithoutRef<'h4'>) => (
    <h4 className="text-sm font-semibold mt-4 mb-1 text-[var(--text-primary)]" {...props} />
  ),
  p: (props: ComponentPropsWithoutRef<'p'>) => (
    <p className="text-[var(--text-secondary)] leading-relaxed mb-3" {...props} />
  ),
  li: (props: ComponentPropsWithoutRef<'li'>) => (
    <li className="text-[var(--text-secondary)] mb-1.5 leading-relaxed" {...props} />
  ),
  ul: (props: ComponentPropsWithoutRef<'ul'>) => (
    <ul className="pl-5 my-2 list-disc" {...props} />
  ),
  ol: (props: ComponentPropsWithoutRef<'ol'>) => (
    <ol className="pl-5 my-2 list-decimal" {...props} />
  ),
}

export default function Insights() {
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [selected, setSelected] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from('weekly_reports')
        .select('*')
        .order('week_start', { ascending: false })
        .limit(20)
      setReports(data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-[var(--bg-card)] rounded" />
        <div className="h-12 bg-[var(--bg-card)] rounded-full" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-48 bg-[var(--bg-card)] rounded-2xl" />
        ))}
      </div>
    )
  }

  if (!reports.length) {
    return (
      <div className="text-center py-20 text-[var(--text-secondary)]">
        아직 주간 리포트가 없습니다. 매주 월요일 오전 9시에 자동 생성됩니다.
      </div>
    )
  }

  const report = reports[selected]
  const sections = splitSections(report.report_md || '')

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

      {/* 섹션별 카드 */}
      {sections.map((section, i) => (
        <motion.div
          key={`${report.id}-${i}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.4 }}
          className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden"
        >
          {/* 카드 헤더 */}
          <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
            <span className="text-xl">{sectionIcon(section.title)}</span>
            <h3 className="text-base font-semibold">{section.title}</h3>
          </div>

          {/* 카드 본문 */}
          <div className="px-6 py-5">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {section.body}
            </ReactMarkdown>
          </div>
        </motion.div>
      ))}

      {/* TOP 영상 */}
      {report.top_videos && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: sections.length * 0.1 }}
          className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-6"
        >
          <h3 className="text-lg font-semibold mb-4">🏅 TOP 영상</h3>
          {(report.top_videos as any[]).map((v: any, i: number) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-[var(--border)] last:border-0">
              <span className={`text-2xl font-bold ${i === 0 ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
                {i + 1}
              </span>
              <span className="flex-1 text-sm">{v.title}</span>
              <span className="text-sm text-[var(--text-secondary)] tabular-nums">
                {(v.views || 0).toLocaleString()} 회
              </span>
            </div>
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}

function fmtDate(d: string) {
  return d?.replace(/-/g, '.') || ''
}

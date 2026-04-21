import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Archive,
  ChevronDown,
  FileDown,
  Loader2,
  AlertTriangle,
  Shield,
  CheckCircle2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { type PdfCard } from '../components/PdfTemplate'

interface PlanningCardRow {
  id: string
  title: string
  topic_summary: string | null
  shorts_fit: number | null
  score_total: number | null
  score_detail: Record<string, number> | null
  status: string
  style: string | null
  special_tags: string[] | null
  one_line: string | null
  evidence: string[] | null
  case_study: string | null
  closing: string | null
  source_name: string | null
  source_url: string | null
  guide: string | null
  format: 'shorts' | 'long' | null
  created_at: string
  talking_points?: PdfCard['talking_points']
}

type Toast = { type: 'success' | 'error'; message: string }

const STYLE_COLORS: Record<string, string> = {
  경고형: 'bg-[rgba(239,68,68,0.15)] text-[#F87171]',
  질문형: 'bg-[rgba(59,130,246,0.15)] text-[#60A5FA]',
  손해방지형: 'bg-[rgba(34,197,94,0.15)] text-[#4ADE80]',
  사실단언형: 'bg-[rgba(251,191,36,0.15)] text-[#FCD34D]',
}

const SPECIAL_TAG_MAP: Record<string, { icon: React.ReactNode; cls: string }> = {
  양변전문영역: { icon: <CheckCircle2 size={10} />, cls: 'bg-[var(--green)]/15 text-[var(--green)]' },
  톤주의: { icon: <AlertTriangle size={10} />, cls: 'bg-amber-500/15 text-amber-400' },
  검증필요: { icon: <Shield size={10} />, cls: 'bg-blue-500/15 text-blue-400' },
}

function formatDateKo(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split('-')
  return `${y}년 ${parseInt(m, 10)}월 ${parseInt(d, 10)}일`
}

export default function PlanHistory() {
  const [cards, setCards] = useState<PlanningCardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [exportingDate, setExportingDate] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (t: Toast, durationMs = 4000) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(t)
    toastTimer.current = setTimeout(() => setToast(null), durationMs)
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('planning_cards')
        .select('*')
        .eq('status', '승인')
        .order('created_at', { ascending: false })
      if (error) console.error(error)
      setCards((data as PlanningCardRow[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  // 날짜별 그룹핑 (내림차순)
  const grouped = useMemo(() => {
    const map: Record<string, PlanningCardRow[]> = {}
    for (const c of cards) {
      const d = c.created_at.slice(0, 10)
      if (!map[d]) map[d] = []
      map[d].push(c)
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]))
  }, [cards])

  const handleExportDate = async (date: string) => {
    if (exportingDate) return
    const group = grouped.find(([d]) => d === date)
    if (!group) return
    const [, list] = group
    const shorts = list.filter(c => c.format !== 'long') as unknown as PdfCard[]
    const longs = list.filter(c => c.format === 'long') as unknown as PdfCard[]
    if (shorts.length === 0) {
      showToast({ type: 'error', message: '해당 날짜에 승인된 쇼츠 카드가 없습니다' })
      return
    }
    setExportingDate(date)
    try {
      const { exportPdfDoc } = await import('../lib/exportPdf')
      await exportPdfDoc({
        cards: shorts,
        longCards: longs,
        date: new Date(date),
        title: `양홍수 변호사 쇼츠 카드 · ${formatDateKo(date)}`,
        filename: `${date}_쇼츠카드.pdf`,
      })
      showToast({ type: 'success', message: 'PDF 다운로드 시작됨' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast({ type: 'error', message: `PDF 생성 실패: ${msg}` }, 6000)
    } finally {
      setExportingDate(null)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-[var(--bg-card)] rounded-2xl" />
        ))}
      </div>
    )
  }

  if (grouped.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-12 text-center"
      >
        <Archive size={48} className="text-[var(--text-muted)] mx-auto mb-4" />
        <p className="text-base text-[var(--text-secondary)]">아직 승인된 기획안이 없습니다</p>
        <p className="text-sm text-[var(--text-muted)] mt-2">
          기획안 탭에서 카드를 승인하면 여기에 날짜별로 쌓여요
        </p>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.message}
            initial={{ opacity: 0, y: -12, x: 12 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-[var(--green-soft)] border-[var(--green)]/30 text-[var(--green)]'
                : 'bg-[var(--red-soft)] border-[var(--red)]/30 text-[var(--red)]'
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {grouped.map(([date, list], gi) => (
        <motion.section
          key={date}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: gi * 0.05 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              {formatDateKo(date)}{' '}
              <span className="text-sm text-[var(--text-secondary)] font-normal">
                ({list.length}개 승인)
              </span>
            </h3>
            <button
              onClick={() => handleExportDate(date)}
              disabled={exportingDate !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-transparent border border-[var(--border-card)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50 hover:text-[var(--text-primary)] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {exportingDate === date ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <FileDown size={12} />
                  이 날짜 PDF 다시 뽑기
                </>
              )}
            </button>
          </div>

          <div className="space-y-2">
            {list.map(card => (
              <HistoryCard
                key={card.id}
                card={card}
                expanded={expandedId === card.id}
                onToggle={() =>
                  setExpandedId(prev => (prev === card.id ? null : card.id))
                }
              />
            ))}
          </div>
        </motion.section>
      ))}

    </motion.div>
  )
}

function HistoryCard({
  card,
  expanded,
  onToggle,
}: {
  card: PlanningCardRow
  expanded: boolean
  onToggle: () => void
}) {
  const styleCls =
    card.style && STYLE_COLORS[card.style]
      ? STYLE_COLORS[card.style]
      : 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'

  return (
    <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-card)] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-start gap-3 text-left hover:bg-[var(--bg-hover)]/60 transition"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            {card.style && (
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${styleCls}`}>
                {card.style}
              </span>
            )}
            {(card.special_tags ?? []).map(t => {
              const cfg = SPECIAL_TAG_MAP[t] || {
                icon: null,
                cls: 'bg-[var(--bg-hover)] text-[var(--text-secondary)]',
              }
              return (
                <span
                  key={t}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${cfg.cls}`}
                >
                  {cfg.icon}
                  {t}
                </span>
              )
            })}
            {typeof card.score_total === 'number' && (
              <span className="ml-auto text-[11px] text-[var(--text-muted)] tabular-nums">
                종합 {card.score_total}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-[var(--text-primary)] line-clamp-2">
            {card.title}
          </p>
        </div>
        <ChevronDown
          size={16}
          className={`text-[var(--text-secondary)] shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 space-y-3 border-t border-[var(--border-card)]">
              {card.one_line && (
                <Detail label="한 줄 결론" italic>
                  "{card.one_line}"
                </Detail>
              )}
              {card.evidence && card.evidence.length > 0 && (
                <Detail label="근거">
                  <ul className="list-disc pl-5 space-y-1">
                    {card.evidence.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </Detail>
              )}
              {card.case_study && <Detail label="사례">{card.case_study}</Detail>}
              {card.closing && <Detail label="마무리">{card.closing}</Detail>}
              {card.source_name && (
                <Detail label="출처">
                  <div>{card.source_name}</div>
                  {card.source_url && (
                    <a
                      href={card.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--accent)] hover:underline break-all"
                    >
                      {card.source_url}
                    </a>
                  )}
                </Detail>
              )}
              {card.guide && (
                <div className="rounded-xl p-3 bg-[var(--accent-soft)] border border-[var(--accent)]/20">
                  <p className="text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wide mb-1">
                    양변 가이드
                  </p>
                  <div className="text-sm text-[var(--text-primary)] leading-relaxed">
                    {card.guide}
                  </div>
                </div>
              )}
              {card.talking_points && (
                <Detail label="토킹 포인트">
                  <TalkingPointsBlock tp={card.talking_points} />
                </Detail>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Detail({
  label,
  children,
  italic,
}: {
  label: string
  children: React.ReactNode
  italic?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">
        {label}
      </p>
      <div className={`text-sm text-[var(--text-primary)] leading-relaxed ${italic ? 'italic' : ''}`}>
        {children}
      </div>
    </div>
  )
}

function TalkingPointsBlock({ tp }: { tp: NonNullable<PdfCard['talking_points']> }) {
  return (
    <div className="text-sm leading-relaxed space-y-1">
      {tp.hook && <div><b className="text-[var(--text-muted)]">훅 아이디어:</b> {tp.hook}</div>}
      {tp.facts && tp.facts.length > 0 && (
        <div>
          <b className="text-[var(--text-muted)]">전달할 사실:</b>
          <ul className="list-disc pl-5 mt-1">
            {tp.facts.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}
      {tp.case_tip && <div><b className="text-[var(--text-muted)]">사례 활용 팁:</b> {tp.case_tip}</div>}
      {tp.closing_idea && <div><b className="text-[var(--text-muted)]">마무리 아이디어:</b> {tp.closing_idea}</div>}
      {tp.avoid && <div><b className="text-[var(--text-muted)]">피하면 좋을 것:</b> {tp.avoid}</div>}
    </div>
  )
}

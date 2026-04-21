import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check,
  Pencil,
  Pause,
  Trash2,
  Star,
  Sparkles,
  Loader2,
  ChevronDown,
  AlertTriangle,
  Shield,
  CheckCircle2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import WeightSliders, {
  DEFAULT_WEIGHTS,
  type Weights,
} from '../components/WeightSliders'

// ─── 타입 ───
type CardStatus = '초안' | '승인' | '수정중' | '보류' | '폐기'

interface PlanningCardRow {
  id: string
  title: string
  topic_summary: string | null
  recommendation_reason: string | null
  shorts_fit: number | null
  score_total: number | null
  score_detail: Record<string, number> | null
  status: CardStatus
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
}

interface GeneratedShortsCard {
  style: string
  tags: string[]
  title: string
  one_line: string
  evidence: string[]
  case_study: string
  closing: string
  source_name: string
  source_url: string
  guide: string | null
  scores: Record<string, number>
  shorts_fit: number
  format: 'shorts'
}

interface GeneratedLongCandidate {
  title: string
  description: string
  related_shorts: number[]
  format: 'long'
}

interface GenerateResponse {
  ok: true
  data: {
    shorts_cards: GeneratedShortsCard[]
    long_candidates: GeneratedLongCandidate[]
    style_distribution?: Record<string, number>
  }
}

// ─── 상수 ───
const STATUS_STYLES: Record<CardStatus, string> = {
  초안: 'bg-[var(--bg-hover)] text-[var(--text-secondary)]',
  승인: 'bg-[var(--green-soft)] text-[var(--green)]',
  수정중: 'bg-amber-500/15 text-amber-400',
  보류: 'bg-blue-500/15 text-blue-400',
  폐기: 'bg-[var(--accent-soft)] text-[var(--accent)]',
}

const STYLE_COLORS: Record<string, string> = {
  경고형: 'bg-[var(--accent)]/15 text-[var(--accent)]',
  질문형: 'bg-blue-500/15 text-blue-400',
  손해방지형: 'bg-amber-500/15 text-amber-400',
  사실단언형: 'bg-[var(--green)]/15 text-[var(--green)]',
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── 가중치 기반 종합 점수 계산 ───
function calcTotal(detail: Record<string, number> | null, weights: Record<string, number>): number {
  if (!detail) return 0
  const total = Object.keys(weights).reduce(
    (a, k) => a + ((detail[k] || 0) * (weights[k] || 0)) / 100,
    0,
  )
  return Math.round(total)
}

// ─── 메인 ───
export default function PlanDraft() {
  const [cards, setCards] = useState<PlanningCardRow[]>([])
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCards = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('planning_cards')
      .select('*')
      .order('score_total', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) console.error(error)
    setCards((data as PlanningCardRow[]) || [])
    setLoading(false)
  }

  const loadWeights = async () => {
    const { data } = await supabase
      .from('score_weights')
      .select('weights')
      .eq('is_active', true)
      .limit(1)
    const raw = data?.[0]?.weights as Partial<Weights> | undefined
    if (raw) {
      setWeights({ ...DEFAULT_WEIGHTS, ...raw })
    }
  }

  useEffect(() => {
    loadCards()
    loadWeights()
  }, [])

  // ─── 기획안 생성 ───
  const generate = async () => {
    setGenerating(true)
    setError(null)
    try {
      // 1. 오늘 크롤링
      const [newsRes, commRes, feedbackRes] = await Promise.all([
        supabase
          .from('crawled_news')
          .select('title, url, source, source_type, section, keyword, body, freshness')
          .eq('crawl_date', today())
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('crawled_community')
          .select('title, url, platform, body, freshness')
          .eq('crawl_date', today())
          .order('created_at', { ascending: false })
          .limit(60),
        supabase
          .from('feedback')
          .select('content_md')
          .order('created_at', { ascending: false })
          .limit(1),
      ])

      const crawledNews = newsRes.data ?? []
      const crawledCommunity = commRes.data ?? []
      const feedbackMd = feedbackRes.data?.[0]?.content_md ?? ''

      // 데이터 부족 체크
      if (crawledNews.length === 0 && crawledCommunity.length === 0) {
        setError('오늘자 크롤링 데이터가 없습니다. GitHub Actions 확인 필요.')
        setGenerating(false)
        return
      }

      // 2. API 호출
      const resp = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crawled_news: crawledNews,
          crawled_community: crawledCommunity,
          feedback_md: feedbackMd,
          weights,
        }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.message || err.error || `HTTP ${resp.status}`)
      }
      const json = (await resp.json()) as GenerateResponse

      // 3. Supabase INSERT
      const shortsRows = json.data.shorts_cards.map(c => ({
        title: c.title,
        topic_summary: c.one_line,
        recommendation_reason: (c.evidence ?? []).join(' / '),
        shorts_fit: c.shorts_fit,
        score_total: calcTotal(c.scores, weights),
        score_detail: c.scores,
        status: '초안',
        style: c.style,
        special_tags: c.tags ?? [],
        one_line: c.one_line,
        evidence: c.evidence,
        case_study: c.case_study,
        closing: c.closing,
        source_name: c.source_name,
        source_url: c.source_url,
        guide: c.guide,
        format: 'shorts',
      }))
      const longRows = json.data.long_candidates.map(l => ({
        title: l.title,
        topic_summary: l.description,
        recommendation_reason: l.description,
        status: '초안',
        format: 'long',
      }))

      const { error: insErr } = await supabase
        .from('planning_cards')
        .insert([...shortsRows, ...longRows])
      if (insErr) throw new Error(insErr.message)

      await loadCards()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
    }
  }

  // ─── 상태 변경 ───
  const updateStatus = async (id: string, status: CardStatus) => {
    setCards(prev => prev.map(c => (c.id === id ? { ...c, status } : c)))
    const { error } = await supabase
      .from('planning_cards')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) console.error(error)
  }

  // ─── 현재 가중치로 재계산 + 정렬 ───
  const computedCards = useMemo(
    () =>
      cards.map(c => ({
        ...c,
        computed_total: calcTotal(c.score_detail, weights),
      })),
    [cards, weights],
  )

  const shortsActive = computedCards
    .filter(c => c.format !== 'long' && (c.status === '초안' || c.status === '수정중'))
    .sort((a, b) => b.computed_total - a.computed_total)
  const shortsSettled = computedCards
    .filter(
      c => c.format !== 'long' && (c.status === '승인' || c.status === '보류' || c.status === '폐기'),
    )
    .sort((a, b) => b.computed_total - a.computed_total)
  const longs = computedCards.filter(c => c.format === 'long')

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* 헤더 + 생성 버튼 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">기획안</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            쇼츠 초안 {shortsActive.length} · 승인 {cards.filter(c => c.status === '승인').length} · 롱폼 후보{' '}
            {longs.length}
          </p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-60"
        >
          {generating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              기획안 생성 중... (20~40초)
            </>
          ) : (
            <>
              <Sparkles size={16} />
              기획안 생성
            </>
          )}
        </button>
      </div>

      {/* 가중치 슬라이더 */}
      <WeightSliders weights={weights} onChange={setWeights} />

      {error && (
        <div className="rounded-xl bg-[var(--accent-soft)] border border-[var(--accent)]/30 p-4 text-sm">
          <p className="font-semibold text-[var(--accent)]">생성 실패</p>
          <p className="text-[var(--text-secondary)] mt-1">{error}</p>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* 초안·수정중 */}
          {shortsActive.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {shortsActive.map((card, i) => (
                <Card key={card.id} card={card} index={i} onAction={updateStatus} />
              ))}
            </div>
          )}

          {/* 처리 완료 */}
          {shortsSettled.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
                처리 완료 ({shortsSettled.length})
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {shortsSettled.map((card, i) => (
                  <Card key={card.id} card={card} index={i} onAction={updateStatus} dimmed />
                ))}
              </div>
            </div>
          )}

          {/* 롱폼 후보 */}
          {longs.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 mt-8">🎥 롱폼 후보</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {longs.map((card, i) => (
                  <LongCard key={card.id} card={card} index={i} onAction={updateStatus} />
                ))}
              </div>
            </div>
          )}

          {cards.length === 0 && !generating && (
            <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-12 text-center">
              <Sparkles size={40} className="text-[var(--text-secondary)] mx-auto mb-4" />
              <p className="font-semibold mb-2">아직 기획안이 없습니다</p>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto">
                위의 <span className="font-medium">기획안 생성</span> 버튼을 누르면 오늘 크롤링 + 피드백 규칙
                기준으로 Claude가 쇼츠 10개 + 롱폼 3~4개를 만들어줍니다.
              </p>
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}

// ─── 쇼츠 카드 ───
function Card({
  card,
  index,
  onAction,
  dimmed = false,
}: {
  card: PlanningCardRow & { computed_total: number }
  index: number
  onAction: (id: string, s: CardStatus) => void
  dimmed?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: dimmed ? 0.55 : 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
      className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 flex flex-col gap-4"
    >
      {/* 상단: 스타일/태그/상태 */}
      <div className="flex flex-wrap items-center gap-2">
        {card.style && (
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              STYLE_COLORS[card.style] || 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'
            }`}
          >
            {card.style}
          </span>
        )}
        {(card.special_tags ?? []).map(t => (
          <SpecialTag key={t} tag={t} />
        ))}
        <span className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[card.status]}`}>
          {card.status}
        </span>
      </div>

      {/* 제목 + 한 줄 */}
      <div>
        <h3 className="font-semibold text-base leading-snug mb-1">{card.title}</h3>
        {card.one_line && (
          <p className="text-sm text-[var(--text-secondary)] italic">"{card.one_line}"</p>
        )}
      </div>

      {/* 스코어 + 적합도 */}
      <div className="grid grid-cols-3 gap-3 py-2 border-y border-[var(--border)]">
        <div>
          <p className="text-xs text-[var(--text-secondary)]">종합</p>
          <p className="text-2xl font-bold tabular-nums">
            {card.score_detail ? card.computed_total : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-secondary)] mb-1">쇼츠 적합도</p>
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={14}
                className={
                  i < (card.shorts_fit ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-[var(--border)]'
                }
              />
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-[var(--text-secondary)]">출처</p>
          <p className="text-xs mt-0.5 line-clamp-1">{card.source_name || '—'}</p>
        </div>
      </div>

      {/* 스코어 상세 바 */}
      {card.score_detail && <ScoreBars detail={card.score_detail} />}

      {/* 펼치기 */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition self-start"
      >
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        {open ? '접기' : '근거·사례·가이드 보기'}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-2 border-t border-[var(--border)]">
              {card.evidence && card.evidence.length > 0 && (
                <Section title="근거">
                  <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--text-secondary)]">
                    {card.evidence.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </Section>
              )}
              {card.case_study && <Section title="사례">{card.case_study}</Section>}
              {card.closing && <Section title="마무리">{card.closing}</Section>}
              {card.guide && (
                <Section title="양변 가이드" accent>
                  {card.guide}
                </Section>
              )}
              {card.source_url && (
                <a
                  href={card.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--accent)] hover:underline break-all"
                >
                  🔗 {card.source_url}
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 액션 버튼 */}
      <div className="grid grid-cols-4 gap-2 pt-1">
        <ActionBtn
          icon={<Check size={14} />}
          label="승인"
          color="green"
          active={card.status === '승인'}
          onClick={() => onAction(card.id, '승인')}
        />
        <ActionBtn
          icon={<Pencil size={14} />}
          label="수정"
          color="amber"
          active={card.status === '수정중'}
          onClick={() => onAction(card.id, '수정중')}
        />
        <ActionBtn
          icon={<Pause size={14} />}
          label="보류"
          color="blue"
          active={card.status === '보류'}
          onClick={() => onAction(card.id, '보류')}
        />
        <ActionBtn
          icon={<Trash2 size={14} />}
          label="폐기"
          color="red"
          active={card.status === '폐기'}
          onClick={() => onAction(card.id, '폐기')}
        />
      </div>
    </motion.div>
  )
}

// ─── 롱폼 카드 ───
function LongCard({
  card,
  index,
  onAction,
}: {
  card: PlanningCardRow
  index: number
  onAction: (id: string, s: CardStatus) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
      className="rounded-2xl bg-[var(--bg-card)] border border-blue-500/20 p-5 flex flex-col gap-3"
    >
      <div className="flex items-center gap-2">
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400">
          LONG
        </span>
        <span className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[card.status]}`}>
          {card.status}
        </span>
      </div>
      <h3 className="font-semibold text-base leading-snug">{card.title}</h3>
      {card.topic_summary && (
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{card.topic_summary}</p>
      )}
      <div className="grid grid-cols-4 gap-2 pt-1">
        <ActionBtn
          icon={<Check size={14} />}
          label="승인"
          color="green"
          active={card.status === '승인'}
          onClick={() => onAction(card.id, '승인')}
        />
        <ActionBtn
          icon={<Pencil size={14} />}
          label="수정"
          color="amber"
          active={card.status === '수정중'}
          onClick={() => onAction(card.id, '수정중')}
        />
        <ActionBtn
          icon={<Pause size={14} />}
          label="보류"
          color="blue"
          active={card.status === '보류'}
          onClick={() => onAction(card.id, '보류')}
        />
        <ActionBtn
          icon={<Trash2 size={14} />}
          label="폐기"
          color="red"
          active={card.status === '폐기'}
          onClick={() => onAction(card.id, '폐기')}
        />
      </div>
    </motion.div>
  )
}

// ─── 스코어 바 ───
function ScoreBars({ detail }: { detail: Record<string, number> }) {
  const keys = ['화제성', '법률연결성', '시청자실익', '수익성', '경쟁도', '지속성']
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
      {keys.map(k => {
        const v = detail[k] ?? 0
        return (
          <div key={k} className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--text-secondary)] w-16 shrink-0">{k}</span>
            <div className="flex-1 h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] transition-all"
                style={{ width: `${Math.min(100, Math.max(0, v))}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums w-8 text-right">{v}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── 섹션 ───
function Section({
  title,
  children,
  accent,
}: {
  title: string
  children: React.ReactNode
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-xl p-3 ${
        accent ? 'bg-[var(--accent-soft)] border border-[var(--accent)]/20' : 'bg-[var(--bg-hover)]'
      }`}
    >
      <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">
        {title}
      </p>
      <div className="text-sm text-[var(--text-primary)] leading-relaxed">{children}</div>
    </div>
  )
}

// ─── 특수 태그 ───
function SpecialTag({ tag }: { tag: string }) {
  const map: Record<string, { icon: React.ReactNode; cls: string }> = {
    양변전문영역: {
      icon: <CheckCircle2 size={10} />,
      cls: 'bg-[var(--green)]/15 text-[var(--green)]',
    },
    톤주의: {
      icon: <AlertTriangle size={10} />,
      cls: 'bg-amber-500/15 text-amber-400',
    },
    검증필요: {
      icon: <Shield size={10} />,
      cls: 'bg-blue-500/15 text-blue-400',
    },
  }
  const config = map[tag] || { icon: null, cls: 'bg-[var(--bg-hover)] text-[var(--text-secondary)]' }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${config.cls}`}>
      {config.icon}
      {tag}
    </span>
  )
}

// ─── 액션 버튼 ───
function ActionBtn({
  icon,
  label,
  color,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  color: 'green' | 'amber' | 'blue' | 'red'
  active: boolean
  onClick: () => void
}) {
  const colorMap: Record<typeof color, string> = {
    green: active ? 'bg-[var(--green)] text-white' : 'hover:bg-[var(--green-soft)] hover:text-[var(--green)]',
    amber: active ? 'bg-amber-500 text-white' : 'hover:bg-amber-500/15 hover:text-amber-400',
    blue: active ? 'bg-blue-500 text-white' : 'hover:bg-blue-500/15 hover:text-blue-400',
    red: active ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]',
  }
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition bg-[var(--bg-hover)] text-[var(--text-secondary)] ${colorMap[color]}`}
    >
      {icon}
      {label}
    </button>
  )
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-64 bg-[var(--bg-card)] rounded-2xl" />
      ))}
    </div>
  )
}

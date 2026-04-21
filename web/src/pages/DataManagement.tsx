import { Fragment, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  ArrowUpDown,
  ExternalLink,
  Search,
  ChevronDown,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Video, VideoStats, Editor } from '../hooks/useSupabase'

type TypeFilter = 'all' | 'short' | 'long'
type DateFilter = 'all' | '7d' | '30d'
type SortKey = 'published_at' | 'views' | 'likes' | 'comments' | 'title'
type SortDir = 'asc' | 'desc'

interface Row extends Video {
  editor_name: string
  views: number
  likes: number
  comments: number
}

export default function DataManagement() {
  const [videos, setVideos] = useState<Video[]>([])
  const [stats, setStats] = useState<VideoStats[]>([])
  const [editors, setEditors] = useState<Editor[]>([])
  const [loading, setLoading] = useState(true)

  // 필터·정렬·검색 상태
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [editorFilter, setEditorFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('published_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // 확장·패널 상태
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editorPanel, setEditorPanel] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const [vRes, sRes, eRes] = await Promise.all([
        supabase.from('videos').select('*').order('published_at', { ascending: false }),
        supabase.from('video_stats').select('*').order('fetched_at', { ascending: true }),
        supabase.from('editors').select('*'),
      ])
      setVideos(vRes.data || [])
      setStats(sRes.data || [])
      setEditors(eRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  // 최신 stat 맵
  const latestStatMap = useMemo(() => {
    const m = new Map<string, VideoStats>()
    for (const s of [...stats].reverse()) {
      if (!m.has(s.video_id)) m.set(s.video_id, s)
    }
    return m
  }, [stats])

  const editorName = (id: number | null): string => {
    if (!id) return '미배정'
    return editors.find(e => e.id === id)?.name || '미배정'
  }

  const rows: Row[] = useMemo(() => {
    return videos.map(v => {
      const s = latestStatMap.get(v.id)
      return {
        ...v,
        editor_name: editorName(v.editor_id),
        views: s?.views || 0,
        likes: s?.likes || 0,
        comments: s?.comments || 0,
      }
    })
  }, [videos, latestStatMap, editors])

  const filtered = useMemo(() => {
    const now = Date.now()
    return rows.filter(r => {
      if (typeFilter !== 'all' && r.video_type !== typeFilter) return false
      if (editorFilter !== 'all' && r.editor_name !== editorFilter) return false
      if (dateFilter !== 'all') {
        const days = dateFilter === '7d' ? 7 : 30
        if (now - new Date(r.published_at).getTime() > days * 86400000) return false
      }
      if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [rows, typeFilter, editorFilter, dateFilter, search])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      const av: any = a[sortKey]
      const bv: any = b[sortKey]
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return arr
  }, [filtered, sortKey, sortDir])

  const avgViews = useMemo(() => {
    if (sorted.length === 0) return 0
    return sorted.reduce((a, r) => a + r.views, 0) / sorted.length
  }, [sorted])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const editorNames = ['all', ...editors.map(e => e.name), '미배정']

  if (loading) {
    return <div className="animate-pulse h-64 bg-[var(--bg-card)] rounded-2xl" />
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">데이터 관리</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            전체 영상 {videos.length}개 · 표시 {sorted.length}개
          </p>
        </div>
      </div>

      {/* 필터 바 */}
      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4 space-y-3">
        <div className="flex items-center gap-2 bg-[var(--bg-hover)] rounded-xl px-3 py-2">
          <Search size={16} className="text-[var(--text-secondary)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="제목 검색"
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <FilterGroup
            label="타입"
            value={typeFilter}
            onChange={v => setTypeFilter(v as TypeFilter)}
            options={[
              ['all', '전체'],
              ['short', '쇼츠'],
              ['long', '롱폼'],
            ]}
          />
          <div className="w-px h-5 bg-[var(--border)]" aria-hidden />
          <FilterGroup
            label="편집자"
            value={editorFilter}
            onChange={setEditorFilter}
            options={editorNames.map(n => [n, n === 'all' ? '전체' : n])}
          />
          <div className="w-px h-5 bg-[var(--border)]" aria-hidden />
          <FilterGroup
            label="기간"
            value={dateFilter}
            onChange={v => setDateFilter(v as DateFilter)}
            options={[
              ['all', '전체'],
              ['7d', '7일'],
              ['30d', '30일'],
            ]}
          />
        </div>
      </div>

      {/* 테이블 */}
      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-[var(--text-secondary)] border-b border-[var(--border)] bg-[rgba(0,0,0,0.2)]">
              <tr>
                <Th label="제목" sortKey="title" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <Th label="타입" center />
                <Th label="편집자" center />
                <Th label="업로드일" sortKey="published_at" current={sortKey} dir={sortDir} onSort={toggleSort} right />
                <Th label="조회수" sortKey="views" current={sortKey} dir={sortDir} onSort={toggleSort} right />
                <Th label="좋아요" sortKey="likes" current={sortKey} dir={sortDir} onSort={toggleSort} right />
                <Th label="댓글" sortKey="comments" current={sortKey} dir={sortDir} onSort={toggleSort} right />
                <th className="text-center py-3 px-3 w-12">링크</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const expanded = expandedId === r.id
                return (
                  <Fragment key={r.id}>
                    <tr
                      onClick={() => setExpandedId(expanded ? null : r.id)}
                      className={`border-b border-[var(--border)] cursor-pointer hover:bg-[var(--accent-glow)] transition ${
                        expanded ? 'bg-[var(--accent-glow)]' : ''
                      }`}
                    >
                      <td className="py-3 px-3 max-w-md">
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            size={14}
                            className={`text-[var(--text-secondary)] shrink-0 transition-transform ${
                              expanded ? 'rotate-180' : ''
                            }`}
                          />
                          <span className="line-clamp-1">{r.title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            r.video_type === 'short'
                              ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                              : 'bg-slate-500/15 text-slate-400'
                          }`}
                        >
                          {r.video_type === 'short' ? 'SHORT' : 'LONG'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setEditorPanel(r.editor_name)
                          }}
                          className="text-xs hover:text-[var(--accent)] transition underline-offset-2 hover:underline"
                        >
                          {r.editor_name}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-right text-[var(--text-secondary)] tabular-nums">
                        {fmtDate(r.published_at)}
                      </td>
                      <td className={`py-3 px-3 text-right tabular-nums ${
                        r.views >= avgViews
                          ? 'text-[var(--text-primary)] font-semibold'
                          : 'text-[var(--text-secondary)]'
                      }`}>{r.views.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                        {r.likes.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                        {r.comments.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <a
                          href={`https://www.youtube.com/watch?v=${r.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="inline-flex text-[var(--text-secondary)] hover:text-[var(--accent)] transition"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-[var(--border)] bg-[var(--bg-primary)]">
                        <td colSpan={8} className="p-5">
                          <RelationView row={r} stats={stats.filter(s => s.video_id === r.id)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--text-secondary)]">
                    조건에 맞는 영상이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 편집자 사이드 패널 */}
      <AnimatePresence>
        {editorPanel && (
          <EditorPanel
            name={editorPanel}
            rows={rows.filter(r => r.editor_name === editorPanel)}
            onClose={() => setEditorPanel(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── 테이블 헤더 ───
function Th({
  label,
  sortKey,
  current,
  dir,
  onSort,
  right,
  center,
}: {
  label: string
  sortKey?: SortKey
  current?: SortKey
  dir?: SortDir
  onSort?: (k: SortKey) => void
  right?: boolean
  center?: boolean
}) {
  const align = right ? 'text-right' : center ? 'text-center' : 'text-left'
  const active = sortKey && current === sortKey
  return (
    <th className={`py-3 px-3 ${align} font-medium`}>
      {sortKey && onSort ? (
        <button
          onClick={() => onSort(sortKey)}
          className={`inline-flex items-center gap-1 hover:text-[var(--text-primary)] transition ${
            active ? 'text-[var(--accent)]' : ''
          }`}
        >
          {label}
          <ArrowUpDown size={12} />
          {active && <span className="text-[10px]">{dir === 'asc' ? '↑' : '↓'}</span>}
        </button>
      ) : (
        label
      )}
    </th>
  )
}

// ─── 필터 그룹 ───
function FilterGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: [string, string][]
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-[var(--text-secondary)] mr-1">{label}</span>
      {options.map(([val, text]) => (
        <button
          key={val}
          onClick={() => onChange(val)}
          className={`px-3 py-1.5 text-xs rounded-full transition border ${
            value === val
              ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
              : 'bg-transparent border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50 hover:text-[var(--text-primary)]'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

// ─── 관계 뷰 (row 확장) ───
function RelationView({ row, stats }: { row: Row; stats: VideoStats[] }) {
  // 성과 추이 — 발행일 기준 N일차
  const pubTime = new Date(row.published_at).getTime()
  const series = stats
    .map(s => {
      const days = Math.round((new Date(s.fetched_at).getTime() - pubTime) / 86400000)
      return { day: days, views: s.views }
    })
    .filter(p => p.day >= 0)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <RelSection title="기본 정보">
        <InfoGrid
          items={[
            ['타입', row.video_type === 'short' ? '쇼츠' : '롱폼'],
            ['편집자', row.editor_name],
            ['업로드', fmtDate(row.published_at)],
          ]}
        />
      </RelSection>

      <RelSection title="성과 추이 (발행일 기준)">
        {series.length > 1 ? (
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="accentFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10 }}
                  tickFormatter={v => `${v}일`}
                />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v) => [Number(v).toLocaleString(), '조회수']}
                  labelFormatter={d => `${d}일차`}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  fill="url(#accentFill)"
                  dot={{ r: 2, fill: 'var(--accent)' }}
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyNote>추이 데이터 수집 중</EmptyNote>
        )}
      </RelSection>

      <RelSection title="원본 소스 (크롤링 연결)">
        <EmptyNote>연결 없음 — 크롤링 매칭 로직 예정</EmptyNote>
      </RelSection>

      <RelSection title="파생 콘텐츠">
        <EmptyNote>
          {row.video_type === 'long' ? '파생 쇼츠 없음' : '롱폼 전용 섹션'}
        </EmptyNote>
      </RelSection>

      <RelSection title="주제 태그">
        <EmptyNote>태깅 예정 — AI 자동 태깅 붙이면 채워집니다</EmptyNote>
      </RelSection>

      <RelSection title="리드">
        <EmptyNote>추적 장치 연결 후 표시</EmptyNote>
      </RelSection>

      <RelSection title="기획안 연결" fullWidth>
        <EmptyNote>기획안 연결 예정</EmptyNote>
      </RelSection>
    </div>
  )
}

function RelSection({
  title,
  children,
  fullWidth,
}: {
  title: string
  children: React.ReactNode
  fullWidth?: boolean
}) {
  return (
    <div
      className={`rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4 ${
        fullWidth ? 'md:col-span-2' : ''
      }`}
    >
      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
        {title}
      </p>
      {children}
    </div>
  )
}

function InfoGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map(([k, v]) => (
        <div key={k}>
          <p className="text-xs text-[var(--text-secondary)]">{k}</p>
          <p className="text-sm mt-0.5">{v}</p>
        </div>
      ))}
    </div>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-[var(--text-secondary)] italic">{children}</p>
  )
}

// ─── 편집자 사이드 패널 ───
function EditorPanel({
  name,
  rows,
  onClose,
}: {
  name: string
  rows: Row[]
  onClose: () => void
}) {
  const totalViews = rows.reduce((a, r) => a + r.views, 0)
  const totalLikes = rows.reduce((a, r) => a + r.likes, 0)
  const avgViews = rows.length ? Math.round(totalViews / rows.length) : 0
  const avgLikes = rows.length ? Math.round(totalLikes / rows.length) : 0
  const shorts = rows.filter(r => r.video_type === 'short').length
  const longs = rows.filter(r => r.video_type === 'long').length

  const recent3 = [...rows]
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    .slice(0, 3)
  const recentAvg = recent3.length
    ? Math.round(recent3.reduce((a, r) => a + r.views, 0) / recent3.length)
    : 0

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-40"
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.25 }}
        className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-[var(--bg-primary)] border-l border-[var(--border)] z-50 flex flex-col"
      >
        <header className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">{name}</h3>
            <p className="text-xs text-[var(--text-secondary)]">편집자 상세</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-hover)] transition"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 평균 성과 */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
              평균 성과
            </p>
            <div className="grid grid-cols-2 gap-3">
              <StatBox label="평균 조회수" value={avgViews.toLocaleString()} />
              <StatBox label="평균 좋아요" value={avgLikes.toLocaleString()} />
            </div>
          </div>

          {/* 포맷 분포 */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
              포맷 분포
            </p>
            <div className="grid grid-cols-2 gap-3">
              <StatBox label="쇼츠" value={`${shorts}편`} accent="accent" />
              <StatBox label="롱폼" value={`${longs}편`} accent="blue" />
            </div>
          </div>

          {/* 최근 3편 추세 */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
              최근 3편 평균 조회수
            </p>
            <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4">
              <p className="text-2xl font-bold tabular-nums">{recentAvg.toLocaleString()}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                전체 평균 대비{' '}
                <span className={recentAvg >= avgViews ? 'text-[var(--green)]' : 'text-[var(--red)]'}>
                  {avgViews ? `${Math.round(((recentAvg - avgViews) / avgViews) * 100)}%` : '—'}
                </span>
              </p>
            </div>
          </div>

          {/* 담당 영상 목록 */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
              담당 영상 ({rows.length})
            </p>
            <div className="space-y-2">
              {rows.slice(0, 30).map(r => (
                <div
                  key={r.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]"
                >
                  <p className="text-xs line-clamp-2 flex-1">{r.title}</p>
                  <span className="text-xs text-[var(--text-secondary)] tabular-nums shrink-0">
                    {r.views.toLocaleString()}
                  </span>
                </div>
              ))}
              {rows.length === 0 && (
                <p className="text-xs text-[var(--text-secondary)] italic">담당 영상 없음</p>
              )}
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  )
}

function StatBox({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'accent' | 'blue'
}) {
  const bg =
    accent === 'accent'
      ? 'bg-[var(--accent)]/10 border-[var(--accent)]/20'
      : accent === 'blue'
      ? 'bg-slate-500/10 border-slate-500/20'
      : 'bg-[var(--bg-card)] border-[var(--border)]'
  return (
    <div className={`rounded-xl border p-3 ${bg}`}>
      <p className="text-xs text-[var(--text-secondary)]">{label}</p>
      <p className="text-lg font-bold mt-1 tabular-nums">{value}</p>
    </div>
  )
}

function fmtDate(d: string) {
  return d?.slice(0, 10).replace(/-/g, '.') || ''
}

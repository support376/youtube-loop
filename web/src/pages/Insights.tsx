import { useEffect, useState, type ComponentPropsWithoutRef } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts'
import { supabase } from '../lib/supabase'
import type { WeeklyReport } from '../hooks/useSupabase'

// ─── 마크다운 파서 ───

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
  }
  if (current) sections.push(current)
  return sections.map(s => ({ title: s.title, body: s.body.join('\n').replace(/^---$/gm, '').trim() }))
}

// 마크다운 테이블에서 데이터 추출
function parseTable(md: string): { headers: string[]; rows: string[][] } {
  const lines = md.split('\n').filter(l => l.trim().startsWith('|'))
  if (lines.length < 3) return { headers: [], rows: [] }
  const parse = (line: string) => line.split('|').map(c => c.trim()).filter(Boolean)
  return { headers: parse(lines[0]), rows: lines.slice(2).map(parse) }
}

// 🔥/❄️ 인사이트 라인 추출
function extractInsights(body: string): { icon: string; text: string }[] {
  const results: { icon: string; text: string }[] = []
  for (const line of body.split('\n')) {
    const m = line.match(/^[-*]\s*(🔥|❄️|💡|⚠️|✅)\s*\*\*(.+?)\*\*(.*)/)
    if (m) {
      results.push({ icon: m[1], text: m[2] + m[3].replace(/\*\*/g, '') })
    }
  }
  return results
}

// 공통점에서 태그 추출
function extractTags(body: string): { icon: string; label: string }[] {
  const tags: { icon: string; label: string }[] = []
  const tagMap: [RegExp, string, string][] = [
    [/쇼츠|shorts/i, '🎬', '쇼츠'],
    [/질문형|의심|역설|모순/i, '❓', '질문형 제목'],
    [/생활\s*밀착|실생활|누구나/i, '🏠', '생활밀착'],
    [/이혼|재산/i, '💔', '이혼·재산'],
    [/논란|사건|인물/i, '🔥', '논란 인물'],
    [/면죄부|처벌|무죄/i, '⚖️', '면죄부 의심'],
    [/숫자|수치/i, '🔢', '숫자 포함'],
    [/갈등|상식.*반/i, '💥', '갈등 구조'],
    [/롱폼|long/i, '🎥', '롱폼'],
  ]
  for (const [re, icon, label] of tagMap) {
    if (re.test(body)) tags.push({ icon, label })
  }
  return tags.length ? tags : [{ icon: '📊', label: '분석 완료' }]
}

// 주제 테이블에서 차트 데이터 추출
function extractTopicChart(body: string): { name: string; views: number }[] {
  const { headers, rows } = parseTable(body)
  if (!headers.length) return []
  const nameIdx = headers.findIndex(h => /주제|카테고리/.test(h))
  const viewIdx = headers.findIndex(h => /조회/.test(h))
  if (nameIdx < 0 || viewIdx < 0) return []
  return rows.map(r => {
    const name = (r[nameIdx] || '').replace(/\*\*/g, '').slice(0, 10)
    const nums = (r[viewIdx] || '').match(/[\d,]+/g)
    const views = nums ? Math.max(...nums.map(n => parseInt(n.replace(/,/g, '')) || 0)) : 0
    return { name, views }
  }).filter(d => d.views > 0).sort((a, b) => b.views - a.views)
}

const CHART_COLORS = ['#ff4b4b', '#ff6b6b', '#ff8a8a', '#ffa8a8', '#ccc', '#aaa']
const RANK_COLORS = ['#ff4b4b', '#ff8a3b', '#ffc53b']

// ─── 컴포넌트 ───

interface TopVideo {
  id: string
  title: string
  thumbnail_url: string
  views: number
  likes: number
}

export default function Insights() {
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [selected, setSelected] = useState(0)
  const [loading, setLoading] = useState(true)
  const [topVideos, setTopVideos] = useState<TopVideo[]>([])

  useEffect(() => {
    const fetchData = async () => {
      const [repRes, vidRes, statsRes] = await Promise.all([
        supabase.from('weekly_reports').select('*')
          .order('week_start', { ascending: false }).limit(20),
        supabase.from('videos').select('id, title, thumbnail_url')
          .order('published_at', { ascending: false }),
        supabase.from('video_stats').select('video_id, views, likes')
          .order('fetched_at', { ascending: false }),
      ])
      setReports(repRes.data || [])

      // DB에서 실시간 TOP 3 계산
      const latestStats = new Map<string, { views: number; likes: number }>()
      for (const s of (statsRes.data || [])) {
        if (!latestStats.has(s.video_id)) latestStats.set(s.video_id, s)
      }
      const merged = (vidRes.data || []).map(v => ({
        ...v,
        views: latestStats.get(v.id)?.views || 0,
        likes: latestStats.get(v.id)?.likes || 0,
      }))
      merged.sort((a, b) => b.views - a.views)
      setTopVideos(merged.slice(0, 3))

      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) return <LoadingSkeleton />
  if (!reports.length) return <Empty />

  const report = reports[selected]
  const sections = splitSections(report.report_md || '')

  // 섹션 분류
  const topSection = sections.find(s => /TOP/.test(s.title))
  const topicSection = sections.find(s => /주제/.test(s.title))
  const titleSection = sections.find(s => /제목/.test(s.title))
  const recommendSection = sections.find(s => /추천|기획/.test(s.title))
  const otherSections = sections.filter(s =>
    s !== topSection && s !== topicSection && s !== titleSection && s !== recommendSection
  )

  const topicChartData = topicSection ? extractTopicChart(topicSection.body) : []
  const tags = topSection ? extractTags(topSection.body) : []
  const insights = topicSection ? extractInsights(topicSection.body) : []

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <h2 className="text-2xl font-bold">주간 인사이트</h2>

      {/* 기간 선택 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {reports.map((r, i) => (
          <button key={r.id} onClick={() => setSelected(i)}
            className={`px-4 py-2 text-sm rounded-full whitespace-nowrap transition ${
              i === selected ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}>
            {fmtDate(r.week_start)} ~ {fmtDate(r.week_end)}
          </button>
        ))}
      </div>

      {/* ① TOP 3 영상 카드 */}
      {topVideos.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">🏆 TOP 3 영상</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {topVideos.slice(0, 3).map((v, i) => (
              <motion.div key={v.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden group hover:border-[var(--accent)] transition"
              >
                {/* 썸네일 */}
                <div className="relative">
                  <img
                    src={v.thumbnail_url || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`}
                    alt={v.title}
                    className="w-full aspect-video object-cover"
                  />
                  <div className="absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: RANK_COLORS[i] || '#666' }}>
                    {i + 1}
                  </div>
                </div>
                {/* 정보 */}
                <div className="p-4">
                  <p className="font-medium text-sm line-clamp-2 mb-3">{v.title}</p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold tabular-nums">{v.views.toLocaleString()}</span>
                      <span className="text-xs text-[var(--text-secondary)]">조회</span>
                    </div>
                    <div className="flex items-baseline gap-1 text-[var(--text-secondary)]">
                      <span className="text-sm font-semibold tabular-nums">{v.likes.toLocaleString()}</span>
                      <span className="text-xs">좋아요</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ② 공통점 태그 */}
      {tags.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h3 className="text-lg font-semibold mb-4">🔑 공통점</h3>
          <div className="flex flex-wrap gap-3">
            {tags.map((t, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] text-sm font-medium"
              >
                <span className="text-lg">{t.icon}</span>
                {t.label}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ③ 주제별 조회수 차트 */}
      {topicChartData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-6">
          <h3 className="text-lg font-semibold mb-4">🔥 주제별 조회수</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topicChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" tickFormatter={v => v.toLocaleString()} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, fontSize: 13 }}
                  formatter={(v) => [Number(v).toLocaleString(), '조회수']}
                />
                <Bar dataKey="views" radius={[0, 8, 8, 0]} animationDuration={1200}>
                  {topicChartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i] || '#555'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* ④ 핵심 인사이트 강조 박스 */}
      {insights.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">💡 핵심 인사이트</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {insights.slice(0, 4).map((ins, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                className={`rounded-2xl p-5 border ${
                  ins.icon === '🔥' ? 'bg-[var(--accent-soft)] border-[var(--accent)]'
                    : ins.icon === '❄️' ? 'bg-blue-500/10 border-blue-500/30'
                    : 'bg-[var(--green-soft)] border-[var(--green)]/30'
                }`}
              >
                <span className="text-2xl">{ins.icon}</span>
                <p className="text-sm font-medium mt-2 leading-relaxed">{ins.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ⑤ 제목 패턴 (접기) */}
      {titleSection && (
        <motion.details initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
          <summary className="px-6 py-4 cursor-pointer hover:bg-[var(--bg-hover)] transition font-semibold flex items-center gap-2">
            <span>✍️</span> {titleSection.title}
          </summary>
          <div className="px-6 py-5 border-t border-[var(--border)]">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {titleSection.body}
            </ReactMarkdown>
          </div>
        </motion.details>
      )}

      {/* ⑥ 추천 기획 */}
      {recommendSection && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
          className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-2">
            <span className="text-xl">🎯</span>
            <h3 className="font-semibold">{recommendSection.title}</h3>
          </div>
          <div className="px-6 py-5">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {recommendSection.body}
            </ReactMarkdown>
          </div>
        </motion.div>
      )}

      {/* 기타 섹션 (접기) */}
      {otherSections.map((section, i) => (
        <details key={i} className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
          <summary className="px-6 py-4 cursor-pointer hover:bg-[var(--bg-hover)] transition font-semibold text-sm text-[var(--text-secondary)]">
            {section.title}
          </summary>
          <div className="px-6 py-5 border-t border-[var(--border)]">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {section.body}
            </ReactMarkdown>
          </div>
        </details>
      ))}
    </motion.div>
  )
}

// ─── 마크다운 커스텀 렌더러 ───

const mdComponents = {
  table: (props: ComponentPropsWithoutRef<'table'>) => (
    <div className="overflow-x-auto my-4"><table className="w-full text-sm border-collapse" {...props} /></div>
  ),
  thead: (props: ComponentPropsWithoutRef<'thead'>) => (
    <thead className="border-b border-[var(--border)]" {...props} />
  ),
  th: (props: ComponentPropsWithoutRef<'th'>) => (
    <th className="text-left p-3 text-[var(--text-secondary)] font-medium text-xs" {...props} />
  ),
  td: (props: ComponentPropsWithoutRef<'td'>) => (
    <td className="p-3 border-b border-[var(--border)] text-[var(--text-secondary)]" {...props} />
  ),
  tr: (props: ComponentPropsWithoutRef<'tr'>) => (
    <tr className="hover:bg-[var(--bg-hover)] transition" {...props} />
  ),
  hr: () => <div className="my-6 border-t border-[var(--border)]" />,
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

// ─── 유틸 ───

function fmtDate(d: string) { return d?.replace(/-/g, '.') || '' }

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-[var(--bg-card)] rounded" />
      <div className="h-12 w-64 bg-[var(--bg-card)] rounded-full" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-56 bg-[var(--bg-card)] rounded-2xl" />)}
      </div>
      <div className="h-64 bg-[var(--bg-card)] rounded-2xl" />
    </div>
  )
}

function Empty() {
  return <div className="text-center py-20 text-[var(--text-secondary)]">아직 주간 리포트가 없습니다. 매주 월요일 오전 9시에 자동 생성됩니다.</div>
}

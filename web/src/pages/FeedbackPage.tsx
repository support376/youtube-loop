import { useEffect, useState, type ComponentPropsWithoutRef } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, ChevronRight, Lightbulb } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { supabase } from '../lib/supabase'
import type { Feedback } from '../hooks/useSupabase'

interface TitlePatterns {
  [key: string]: any
  _top_formula?: string
  _boost_details?: { keyword: string; views: string; video: string }[]
  _avoid_details?: { keyword: string; views: string; reason: string }[]
  _principles?: string[]
  _recommendations?: { title: string; desc: string; example: string }[]
  _sample_count?: number
}

// ─── content_md 정리 ───

function cleanContent(raw: string): string {
  let text = raw.trim()
  if (text.startsWith('{') || text.startsWith('```')) {
    try {
      const cleaned = text.replace(/^```\w*\s*/gm, '').replace(/```\s*$/gm, '').trim()
      const parsed = JSON.parse(cleaned)
      return jsonToReadable(parsed)
    } catch { /* not JSON */ }
  }
  return text.replace(/^```\w*\s*/gm, '').replace(/```\s*$/gm, '').trim()
}

function jsonToReadable(obj: any): string {
  const lines: string[] = []
  if (obj.keywords_boost) {
    lines.push('## 우선 주제')
    const items = Array.isArray(obj.keywords_boost) ? obj.keywords_boost : []
    for (const item of items) {
      lines.push(typeof item === 'string' ? `- ${item}` : `- **${item.keyword}** — ${item.views}뷰`)
    }
  }
  if (obj.keywords_avoid) {
    lines.push('## 회피 주제')
    const items = Array.isArray(obj.keywords_avoid) ? obj.keywords_avoid : []
    for (const item of items) {
      lines.push(typeof item === 'string' ? `- ${item}` : `- **${item.keyword}** — ${item.reason || ''}`)
    }
  }
  if (obj.content_md) lines.push(`\n${obj.content_md}`)
  return lines.join('\n\n') || JSON.stringify(obj, null, 2)
}

// ─── 마크다운 렌더러 ───

const mdComponents = {
  h2: (props: ComponentPropsWithoutRef<'h2'>) => <h2 className="text-lg font-semibold mt-5 mb-2 text-[var(--text-primary)]" {...props} />,
  h3: (props: ComponentPropsWithoutRef<'h3'>) => <h3 className="text-base font-semibold mt-4 mb-2 text-[var(--text-primary)]" {...props} />,
  p: (props: ComponentPropsWithoutRef<'p'>) => <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-3" {...props} />,
  strong: (props: ComponentPropsWithoutRef<'strong'>) => <strong className="text-[var(--text-primary)] font-semibold" {...props} />,
  li: (props: ComponentPropsWithoutRef<'li'>) => <li className="text-sm text-[var(--text-secondary)] mb-1.5" {...props} />,
  ul: (props: ComponentPropsWithoutRef<'ul'>) => <ul className="pl-5 my-2 list-disc" {...props} />,
  hr: () => <div className="my-4 border-t border-[var(--border)]" />,
  blockquote: (props: ComponentPropsWithoutRef<'blockquote'>) => <blockquote className="border-l-3 border-[var(--accent)] pl-4 my-3 italic text-[var(--text-secondary)]" {...props} />,
}

// ─── 메인 ───

export default function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from('feedback').select('*')
        .order('created_at', { ascending: false }).limit(20)
      setFeedbacks(data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) return <LoadingSkeleton />
  if (!feedbacks.length) {
    return <div className="text-center py-20 text-[var(--text-secondary)]">아직 피드백이 없습니다.</div>
  }

  // 날짜별 dedup
  const seen = new Set<string>()
  const deduped = feedbacks.filter(fb => {
    const date = fb.created_at?.slice(0, 10) || ''
    if (seen.has(date)) return false
    seen.add(date)
    return true
  })

  const latest = deduped[0]
  const boost = latest.keywords_boost || []
  const avoid = latest.keywords_avoid || []
  const tp = (latest.title_patterns || {}) as TitlePatterns
  const patternCategories = Object.entries(tp).filter(([k]) => !k.startsWith('_')) as [string, string[]][]
  const formula = tp._top_formula || ''
  const boostDetails = tp._boost_details || []
  const avoidDetails = tp._avoid_details || []
  const principles = tp._principles || []
  const sampleCount = tp._sample_count || 0
  const contentMd = cleanContent(latest.content_md || '')
  const updatedAt = fmtDate(latest.created_at)

  const handleCopy = async () => {
    const boostLines = boostDetails.length
      ? boostDetails.map(b => `- ${b.keyword} — ${b.views}뷰 (${b.video || ''})`).join('\n')
      : boost.map(k => `- ${k}`).join('\n') || '- 없음'

    const avoidLines = avoidDetails.length
      ? avoidDetails.map(a => `- ${a.keyword} — ${a.views}뷰, ${a.reason || ''}`).join('\n')
      : avoid.map(k => `- ${k}`).join('\n') || '- 없음'

    const patternLines = patternCategories
      .map(([cat, examples]) => `- ${cat}: ${(examples || []).join(' / ')}`)
      .join('\n') || '- 없음'

    const principleLines = principles.length
      ? principles.map(p => `- ${p}`).join('\n')
      : '- 없음'

    const text = `# YouTube Loop 성과 피드백 (매주 갱신)
# 마지막 업데이트: ${updatedAt}
# 샘플: ${sampleCount}개 영상 기반

## 우선 주제
${boostLines}

## 회피 주제 (주제 자체가 아니라 타이밍·각도 문제일 수 있음)
${avoidLines}

## 잘 되는 제목 공식
${patternLines}

## 운영 원칙
${principleLines}

토픽 선정 시 위 성과 데이터 반영해서 우선순위 조정할 것.`

    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">기획 규칙</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            마지막 업데이트: {updatedAt} · 샘플 {sampleCount}개 영상
          </p>
        </div>
        <button onClick={handleCopy}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition shrink-0">
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? '복사 완료!' : '지침 복사'}
        </button>
      </div>

      {/* 상단 배너 */}
      {formula && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-r from-[var(--accent)]/20 to-[var(--accent)]/5 border border-[var(--accent)]/30 p-5">
          <p className="text-xs text-[var(--accent)] font-semibold mb-1">이번 주 공식</p>
          <p className="text-lg font-bold">{formula}</p>
        </motion.div>
      )}

      {/* DO / DON'T 2칸 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ✅ DO */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl bg-[var(--bg-card)] border border-[var(--green)]/30 overflow-hidden">
          <div className="px-5 py-4 bg-[var(--green-soft)] border-b border-[var(--green)]/20">
            <h3 className="font-bold text-[var(--green)]">✅ 이렇게 하세요</h3>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs text-[var(--text-secondary)] mb-2 uppercase tracking-wide font-semibold">우선 주제</p>
              <div className="space-y-2">
                {(boostDetails.length ? boostDetails : boost.map(k => ({ keyword: k, views: '', video: '' }))).map((b, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-hover)]">
                    <span className="px-3 py-1 text-sm rounded-full bg-[var(--green)]/15 text-[var(--green)] font-medium">
                      {typeof b === 'string' ? b : b.keyword}
                    </span>
                    {typeof b !== 'string' && b.views && (
                      <span className="text-xs text-[var(--text-secondary)]">{b.views}뷰</span>
                    )}
                  </div>
                ))}
                {!boost.length && <span className="text-sm text-[var(--text-secondary)]">데이터 수집 중</span>}
              </div>
            </div>
            {patternCategories.length > 0 && (
              <div>
                <p className="text-xs text-[var(--text-secondary)] mb-2 uppercase tracking-wide font-semibold">제목 공식</p>
                <div className="space-y-2">
                  {patternCategories.map(([cat, examples]) => (
                    <div key={cat} className="p-3 rounded-xl bg-[var(--bg-hover)]">
                      <p className="text-xs font-semibold text-[var(--green)] mb-1">{cat}</p>
                      {(examples || []).map((ex: string, i: number) => (
                        <p key={i} className="text-sm text-[var(--text-secondary)] italic">"{ex}"</p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* ❌ DON'T */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
          className="rounded-2xl bg-[var(--bg-card)] border border-[var(--red)]/30 overflow-hidden">
          <div className="px-5 py-4 bg-[var(--red-soft)] border-b border-[var(--red)]/20">
            <h3 className="font-bold text-[var(--red)]">❌ 이건 피하세요</h3>
          </div>
          <div className="p-5 space-y-3">
            {(avoidDetails.length ? avoidDetails : avoid.map(k => ({ keyword: k, views: '', reason: '' }))).map((item, i) => (
              <div key={i} className="p-3 rounded-xl bg-[var(--bg-hover)]">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 text-xs rounded-full bg-[var(--red)]/15 text-[var(--red)] font-medium">
                    {typeof item === 'string' ? item : item.keyword}
                  </span>
                  {typeof item !== 'string' && item.views && (
                    <span className="text-xs text-[var(--red)] font-medium">{item.views}뷰</span>
                  )}
                </div>
                {typeof item !== 'string' && item.reason && (
                  <p className="text-xs text-[var(--text-secondary)] mt-2">{item.reason}</p>
                )}
              </div>
            ))}
            {!avoid.length && <span className="text-sm text-[var(--text-secondary)]">없음</span>}
            {avoid.length > 0 && (
              <p className="text-xs text-[var(--text-secondary)] mt-2 px-1 italic">
                ⚠️ 주제 자체가 아니라 타이밍·제목·각도 문제일 수 있음 (샘플 {sampleCount}개)
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {/* 💡 운영 원칙 */}
      {principles.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb size={18} className="text-amber-400" />
            <h3 className="font-semibold">운영 원칙</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {principles.map((p, i) => (
              <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <span className="text-amber-400 text-sm font-bold shrink-0">{i + 1}</span>
                <p className="text-sm text-[var(--text-secondary)]">{p}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* 아코디언 */}
      <div className="space-y-3">
        <Accordion title="전체 원문 보기" icon="📄">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {contentMd}
          </ReactMarkdown>
        </Accordion>
      </div>

      {/* 과거 규칙 */}
      {deduped.length > 1 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">과거 규칙</h3>
          <div className="space-y-3">
            {deduped.slice(1).map(fb => (
              <Accordion key={fb.id} title={`${fmtDate(fb.created_at)} (${fb.period || 'weekly'})`} icon="📋">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {cleanContent(fb.content_md || '')}
                </ReactMarkdown>
              </Accordion>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

function Accordion({ title, icon, children, defaultOpen = false }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  return (
    <details open={defaultOpen}
      className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden group">
      <summary className="px-6 py-4 cursor-pointer hover:bg-[var(--bg-hover)] transition flex items-center gap-3">
        <ChevronRight size={16} className="text-[var(--text-secondary)] transition-transform group-open:rotate-90" />
        <span className="text-lg">{icon}</span>
        <span className="font-semibold text-sm">{title}</span>
      </summary>
      <div className="px-6 py-5 border-t border-[var(--border)]">{children}</div>
    </details>
  )
}

function fmtDate(d: string) { return d?.slice(0, 10).replace(/-/g, '.') || '' }

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-[var(--bg-card)] rounded" />
      <div className="h-16 bg-[var(--bg-card)] rounded-2xl" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-64 bg-[var(--bg-card)] rounded-2xl" />
        <div className="h-64 bg-[var(--bg-card)] rounded-2xl" />
      </div>
    </div>
  )
}

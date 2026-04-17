import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, Target, Ban, FileText, Lightbulb, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Feedback } from '../hooks/useSupabase'

// ─── 피드백 파싱 ───

function cleanMd(raw: string): string {
  return raw.replace(/^```\s*/gm, '').replace(/```\s*$/gm, '').replace(/^---$/gm, '').trim()
}

function extractTitlePatterns(content: string): string[] {
  const patterns: string[] = []
  const lines = content.split('\n')
  for (const line of lines) {
    // "~하면 무죄인가요?" 같은 따옴표 패턴
    const quotes = line.match(/"([^"]+)"/g)
    if (quotes) {
      for (const q of quotes) patterns.push(q.replace(/"/g, ''))
    }
    // ❓ / 😤 / 🔍 패턴 라인
    const emoji = line.match(/^[-*]\s*(❓|😤|🔍|✅|📝)\s*(.+)/)
    if (emoji) patterns.push(emoji[2].split('→')[0].trim())
  }
  return [...new Set(patterns)].slice(0, 6)
}

function extractPrinciples(content: string): string[] {
  const principles: string[] = []
  const lines = content.split('\n')
  let inMemo = false
  for (const line of lines) {
    if (/💡\s*운영|핵심|원칙|메모/.test(line)) { inMemo = true; continue }
    if (inMemo && /^\[/.test(line.trim())) break
    if (inMemo && line.trim().startsWith('-')) {
      principles.push(line.trim().replace(/^-\s*/, ''))
    }
  }
  // 폴백: 🔥/💡 있는 줄 추출
  if (!principles.length) {
    for (const line of lines) {
      if (/^[-*]\s*(🔥|💡|⚠️)/.test(line.trim())) {
        principles.push(line.trim().replace(/^[-*]\s*/, ''))
      }
    }
  }
  return principles.slice(0, 4)
}

function extractRecommendations(content: string): { title: string; desc: string; example: string }[] {
  const recs: { title: string; desc: string; example: string }[] = []
  const lines = content.split('\n')
  let current: { title: string; desc: string; example: string } | null = null

  for (const line of lines) {
    const recMatch = line.match(/^-\s*추천\s*\d+[:：]\s*(.+)/)
    if (recMatch) {
      if (current) recs.push(current)
      current = { title: recMatch[1], desc: '', example: '' }
      continue
    }
    if (current) {
      if (/^→\s*제목 예시|^→\s*"/.test(line.trim())) {
        current.example = line.trim().replace(/^→\s*제목 예시[:：]?\s*/, '').replace(/^→\s*/, '')
      } else if (/^→/.test(line.trim())) {
        current.desc += (current.desc ? ' ' : '') + line.trim().replace(/^→\s*/, '')
      }
    }
  }
  if (current) recs.push(current)
  return recs.slice(0, 3)
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
        .order('created_at', { ascending: false }).limit(10)
      setFeedbacks(data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) return <LoadingSkeleton />
  if (!feedbacks.length) {
    return <div className="text-center py-20 text-[var(--text-secondary)]">아직 피드백이 없습니다. 매주 월요일 오전 9:30에 자동 생성됩니다.</div>
  }

  const latest = feedbacks[0]
  const content = cleanMd(latest.content_md || '')
  const boost = latest.keywords_boost || []
  const avoid = latest.keywords_avoid || []
  const titlePatterns = extractTitlePatterns(content)
  const principles = extractPrinciples(content)
  const recommendations = extractRecommendations(content)
  const updatedAt = fmtDate(latest.created_at)

  const handleCopy = async () => {
    const text = `# YouTube Loop 성과 피드백 (매주 갱신)
# 마지막 업데이트: ${updatedAt}

## 우선 주제
${boost.length ? boost.map(k => `- ${k}`).join('\n') : '- 없음'}

## 회피 주제
${avoid.length ? avoid.map(k => `- ${k}`).join('\n') : '- 없음'}

## 잘 되는 제목 공식
${titlePatterns.length ? titlePatterns.map(p => `- ${p}`).join('\n') : '- 없음'}

## 운영 원칙
${principles.length ? principles.map(p => `- ${p}`).join('\n') : '- 없음'}

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
          <p className="text-sm text-[var(--text-secondary)] mt-1">마지막 업데이트: {updatedAt}</p>
        </div>
        <button onClick={handleCopy}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition shrink-0">
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? '복사 완료!' : '지침 복사'}
        </button>
      </div>

      {/* ① 핵심 규칙 카드 4개 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <RuleCard
          icon={<Target size={20} className="text-[var(--green)]" />}
          title="우선 주제"
          color="green"
          items={boost}
          emptyText="키워드 없음"
          delay={0}
        />
        <RuleCard
          icon={<Ban size={20} className="text-[var(--accent)]" />}
          title="회피 주제"
          color="red"
          items={avoid}
          emptyText="키워드 없음"
          delay={0.1}
        />
        <RuleCard
          icon={<FileText size={20} className="text-blue-400" />}
          title="제목 공식"
          color="blue"
          items={titlePatterns}
          emptyText="패턴 분석 중"
          delay={0.2}
        />
        <RuleCard
          icon={<Lightbulb size={20} className="text-amber-400" />}
          title="핵심 원칙"
          color="amber"
          items={principles}
          emptyText="원칙 추출 중"
          delay={0.3}
        />
      </div>

      {/* 복사 프리뷰 */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">지침 복사 미리보기</p>
          <div className="flex gap-4 text-xs text-[var(--text-secondary)]">
            <span>✅ 우선 {boost.length}개</span>
            <span>❌ 회피 {avoid.length}개</span>
            <span>✍️ 제목 {titlePatterns.length}개</span>
            <span>💡 원칙 {principles.length}개</span>
          </div>
        </div>
      </motion.div>

      {/* ② 상세 아코디언 */}
      <div className="space-y-3">
        {/* 다음 기획 추천 */}
        {recommendations.length > 0 && (
          <Accordion title="다음 기획 추천" icon="🎯" defaultOpen delay={0.5}>
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <div key={i} className="p-4 rounded-xl bg-[var(--bg-hover)]">
                  <div className="flex items-start gap-3">
                    <span className="text-[var(--accent)] font-bold text-lg">{i + 1}</span>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{rec.title}</p>
                      {rec.desc && <p className="text-xs text-[var(--text-secondary)] mt-1">{rec.desc}</p>}
                      {rec.example && (
                        <p className="text-xs mt-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] italic text-[var(--text-secondary)]">
                          {rec.example}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Accordion>
        )}

        {/* 제목 패턴 예시 */}
        {titlePatterns.length > 0 && (
          <Accordion title="제목 패턴 예시" icon="✍️" delay={0.6}>
            <div className="space-y-2">
              {titlePatterns.map((p, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-hover)]">
                  <span className="text-xs text-[var(--text-secondary)] w-6 text-right">{i + 1}</span>
                  <p className="text-sm">{p}</p>
                </div>
              ))}
            </div>
          </Accordion>
        )}

        {/* 핵심 원칙 상세 */}
        {principles.length > 0 && (
          <Accordion title="운영 원칙 상세" icon="💡" delay={0.7}>
            <div className="space-y-2">
              {principles.map((p, i) => (
                <div key={i} className="flex items-start gap-3 p-3">
                  <Lightbulb size={14} className="text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{p}</p>
                </div>
              ))}
            </div>
          </Accordion>
        )}

        {/* 전체 원문 */}
        <Accordion title="전체 원문 보기" icon="📄" delay={0.8}>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{content}</p>
        </Accordion>
      </div>

      {/* ③ 과거 피드백 */}
      {feedbacks.length > 1 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">과거 규칙</h3>
          <div className="space-y-3">
            {feedbacks.slice(1).map(fb => (
              <Accordion key={fb.id} title={`${fmtDate(fb.created_at)} (${fb.period || 'weekly'})`} icon="📋">
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                  {cleanMd(fb.content_md || '')}
                </p>
              </Accordion>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ─── 서브 컴포넌트 ───

function RuleCard({ icon, title, color, items, emptyText, delay }: {
  icon: React.ReactNode; title: string; color: string; items: string[]; emptyText: string; delay: number
}) {
  const bgMap: Record<string, string> = {
    green: 'bg-[var(--green-soft)]', red: 'bg-[var(--accent-soft)]',
    blue: 'bg-blue-500/10', amber: 'bg-amber-500/10',
  }
  const tagMap: Record<string, string> = {
    green: 'bg-[var(--green)]/20 text-[var(--green)]', red: 'bg-[var(--accent)]/20 text-[var(--accent)]',
    blue: 'bg-blue-500/20 text-blue-400', amber: 'bg-amber-500/20 text-amber-400',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={`rounded-2xl border border-[var(--border)] p-5 ${bgMap[color] || 'bg-[var(--bg-card)]'}`}
    >
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.slice(0, 5).map((item, i) => (
            <span key={i} className={`px-2.5 py-1 text-xs rounded-full font-medium ${tagMap[color] || ''}`}>
              {item.length > 20 ? item.slice(0, 20) + '…' : item}
            </span>
          ))}
          {items.length > 5 && (
            <span className="px-2.5 py-1 text-xs rounded-full bg-[var(--bg-hover)] text-[var(--text-secondary)]">
              +{items.length - 5}
            </span>
          )}
        </div>
      ) : (
        <p className="text-xs text-[var(--text-secondary)]">{emptyText}</p>
      )}
    </motion.div>
  )
}

function Accordion({ title, icon, children, defaultOpen = false, delay = 0 }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean; delay?: number
}) {
  return (
    <motion.details
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay }}
      open={defaultOpen}
      className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden group"
    >
      <summary className="px-6 py-4 cursor-pointer hover:bg-[var(--bg-hover)] transition flex items-center gap-3">
        <ChevronRight size={16} className="text-[var(--text-secondary)] transition-transform group-open:rotate-90" />
        <span className="text-lg">{icon}</span>
        <span className="font-semibold text-sm">{title}</span>
      </summary>
      <div className="px-6 py-5 border-t border-[var(--border)]">
        {children}
      </div>
    </motion.details>
  )
}

function fmtDate(d: string) { return d?.slice(0, 10).replace(/-/g, '.') || '' }

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-[var(--bg-card)] rounded" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-[var(--bg-card)] rounded-2xl" />)}
      </div>
      {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-[var(--bg-card)] rounded-2xl" />)}
    </div>
  )
}

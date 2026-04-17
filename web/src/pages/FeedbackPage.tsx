import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Feedback } from '../hooks/useSupabase'

export default function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
      setFeedbacks(data || [])
      setLoading(false)
    }
    fetch()
  }, [])

  if (loading) return <div className="animate-pulse h-64 bg-[var(--bg-card)] rounded-2xl" />

  if (!feedbacks.length) {
    return (
      <div className="text-center py-20 text-[var(--text-secondary)]">
        아직 피드백이 없습니다. 매주 월요일 오전 9:30에 자동 생성됩니다.
      </div>
    )
  }

  const latest = feedbacks[0]
  const boost = latest.keywords_boost || []
  const avoid = latest.keywords_avoid || []

  const handleCopy = async () => {
    await navigator.clipboard.writeText(latest.content_md || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">피드백 루프</h2>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? '복사 완료!' : '코워크에 복사'}
        </button>
      </div>

      {/* 최신 피드백 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-[var(--text-secondary)]">
            생성일: {fmtDate(latest.created_at)}
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-[var(--green-soft)] text-[var(--green)]">
            최신
          </span>
        </div>
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
          {latest.content_md}
        </div>
      </motion.div>

      {/* 키워드 */}
      {(boost.length > 0 || avoid.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {boost.length > 0 && (
            <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5">
              <h3 className="text-sm font-semibold mb-3 text-[var(--green)]">성과 좋은 키워드</h3>
              <div className="flex flex-wrap gap-2">
                {boost.map(k => (
                  <span key={k} className="px-3 py-1 text-xs rounded-full bg-[var(--green-soft)] text-[var(--green)]">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
          {avoid.length > 0 && (
            <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5">
              <h3 className="text-sm font-semibold mb-3 text-[var(--accent)]">부진 키워드</h3>
              <div className="flex flex-wrap gap-2">
                {avoid.map(k => (
                  <span key={k} className="px-3 py-1 text-xs rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 과거 피드백 */}
      {feedbacks.length > 1 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">과거 피드백</h3>
          <div className="space-y-3">
            {feedbacks.slice(1).map(fb => (
              <details
                key={fb.id}
                className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden"
              >
                <summary className="p-4 cursor-pointer hover:bg-[var(--bg-hover)] transition text-sm">
                  {fmtDate(fb.created_at)} ({fb.period || 'weekly'})
                </summary>
                <div className="p-4 pt-0 text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
                  {fb.content_md}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

function fmtDate(d: string) {
  return d?.slice(0, 10).replace(/-/g, '.') || ''
}

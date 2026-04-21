import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Copy,
  Check,
  Newspaper,
  MessageCircle,
  ChevronDown,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

interface NewsItem {
  id: string
  title: string
  url: string
  source: string
  source_type: string
  section: string
  keyword: string
  freshness: string
  pub_date: string
  body: string
}

interface CommunityItem {
  id: string
  title: string
  url: string
  platform: string
  freshness: string
  post_date: string
  body: string
}

function today() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

type Toast = { type: 'success' | 'error' | 'info'; message: string }

export default function Crawling() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [community, setCommunity] = useState<CommunityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(today())
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<'news' | 'community'>('news')
  const [triggering, setTriggering] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (t: Toast, durationMs = 4000) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(t)
    toastTimer.current = setTimeout(() => setToast(null), durationMs)
  }

  const fetchForDate = async (d: string) => {
    setLoading(true)
    const [nRes, cRes] = await Promise.all([
      supabase
        .from('crawled_news')
        .select('id, title, url, source, source_type, section, keyword, freshness, pub_date, body')
        .eq('crawl_date', d)
        .order('created_at', { ascending: false }),
      supabase
        .from('crawled_community')
        .select('id, title, url, platform, freshness, post_date, body')
        .eq('crawl_date', d)
        .order('created_at', { ascending: false }),
    ])
    setNews(dedupByUrl(nRes.data || []))
    setCommunity(dedupByUrl(cRes.data || []))
    setLoading(false)
  }

  const countForDate = async (d: string): Promise<number> => {
    const [n, c] = await Promise.all([
      supabase.from('crawled_news').select('*', { count: 'exact', head: true }).eq('crawl_date', d),
      supabase.from('crawled_community').select('*', { count: 'exact', head: true }).eq('crawl_date', d),
    ])
    return (n.count ?? 0) + (c.count ?? 0)
  }

  useEffect(() => {
    fetchForDate(date)
  }, [date])

  const runCrawl = async () => {
    const todayStr = today()
    const baseline = await countForDate(todayStr)

    if (baseline > 0) {
      const ok = window.confirm(
        `오늘 데이터가 이미 ${baseline}건 있습니다. 다시 실행할까요?`,
      )
      if (!ok) return
    }

    setTriggering(true)
    try {
      const resp = await fetch('/api/trigger-crawl', { method: 'POST' })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.message || err.error || `HTTP ${resp.status}`)
      }

      showToast({ type: 'info', message: '크롤러 실행됨 · 완료까지 2~3분 걸려요' }, 6000)

      // 폴링: 5초 간격 × 최대 36회 (3분)
      const maxAttempts = 36
      let attempts = 0
      const poll = async () => {
        attempts += 1
        try {
          const current = await countForDate(todayStr)
          if (current > baseline) {
            if (date !== todayStr) setDate(todayStr) // effect가 재조회
            else await fetchForDate(todayStr)
            showToast({
              type: 'success',
              message: `크롤링 완료 · ${current - baseline}건 추가됨`,
            })
            setTriggering(false)
            return
          }
        } catch {
          // 폴링 실패는 무시하고 재시도
        }

        if (attempts >= maxAttempts) {
          showToast({
            type: 'error',
            message: '아직 완료되지 않았어요. 잠시 후 새로고침 해보세요.',
          }, 6000)
          setTriggering(false)
          return
        }
        setTimeout(poll, 5000)
      }
      setTimeout(poll, 5000)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      showToast({ type: 'error', message: `실패: ${message}` }, 6000)
      setTriggering(false)
    }
  }

  const handleCopy = async () => {
    const newsText = news.map((n, i) => {
      const bodyPreview = (n.body || '').slice(0, 500)
      return `${i + 1}. [${n.source_type}${n.section ? '/' + n.section : ''}${n.keyword ? '/' + n.keyword : ''}] ${n.title}\n출처: ${n.source || '-'} | ${fmtTime(n.pub_date)} | ${n.freshness || ''}\nURL: ${n.url}\n본문:\n${bodyPreview}${(n.body || '').length > 500 ? '...' : ''}`
    }).join('\n\n---\n\n')

    const commText = community.map((c, i) => {
      const bodyPreview = (c.body || '').slice(0, 500)
      return `${i + 1}. [${c.platform}] ${c.title}\n${fmtTime(c.post_date)} | ${c.freshness || ''}\nURL: ${c.url}\n본문:\n${bodyPreview}${(c.body || '').length > 500 ? '...' : ''}`
    }).join('\n\n---\n\n')

    const full = `📰 오늘의 뉴스 (${news.length}건)\n${'='.repeat(40)}\n\n${newsText}\n\n\n💬 오늘의 커뮤니티 (${community.length}건)\n${'='.repeat(40)}\n\n${commText}`

    await navigator.clipboard.writeText(full)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const totalCount = news.length + community.length
  const freshCount = [...news, ...community].filter(i => i.freshness === '신선').length

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">오늘의 크롤링</h2>
        <div className="flex flex-wrap items-center gap-3">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
          <button onClick={runCrawl} disabled={triggering}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition disabled:opacity-60">
            {triggering
              ? <Loader2 size={16} className="animate-spin" />
              : <RefreshCw size={16} />}
            {triggering ? '크롤링 중...' : '크롤링 실행'}
          </button>
          <button onClick={handleCopy} disabled={totalCount === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--bg-hover)] transition disabled:opacity-40">
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? '복사 완료!' : '전문 복사'}
          </button>
        </div>
      </div>

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
                : toast.type === 'error'
                ? 'bg-[var(--red-soft)] border-[var(--red)]/30 text-[var(--red)]'
                : 'bg-[var(--accent-soft)] border-[var(--accent)]/30 text-[var(--accent)]'
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4">
          <p className="text-sm text-[var(--text-secondary)]">총 수집</p>
          <p className="text-2xl font-bold">{totalCount}<span className="text-sm font-normal text-[var(--text-secondary)]"> 건</span></p>
        </div>
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4">
          <p className="text-sm text-[var(--text-secondary)]">신선 (24h)</p>
          <p className="text-2xl font-bold text-[var(--green)]">{freshCount}<span className="text-sm font-normal text-[var(--text-secondary)]"> 건</span></p>
        </div>
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-4">
          <p className="text-sm text-[var(--text-secondary)]">날짜</p>
          <p className="text-lg font-bold">{date.replace(/-/g, '.')}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('news')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-full transition ${
            tab === 'news' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
          }`}>
          <Newspaper size={16} /> 뉴스 ({news.length})
        </button>
        <button onClick={() => setTab('community')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-full transition ${
            tab === 'community' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
          }`}>
          <MessageCircle size={16} /> 커뮤니티 ({community.length})
        </button>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-[var(--bg-card)] rounded-2xl" />)}
        </div>
      ) : tab === 'news' ? (
        <NewsList items={news} />
      ) : (
        <CommunityList items={community} />
      )}
    </motion.div>
  )
}

function NewsList({ items }: { items: NewsItem[] }) {
  if (!items.length) return <div className="text-center py-12 text-[var(--text-secondary)]">해당 날짜에 뉴스 데이터가 없습니다.</div>

  const popular = items.filter(n => n.source_type === '인기')
  const keyword = items.filter(n => n.source_type === '키워드')

  return (
    <div className="space-y-6">
      {popular.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wide">인기 섹션 ({popular.length})</h3>
          <div className="space-y-2">
            {popular.map((n, i) => <NewsCard key={n.id} item={n} index={i} />)}
          </div>
        </div>
      )}
      {keyword.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wide">키워드 검색 ({keyword.length})</h3>
          <div className="space-y-2">
            {keyword.map((n, i) => <NewsCard key={n.id} item={n} index={i} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function NewsCard({ item, index }: { item: NewsItem; index: number }) {
  const [open, setOpen] = useState(false)
  const hasBody = item.body && item.body.length > 10

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden hover:border-[var(--accent)] transition"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              className="font-medium text-sm hover:text-[var(--accent)] transition line-clamp-2">
              {item.title}
            </a>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-[var(--text-secondary)]">
              {item.section && <span className="px-2 py-0.5 rounded-full bg-[var(--bg-hover)]">{item.section}</span>}
              {item.keyword && <span className="px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">{item.keyword}</span>}
              {item.source && <span>{item.source}</span>}
              <span>{fmtTime(item.pub_date)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <FreshBadge freshness={item.freshness} />
            {hasBody && (
              <button onClick={() => setOpen(!open)}
                className="p-1 rounded-lg hover:bg-[var(--bg-hover)] transition">
                <ChevronDown size={16} className={`text-[var(--text-secondary)] transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </div>
      {open && hasBody && (
        <div className="px-4 pb-4 border-t border-[var(--border)] pt-3">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
            {item.body}
          </p>
        </div>
      )}
    </motion.div>
  )
}

function CommunityList({ items }: { items: CommunityItem[] }) {
  if (!items.length) return <div className="text-center py-12 text-[var(--text-secondary)]">해당 날짜에 커뮤니티 데이터가 없습니다.</div>

  const platforms = [...new Set(items.map(c => c.platform))]

  return (
    <div className="space-y-6">
      {platforms.map(platform => {
        const group = items.filter(c => c.platform === platform)
        return (
          <div key={platform}>
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wide">{platform} ({group.length})</h3>
            <div className="space-y-2">
              {group.map((c, i) => <CommunityCard key={c.id} item={c} index={i} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CommunityCard({ item, index }: { item: CommunityItem; index: number }) {
  const [open, setOpen] = useState(false)
  const hasBody = item.body && item.body.length > 10

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden hover:border-[var(--accent)] transition"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              className="font-medium text-sm hover:text-[var(--accent)] transition line-clamp-2">
              {item.title}
            </a>
            <p className="text-xs text-[var(--text-secondary)] mt-2">{fmtTime(item.post_date)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <FreshBadge freshness={item.freshness} />
            {hasBody && (
              <button onClick={() => setOpen(!open)}
                className="p-1 rounded-lg hover:bg-[var(--bg-hover)] transition">
                <ChevronDown size={16} className={`text-[var(--text-secondary)] transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </div>
      {open && hasBody && (
        <div className="px-4 pb-4 border-t border-[var(--border)] pt-3">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
            {item.body}
          </p>
        </div>
      )}
    </motion.div>
  )
}

function FreshBadge({ freshness }: { freshness: string }) {
  if (freshness === '신선') return <span className="shrink-0 px-2.5 py-1 text-xs rounded-full bg-[var(--green-soft)] text-[var(--green)] font-medium">신선</span>
  if (freshness) return <span className="shrink-0 px-2.5 py-1 text-xs rounded-full bg-[var(--bg-hover)] text-[var(--text-secondary)]">{freshness}</span>
  return null
}

function dedupByUrl<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter(item => {
    if (seen.has(item.url)) return false
    seen.add(item.url)
    return true
  })
}

function fmtTime(d: string | null) {
  if (!d) return ''
  try {
    const dt = new Date(d)
    return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
  } catch { return d.slice(0, 16).replace('T', ' ') }
}

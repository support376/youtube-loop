import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Play } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Video, VideoStats } from '../hooks/useSupabase'
import AnimatedBar from '../components/AnimatedBar'
import VideoEmbed from '../components/VideoEmbed'

type TypeFilter = 'all' | 'short' | 'long'

export default function Videos() {
  const [videos, setVideos] = useState<Video[]>([])
  const [stats, setStats] = useState<VideoStats[]>([])
  const [loading, setLoading] = useState(true)
  const [embedId, setEmbedId] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

  useEffect(() => {
    const fetch = async () => {
      const [vRes, sRes] = await Promise.all([
        supabase.from('videos').select('*').order('published_at', { ascending: false }),
        supabase.from('video_stats').select('*').order('fetched_at', { ascending: false }),
      ])
      setVideos(vRes.data || [])
      setStats(sRes.data || [])
      setLoading(false)
    }
    fetch()
  }, [])

  if (loading) return <div className="animate-pulse h-64 bg-[var(--bg-card)] rounded-2xl" />

  const latestStats = new Map<string, VideoStats>()
  stats.forEach(s => { if (!latestStats.has(s.video_id)) latestStats.set(s.video_id, s) })

  const merged = videos.map(v => {
    const s = latestStats.get(v.id)
    return { ...v, views: s?.views || 0, likes: s?.likes || 0, comments: s?.comments || 0 }
  })

  // 순위 매기기 (전체 기준)
  const ranked = [...merged].sort((a, b) => b.views - a.views)
  const rankMap = new Map(ranked.map((v, i) => [v.id, i + 1]))

  // 유형 필터 적용
  const filtered = typeFilter === 'all' ? merged : merged.filter(v => v.video_type === typeFilter)
  const shortCount = merged.filter(v => v.video_type === 'short').length
  const longCount = merged.filter(v => v.video_type === 'long').length

  // TOP 10 바 차트
  const top10 = [...filtered].sort((a, b) => b.views - a.views).slice(0, 10)
  const top3Ids = new Set(top10.slice(0, 3).map(v => v.id))
  const barItems = [...top10].reverse().map(v => ({
    label: v.title.slice(0, 25),
    value: v.views,
    isTop3: top3Ids.has(v.id),
  }))
  const maxValue = Math.max(...barItems.map(b => b.value), 1)

  // 제목 패턴
  const questionRe = /\?|일까|인가|할까|인지|나요/
  const numberRe = /\d+/
  const warningRe = /주의|경고|위험|조심|충격|논란|폭로/
  const patterns = [
    { name: '질문형', items: filtered.filter(v => questionRe.test(v.title)) },
    { name: '숫자 포함', items: filtered.filter(v => numberRe.test(v.title)) },
    { name: '경고/논란형', items: filtered.filter(v => warningRe.test(v.title)) },
  ].filter(p => p.items.length > 0).map(p => ({
    패턴: p.name,
    영상수: p.items.length,
    평균조회수: Math.round(p.items.reduce((a, v) => a + v.views, 0) / p.items.length),
  }))

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">영상 성과</h2>

        {/* 유형 필터 */}
        <div className="flex gap-2">
          {([
            ['all', `전체 (${merged.length})`],
            ['short', `숏폼 (${shortCount})`],
            ['long', `롱폼 (${longCount})`],
          ] as [TypeFilter, string][]).map(([value, label]) => (
            <button key={value} onClick={() => setTypeFilter(value)}
              className={`px-4 py-2 text-sm rounded-full transition ${
                typeFilter === value
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* TOP 10 바 차트 */}
      <div>
        <h3 className="text-lg font-semibold mb-4">TOP 10 영상</h3>
        <AnimatedBar items={barItems} maxValue={maxValue} />
      </div>

      {/* 영상 카드 그리드 */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          {typeFilter === 'all' ? '전체 영상' : typeFilter === 'short' ? '숏폼 영상' : '롱폼 영상'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((v, i) => {
            const rank = rankMap.get(v.id) || 0
            const borderColor = rank === 1 ? 'border-[#F59E0B]' : rank === 2 ? 'border-[#94A3B8]' : rank === 3 ? 'border-[#D97706]' : 'border-[var(--border)]'
            const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : ''

            return (
              <motion.div key={v.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                onClick={() => setEmbedId(v.id)}
                className={`rounded-2xl bg-[var(--bg-card)] border-2 overflow-hidden cursor-pointer hover:border-[var(--accent)] transition group ${borderColor}`}
              >
                <div className="relative">
                  {v.thumbnail_url ? (
                    <img src={v.thumbnail_url} alt={v.title} className="w-full aspect-video object-cover" />
                  ) : (
                    <div className="w-full aspect-video bg-[var(--bg-hover)]" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/40">
                    <Play size={32} className="text-white" />
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start gap-2 mb-2">
                    {rankEmoji && <span className="text-lg shrink-0">{rankEmoji}</span>}
                    <p className="font-medium text-sm line-clamp-2">{v.title}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      v.video_type === 'short' ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'bg-slate-500/15 text-slate-400'
                    }`}>
                      {v.video_type === 'short' ? 'SHORT' : 'LONG'}
                    </span>
                    <span>{v.views.toLocaleString()} 조회</span>
                    <span>{v.likes.toLocaleString()} 좋아요</span>
                    <span className="ml-auto">{fmtDate(v.published_at)}</span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* 제목 패턴 */}
      {patterns.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">제목 패턴 분석</h3>
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                  <th className="text-left p-4">패턴</th>
                  <th className="text-right p-4">영상수</th>
                  <th className="text-right p-4">평균조회수</th>
                </tr>
              </thead>
              <tbody>
                {patterns.map(p => (
                  <tr key={p.패턴} className="border-b border-[var(--border)]">
                    <td className="p-4">{p.패턴}</td>
                    <td className="p-4 text-right">{p.영상수}</td>
                    <td className="p-4 text-right">{p.평균조회수.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <VideoEmbed videoId={embedId} onClose={() => setEmbedId(null)} />
    </motion.div>
  )
}

function fmtDate(d: string) {
  return d?.slice(0, 10).replace(/-/g, '.') || ''
}

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Play } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Video, VideoStats } from '../hooks/useSupabase'
import AnimatedBar from '../components/AnimatedBar'
import VideoEmbed from '../components/VideoEmbed'

export default function Videos() {
  const [videos, setVideos] = useState<Video[]>([])
  const [stats, setStats] = useState<VideoStats[]>([])
  const [loading, setLoading] = useState(true)
  const [embedId, setEmbedId] = useState<string | null>(null)

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

  const top10 = [...merged].sort((a, b) => b.views - a.views).slice(0, 10)
  const top3Ids = new Set(top10.slice(0, 3).map(v => v.id))
  const barItems = [...top10].reverse().map(v => ({
    label: v.title.slice(0, 25),
    value: v.views,
    isTop3: top3Ids.has(v.id),
  }))
  const maxValue = Math.max(...barItems.map(b => b.value), 1)

  // 숏폼 vs 롱폼
  const shorts = merged.filter(v => v.video_type === 'short')
  const longs = merged.filter(v => v.video_type === 'long')
  const typeData = [
    { type: '숏폼', count: shorts.length, avgViews: shorts.length ? Math.round(shorts.reduce((a, v) => a + v.views, 0) / shorts.length) : 0 },
    { type: '롱폼', count: longs.length, avgViews: longs.length ? Math.round(longs.reduce((a, v) => a + v.views, 0) / longs.length) : 0 },
  ]

  // 제목 패턴
  const questionRe = /\?|일까|인가|할까|인지|나요/
  const numberRe = /\d+/
  const warningRe = /주의|경고|위험|조심|충격|논란|폭로/
  const patterns = [
    { name: '질문형', items: merged.filter(v => questionRe.test(v.title)) },
    { name: '숫자 포함', items: merged.filter(v => numberRe.test(v.title)) },
    { name: '경고/논란형', items: merged.filter(v => warningRe.test(v.title)) },
  ].filter(p => p.items.length > 0).map(p => ({
    패턴: p.name,
    영상수: p.items.length,
    평균조회수: Math.round(p.items.reduce((a, v) => a + v.views, 0) / p.items.length),
  }))

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <h2 className="text-2xl font-bold">영상 성과</h2>

      {/* TOP 10 바 차트 */}
      <div>
        <h3 className="text-lg font-semibold mb-4">TOP 10 영상</h3>
        <AnimatedBar items={barItems} maxValue={maxValue} />
      </div>

      {/* 영상 카드 그리드 (클릭 시 임베드) */}
      <div>
        <h3 className="text-lg font-semibold mb-4">전체 영상</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {merged.map((v, i) => (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              onClick={() => setEmbedId(v.id)}
              className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden cursor-pointer hover:border-[var(--accent)] transition group"
            >
              <div className="relative">
                {v.thumbnail_url ? (
                  <img src={v.thumbnail_url} alt={v.title} className="w-full aspect-video object-cover" />
                ) : (
                  <div className="w-full aspect-video bg-[var(--bg-hover)]" />
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/40">
                  <Play size={40} className="text-white" />
                </div>
                <span className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full ${
                  v.video_type === 'short' ? 'bg-[var(--accent)]' : 'bg-blue-600'
                } text-white`}>
                  {v.video_type === 'short' ? '숏' : '롱'}
                </span>
              </div>
              <div className="p-4">
                <p className="font-medium text-sm line-clamp-2 mb-2">{v.title}</p>
                <div className="flex gap-4 text-xs text-[var(--text-secondary)]">
                  <span>조회수 {v.views.toLocaleString()}</span>
                  <span>좋아요 {v.likes.toLocaleString()}</span>
                  <span>{fmtDate(v.published_at)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 숏폼 vs 롱폼 */}
      <div>
        <h3 className="text-lg font-semibold mb-4">숏폼 vs 롱폼</h3>
        <div className="grid grid-cols-2 gap-4">
          {typeData.map(t => (
            <div key={t.type} className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5">
              <p className="text-sm text-[var(--text-secondary)]">{t.type}</p>
              <p className="text-xl font-bold">{t.count}개</p>
              <p className="text-sm text-[var(--text-secondary)]">평균 조회수 {t.avgViews.toLocaleString()}</p>
            </div>
          ))}
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

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Play } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Video, VideoStats } from '../hooks/useSupabase'
import MetricCard from '../components/MetricCard'
import AnimatedBar from '../components/AnimatedBar'
import VideoEmbed from '../components/VideoEmbed'

const CHANNEL_ID = import.meta.env.VITE_CHANNEL_ID || 'UC5u8YtYZNJdxw1-qObwISpw'
const YT_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || ''

export default function Overview() {
  const [allVideos, setAllVideos] = useState<Video[]>([])
  const [thisWeekVideos, setThisWeekVideos] = useState<Video[]>([])
  const [stats, setStats] = useState<VideoStats[]>([])
  const [prevWeekVideoIds, setPrevWeekVideoIds] = useState<string[]>([])
  const [subscribers, setSubscribers] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [embedId, setEmbedId] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
      const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000).toISOString()

      const [allRes, twRes, pwRes, sRes] = await Promise.all([
        supabase.from('videos').select('*').order('published_at', { ascending: false }),
        supabase.from('videos').select('*').gte('published_at', weekAgo).order('published_at', { ascending: false }),
        supabase.from('videos').select('id').gte('published_at', twoWeeksAgo).lt('published_at', weekAgo),
        supabase.from('video_stats').select('*').order('fetched_at', { ascending: false }),
      ])

      setAllVideos(allRes.data || [])
      setThisWeekVideos(twRes.data || [])
      setPrevWeekVideoIds((pwRes.data || []).map(v => v.id))
      setStats(sRes.data || [])

      // 구독자 수 (YouTube API)
      if (YT_API_KEY) {
        try {
          const resp = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${CHANNEL_ID}&key=${YT_API_KEY}`
          )
          const data = await resp.json()
          const count = data?.items?.[0]?.statistics?.subscriberCount
          if (count) setSubscribers(parseInt(count))
        } catch { /* 실패해도 무시 */ }
      }

      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) return <LoadingSkeleton />

  const latestStats = dedup(stats)
  const statsMap = new Map(latestStats.map(s => [s.video_id, s]))

  // 이번 주 지표
  const twIds = new Set(thisWeekVideos.map(v => v.id))
  const twStats = latestStats.filter(s => twIds.has(s.video_id))
  const twViews = sum(twStats, 'views')
  const twLikes = sum(twStats, 'likes')
  const twComments = sum(twStats, 'comments')

  // 전주 지표
  const pwIds = new Set(prevWeekVideoIds)
  const pwStats = latestStats.filter(s => pwIds.has(s.video_id))
  const pwViews = sum(pwStats, 'views')
  const pwLikes = sum(pwStats, 'likes')
  const pwComments = sum(pwStats, 'comments')

  // 채널 전체 누적
  const totalViews = latestStats.reduce((a, s) => a + s.views, 0)
  const totalVideos = allVideos.length

  // 바 차트 (이번 주 영상)
  const barSource = (thisWeekVideos.length ? thisWeekVideos : allVideos).map(v => {
    const s = statsMap.get(v.id)
    return { label: v.title.slice(0, 25), value: s?.views || 0, id: v.id }
  }).sort((a, b) => b.value - a.value)

  const top3Ids = new Set(barSource.slice(0, 3).map(v => v.id))
  const barItems = barSource.map(v => ({
    label: v.label, value: v.value, isTop3: top3Ids.has(v.id),
  }))
  const maxValue = Math.max(...barItems.map(b => b.value), 1)

  // 최신 영상 3개 (썸네일 카드)
  const recentVideos = allVideos.slice(0, 3).map(v => ({
    ...v,
    views: statsMap.get(v.id)?.views || 0,
    likes: statsMap.get(v.id)?.likes || 0,
  }))

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      {/* 이번 주 핵심 지표 */}
      <div>
        <h2 className="text-2xl font-bold mb-4">이번 주 핵심 지표</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="조회수" value={twViews.toLocaleString()} delta={twViews - pwViews} prevValue={pwViews} delay={0} />
          <MetricCard label="좋아요" value={twLikes.toLocaleString()} delta={twLikes - pwLikes} prevValue={pwLikes} delay={0.05} />
          <MetricCard label="댓글" value={twComments.toLocaleString()} delta={twComments - pwComments} prevValue={pwComments} delay={0.1} />
          <MetricCard label="영상 수" value={`${thisWeekVideos.length}`} suffix="개" delta={thisWeekVideos.length - pwIds.size} prevValue={pwIds.size} delay={0.15} />
        </div>
      </div>

      {/* 채널 전체 + 구독자 */}
      <div>
        <h3 className="text-lg font-semibold mb-4">채널 전체</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5">
            <p className="text-sm text-[var(--text-secondary)] mb-1">총 영상</p>
            <p className="text-2xl font-bold">{totalVideos}<span className="text-sm font-normal text-[var(--text-secondary)]"> 개</span></p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5">
            <p className="text-sm text-[var(--text-secondary)] mb-1">총 조회수</p>
            <p className="text-2xl font-bold">{totalViews.toLocaleString()}</p>
          </motion.div>
          {subscribers !== null && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 md:col-span-2">
              <p className="text-sm text-[var(--text-secondary)] mb-1">구독자</p>
              <p className="text-2xl font-bold">{subscribers.toLocaleString()}<span className="text-sm font-normal text-[var(--text-secondary)]"> 명</span></p>
            </motion.div>
          )}
        </div>
      </div>

      {/* 최신 업로드 */}
      {recentVideos.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">최신 업로드</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {recentVideos.map((v, i) => (
              <motion.div key={v.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
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
                    <Play size={32} className="text-white" />
                  </div>
                </div>
                <div className="p-4">
                  <p className="font-medium text-sm line-clamp-2 mb-2">{v.title}</p>
                  <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      v.video_type === 'short' ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'bg-blue-500/15 text-blue-400'
                    }`}>
                      {v.video_type === 'short' ? 'SHORT' : 'LONG'}
                    </span>
                    <span>{v.views.toLocaleString()} 조회</span>
                    <span>{v.likes.toLocaleString()} 좋아요</span>
                    <span className="ml-auto">{fmtDate(v.published_at)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* 영상별 조회수 차트 */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          {thisWeekVideos.length ? '이번 주 영상별 조회수' : '전체 영상별 조회수'}
        </h3>
        <AnimatedBar items={barItems} maxValue={maxValue} />
      </div>

      <VideoEmbed videoId={embedId} onClose={() => setEmbedId(null)} />
    </motion.div>
  )
}

function dedup(stats: VideoStats[]): VideoStats[] {
  const seen = new Set<string>()
  return stats.filter(s => {
    if (seen.has(s.video_id)) return false
    seen.add(s.video_id)
    return true
  })
}

function sum(arr: VideoStats[], key: 'views' | 'likes' | 'comments'): number {
  return arr.reduce((acc, s) => acc + (s[key] || 0), 0)
}

function fmtDate(d: string) {
  return d?.slice(0, 10).replace(/-/g, '.') || ''
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 w-48 bg-[var(--bg-card)] rounded" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-[var(--bg-card)] rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-[var(--bg-card)] rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-[var(--bg-card)] rounded-2xl" />)}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import type { Video, VideoStats } from '../hooks/useSupabase'
import MetricCard from '../components/MetricCard'
import AnimatedBar from '../components/AnimatedBar'

export default function Overview() {
  const [videos, setVideos] = useState<Video[]>([])
  const [stats, setStats] = useState<VideoStats[]>([])
  const [prevStats, setPrevStats] = useState<VideoStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
      const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000).toISOString()

      const [vRes, sRes, , psRes] = await Promise.all([
        supabase.from('videos').select('*').gte('published_at', weekAgo).order('published_at', { ascending: false }),
        supabase.from('video_stats').select('*').order('fetched_at', { ascending: false }),
        supabase.from('videos').select('id').gte('published_at', twoWeeksAgo).lt('published_at', weekAgo),
        supabase.from('video_stats').select('*').order('fetched_at', { ascending: false }),
      ])

      setVideos(vRes.data || [])
      setStats(sRes.data || [])
      setPrevStats(psRes.data || [])
      setLoading(false)
    }
    fetch()
  }, [])

  if (loading) return <LoadingSkeleton />

  const latestStats = dedup(stats)
  const videoIds = new Set(videos.map(v => v.id))
  const thisWeekStats = latestStats.filter(s => videoIds.has(s.video_id))

  const twViews = sum(thisWeekStats, 'views')
  const twLikes = sum(thisWeekStats, 'likes')
  const twComments = sum(thisWeekStats, 'comments')

  // 전주
  const prevIds = new Set((prevStats || []).map((s: any) => s.video_id))
  const prevWeekStats = dedup(prevStats).filter(s => prevIds.has(s.video_id))
  const pwViews = sum(prevWeekStats, 'views')
  const pwLikes = sum(prevWeekStats, 'likes')
  const pwComments = sum(prevWeekStats, 'comments')

  // 바 차트 데이터
  const allVideosRes = videos.map(v => {
    const s = latestStats.find(s => s.video_id === v.id)
    return { label: v.title.slice(0, 25), value: s?.views || 0, id: v.id }
  }).sort((a, b) => b.value - a.value)

  const top3Ids = new Set(allVideosRes.slice(0, 3).map(v => v.id))
  const barItems = allVideosRes.reverse().map(v => ({
    label: v.label,
    value: v.value,
    isTop3: top3Ids.has(v.id),
  }))

  const maxValue = Math.max(...barItems.map(b => b.value), 1)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <h2 className="text-2xl font-bold">이번 주 핵심 지표</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="조회수" value={twViews.toLocaleString()} delta={twViews - pwViews} />
        <MetricCard label="좋아요" value={twLikes.toLocaleString()} delta={twLikes - pwLikes} />
        <MetricCard label="댓글" value={twComments.toLocaleString()} delta={twComments - pwComments} />
        <MetricCard label="영상 수" value={`${videos.length}`} suffix="개" delta={videos.length - (prevIds.size || 0)} />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">영상별 조회수</h3>
        <AnimatedBar items={barItems} maxValue={maxValue} />
      </div>
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

function LoadingSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 w-48 bg-[var(--bg-card)] rounded" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-[var(--bg-card)] rounded-2xl" />
        ))}
      </div>
      <div className="h-64 bg-[var(--bg-card)] rounded-2xl" />
    </div>
  )
}

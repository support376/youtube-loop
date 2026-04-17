import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { supabase } from '../lib/supabase'
import type { Video, VideoStats, Editor } from '../hooks/useSupabase'

const COLORS = ['#ff4b4b', '#4b8bff', '#22c55e', '#f59e0b']

export default function Editors() {
  const [editors, setEditors] = useState<Editor[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [stats, setStats] = useState<VideoStats[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    const fetch = async () => {
      const [eRes, vRes, sRes] = await Promise.all([
        supabase.from('editors').select('*'),
        supabase.from('videos').select('*').order('published_at', { ascending: false }),
        supabase.from('video_stats').select('*').order('fetched_at', { ascending: false }),
      ])
      setEditors(eRes.data || [])
      setVideos(vRes.data || [])
      setStats(sRes.data || [])
      setLoading(false)
    }
    fetch()
  }, [])

  if (loading) return <div className="animate-pulse h-64 bg-[var(--bg-card)] rounded-2xl" />

  const latestStats = new Map<string, VideoStats>()
  stats.forEach(s => { if (!latestStats.has(s.video_id)) latestStats.set(s.video_id, s) })

  const editorMap = new Map(editors.map(e => [e.id, e.name]))

  const summary = editors.map(e => {
    const editorVideos = videos.filter(v => v.editor_id === e.id)
    const editorStats = editorVideos.map(v => latestStats.get(v.id)).filter(Boolean) as VideoStats[]
    const totalViews = editorStats.reduce((a, s) => a + s.views, 0)
    const totalLikes = editorStats.reduce((a, s) => a + s.likes, 0)
    return {
      name: e.name,
      영상수: editorVideos.length,
      총조회수: totalViews,
      평균조회수: editorVideos.length ? Math.round(totalViews / editorVideos.length) : 0,
      총좋아요: totalLikes,
      평균좋아요: editorVideos.length ? Math.round(totalLikes / editorVideos.length) : 0,
    }
  })

  // 미배정
  const unassigned = videos.filter(v => !v.editor_id)
  if (unassigned.length > 0) {
    const uStats = unassigned.map(v => latestStats.get(v.id)).filter(Boolean) as VideoStats[]
    const tv = uStats.reduce((a, s) => a + s.views, 0)
    const tl = uStats.reduce((a, s) => a + s.likes, 0)
    summary.push({
      name: '미배정',
      영상수: unassigned.length,
      총조회수: tv,
      평균조회수: unassigned.length ? Math.round(tv / unassigned.length) : 0,
      총좋아요: tl,
      평균좋아요: unassigned.length ? Math.round(tl / unassigned.length) : 0,
    })
  }

  const selectedEditor = selected || summary[0]?.name
  const selectedVideos = videos
    .filter(v => {
      const eName = v.editor_id ? editorMap.get(v.editor_id) : '미배정'
      return eName === selectedEditor
    })
    .map(v => {
      const s = latestStats.get(v.id)
      return { ...v, views: s?.views || 0, likes: s?.likes || 0, comments: s?.comments || 0 }
    })

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <h2 className="text-2xl font-bold">편집자별 성과</h2>

      {/* 요약 테이블 */}
      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
              <th className="text-left p-4">편집자</th>
              <th className="text-right p-4">영상수</th>
              <th className="text-right p-4">총조회수</th>
              <th className="text-right p-4">평균조회수</th>
              <th className="text-right p-4 hidden md:table-cell">총좋아요</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((row, i) => (
              <motion.tr
                key={row.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)] cursor-pointer"
                onClick={() => setSelected(row.name)}
              >
                <td className="p-4 font-medium">{row.name}</td>
                <td className="p-4 text-right">{row.영상수}</td>
                <td className="p-4 text-right">{row.총조회수.toLocaleString()}</td>
                <td className="p-4 text-right">{row.평균조회수.toLocaleString()}</td>
                <td className="p-4 text-right hidden md:table-cell">{row.총좋아요.toLocaleString()}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 비교 차트 */}
      {summary.length > 1 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">평균 조회수 비교</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12 }}
                  labelStyle={{ color: '#f5f5f5' }}
                />
                <Bar dataKey="평균조회수" radius={[8, 8, 0, 0]} animationDuration={1200}>
                  {summary.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 편집자 영상 목록 */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-lg font-semibold">{selectedEditor} 영상 목록</h3>
          <div className="flex gap-2">
            {summary.map(s => (
              <button
                key={s.name}
                onClick={() => setSelected(s.name)}
                className={`px-3 py-1 text-xs rounded-full transition ${
                  s.name === selectedEditor
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                <th className="text-left p-4">제목</th>
                <th className="text-right p-4">업로드일</th>
                <th className="text-right p-4">조회수</th>
                <th className="text-right p-4">좋아요</th>
              </tr>
            </thead>
            <tbody>
              {selectedVideos.map(v => (
                <tr key={v.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)]">
                  <td className="p-4">{v.title}</td>
                  <td className="p-4 text-right text-[var(--text-secondary)]">{fmtDate(v.published_at)}</td>
                  <td className="p-4 text-right">{v.views.toLocaleString()}</td>
                  <td className="p-4 text-right">{v.likes.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  )
}

function fmtDate(d: string) {
  return d?.slice(0, 10).replace(/-/g, '.') || ''
}

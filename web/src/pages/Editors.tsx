import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Users } from 'lucide-react'
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

  if (loading) return <LoadingSkeleton />

  const latestStats = new Map<string, VideoStats>()
  stats.forEach(s => { if (!latestStats.has(s.video_id)) latestStats.set(s.video_id, s) })

  const editorMap = new Map(editors.map(e => [e.id, e.name]))

  // 편집자별 집계
  const summary = editors.map(e => {
    const editorVideos = videos.filter(v => v.editor_id === e.id)
    const editorStats = editorVideos.map(v => latestStats.get(v.id)).filter(Boolean) as VideoStats[]
    const totalViews = editorStats.reduce((a, s) => a + s.views, 0)
    const totalLikes = editorStats.reduce((a, s) => a + s.likes, 0)
    return {
      name: e.name,
      joined: (e as any).joined_at || '',
      영상수: editorVideos.length,
      총조회수: totalViews,
      평균조회수: editorVideos.length ? Math.round(totalViews / editorVideos.length) : 0,
      총좋아요: totalLikes,
      평균좋아요: editorVideos.length ? Math.round(totalLikes / editorVideos.length) : 0,
    }
  })

  const unassigned = videos.filter(v => !v.editor_id)
  const assignedCount = videos.length - unassigned.length
  const hasData = assignedCount > 0

  if (unassigned.length > 0) {
    const uStats = unassigned.map(v => latestStats.get(v.id)).filter(Boolean) as VideoStats[]
    const tv = uStats.reduce((a, s) => a + s.views, 0)
    const tl = uStats.reduce((a, s) => a + s.likes, 0)
    summary.push({
      name: '미배정',
      joined: '',
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

      {/* 편집자 프로필 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summary.map((e, i) => (
          <motion.div key={e.name}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => setSelected(e.name)}
            className={`rounded-2xl border p-5 cursor-pointer transition ${
              e.name === selectedEditor
                ? 'bg-[var(--accent-soft)] border-[var(--accent)]'
                : 'bg-[var(--bg-card)] border-[var(--border)] hover:border-[var(--accent)]/50'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                e.name === '미배정' ? 'bg-[#555]' : ''
              }`} style={e.name !== '미배정' ? { background: COLORS[i % COLORS.length] } : {}}>
                {e.name === '미배정' ? '?' : e.name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold">{e.name}</p>
                {e.name === '미배정' ? (
                  <p className="text-xs text-[var(--text-secondary)]">편집자 태깅 전 영상</p>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)]">편집자</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-[var(--text-secondary)]">영상</p>
                <p className="text-lg font-bold">{e.영상수}<span className="text-xs font-normal text-[var(--text-secondary)]">개</span></p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)]">평균 조회수</p>
                <p className="text-lg font-bold">{e.평균조회수.toLocaleString()}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* 데이터 부족 안내 */}
      {!hasData && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-8 text-center">
          <Users size={40} className="text-[var(--text-secondary)] mx-auto mb-4" />
          <p className="font-semibold mb-2">편집자별 비교 데이터가 아직 없습니다</p>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto">
            양변 업로더로 영상을 올리면 편집자가 자동 태깅됩니다.<br />
            <span className="text-xs">python upload.py --folder "최종본\경민"</span>
          </p>
        </motion.div>
      )}

      {/* 비교 차트 (데이터 있을 때만) */}
      {hasData && summary.filter(s => s.name !== '미배정').length > 1 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">편집자 비교</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.filter(s => s.name !== '미배정')}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12 }}
                  labelStyle={{ color: '#f5f5f5' }}
                />
                <Bar dataKey="평균조회수" radius={[8, 8, 0, 0]} animationDuration={1200}>
                  {summary.filter(s => s.name !== '미배정').map((_, i) => (
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
        </div>
        {selectedVideos.length > 0 ? (
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
        ) : (
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-8 text-center text-sm text-[var(--text-secondary)]">
            {selectedEditor}의 영상이 없습니다.
          </div>
        )}
      </div>

      {/* 미배정 안내 */}
      {unassigned.length > 0 && selectedEditor === '미배정' && (
        <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-4 text-sm text-[var(--text-secondary)]">
          💡 미배정 영상은 양변 업로더로 업로드하면 편집자 폴더명에서 자동 태깅됩니다.
        </div>
      )}
    </motion.div>
  )
}

function fmtDate(d: string) { return d?.slice(0, 10).replace(/-/g, '.') || '' }

function LoadingSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 w-48 bg-[var(--bg-card)] rounded" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-36 bg-[var(--bg-card)] rounded-2xl" />)}
      </div>
      <div className="h-64 bg-[var(--bg-card)] rounded-2xl" />
    </div>
  )
}

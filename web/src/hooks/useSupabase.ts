import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useQuery<T>(table: string, query: (q: any) => any) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const q = supabase.from(table).select('*')
      const { data, error } = await query(q)
      if (!error && data) setData(data as T[])
      setLoading(false)
    }
    fetch()
  }, [table])

  return { data, loading }
}

export interface Video {
  id: string
  channel_id: string
  title: string
  description: string
  published_at: string
  editor_id: number | null
  duration_sec: number
  video_type: 'short' | 'long'
  tags: string[]
  thumbnail_url: string
}

export interface VideoStats {
  id: string
  video_id: string
  fetched_at: string
  views: number
  likes: number
  comments: number
}

export interface Editor {
  id: number
  name: string
}

export interface WeeklyReport {
  id: string
  week_start: string
  week_end: string
  report_md: string
  top_videos: any
  created_at: string
}

export interface Feedback {
  id: string
  created_at: string
  period: string
  content_md: string
  keywords_boost: string[]
  keywords_avoid: string[]
  title_patterns: Record<string, any>
}

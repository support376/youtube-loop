import type { VercelRequest, VercelResponse } from '@vercel/node'

export const maxDuration = 10

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = process.env.GITHUB_PAT
  const repo = process.env.GITHUB_REPO || 'support376/youtube-loop'
  const workflow = process.env.GITHUB_WORKFLOW_FILE || 'daily_crawl.yml'

  if (!token) {
    return res.status(500).json({ error: 'GITHUB_PAT 미설정' })
  }

  try {
    const resp = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
          'User-Agent': 'youtube-loop-dashboard',
        },
        body: JSON.stringify({ ref: 'main' }),
      },
    )

    if (!resp.ok) {
      const text = await resp.text()
      return res.status(resp.status).json({
        error: 'GitHub API 호출 실패',
        status: resp.status,
        message: text.slice(0, 500),
      })
    }

    // GitHub은 성공 시 204 No Content 반환
    return res.status(200).json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: 'internal', message })
  }
}

import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Vercel Hobby 최대치
export const maxDuration = 60

// ─── 타입 ───
interface CrawlNews {
  title: string
  url: string
  source: string | null
  source_type: string
  section: string | null
  keyword: string | null
  body: string | null
  freshness: string | null
}

interface CrawlCommunity {
  title: string
  url: string
  platform: string
  body: string | null
  freshness: string | null
}

interface RequestBody {
  crawled_news?: CrawlNews[]
  crawled_community?: CrawlCommunity[]
  feedback_md?: string
  weights?: Record<string, number>
}

// ─── 시스템 프롬프트 (캐시용으로 고정) ───
const SYSTEM_PROMPT = `너는 법률 유튜브 채널(양홍수 변호사)의 콘텐츠 기획 AI다.
오늘의 뉴스/커뮤니티 크롤링 데이터와 채널 피드백 규칙을 받아서,
쇼츠 카드 10개 + 롱폼 후보 3~4개를 생성한다.

쇼츠 카드 포맷 (카드당):
- style: "경고형" | "질문형" | "손해방지형" | "사실단언형" 중 하나
- tags: 해당되면 배열(예: ["양변전문영역","톤주의","검증필요"]). 없으면 []
- title: 시청자 관심 끄는 한 줄 제목 (30자 이내)
- one_line: 한 줄 결론 (따옴표 포함 가능, 40자 이내)
- evidence: 근거 2~3개의 짧은 배열 (각 40자 이내)
- case_study: 사례 1개 (80자 이내)
- closing: 마무리 멘트 (30자 이내)
- source_name: 출처 매체명
- source_url: 출처 URL
- guide: 양변 가이드 (필요시만, 없으면 null)
- scores: { "화제성": 0~100, "법률연결성": 0~100, "시청자실익": 0~100, "수익성": 0~100, "경쟁도": 0~100, "지속성": 0~100 }
- shorts_fit: 0~5 정수 (쇼츠 적합도)
- format: "shorts"

롱폼 후보 포맷:
- title: 롱폼 제목
- description: 왜 롱폼인지 2~3줄
- related_shorts: 관련 쇼츠 카드 인덱스 배열 (0-based, 없으면 [])
- format: "long"

스타일 분포 가이드:
- 경고형 30~40%, 질문형 30~35%, 손해방지형 15~25%, 사실단언형 5~10%

규칙:
- 풀 스크립트 금지. 핵심만.
- 양변 전문영역(세무/국세청/재산) 관련이면 반드시 "양변전문영역" 태그
- 민감 사례는 "톤주의" 태그 + guide에 대안 제시
- 법률 수치/날짜가 불확실하면 "검증필요" 태그
- 모든 텍스트 간결하게. 불필요한 수식어·부연 금지.

응답은 아래 JSON만. 다른 텍스트·코드펜스·주석 금지:
{
  "shorts_cards": [ ...10개... ],
  "long_candidates": [ ...3~4개... ],
  "style_distribution": { "경고형": N, "질문형": N, "손해방지형": N, "사실단언형": N }
}`

// ─── 크롤 데이터 압축 ───
function compactNews(items: CrawlNews[], max: number): string {
  return items
    .slice(0, max)
    .map((n, i) => {
      const tag = n.keyword ? `키워드:${n.keyword}` : n.section ? `섹션:${n.section}` : n.source_type
      const body = (n.body || '').slice(0, 200)
      return `[${i + 1}] (${tag}) ${n.title} | ${n.source || '-'}${n.freshness ? ` | ${n.freshness}` : ''}\n  ${body}\n  ${n.url}`
    })
    .join('\n')
}

function compactCommunity(items: CrawlCommunity[], max: number): string {
  return items
    .slice(0, max)
    .map((c, i) => {
      const body = (c.body || '').slice(0, 200)
      return `[${i + 1}] (${c.platform}) ${c.title}${c.freshness ? ` | ${c.freshness}` : ''}\n  ${body}\n  ${c.url}`
    })
    .join('\n')
}

// ─── 핸들러 ───
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY 미설정' })
  }

  const body = (req.body ?? {}) as RequestBody
  const news = body.crawled_news ?? []
  const community = body.crawled_community ?? []
  const feedbackMd = (body.feedback_md ?? '').slice(0, 4000)
  const weights = body.weights ?? {}

  // 입력 크기 제한 — 토큰 예산 관리
  const newsBlock = compactNews(news, 50)
  const communityBlock = compactCommunity(community, 30)

  const userMessage = `## 오늘 크롤링 — 뉴스 (상위 ${Math.min(news.length, 50)}건)
${newsBlock || '(없음)'}

## 오늘 크롤링 — 커뮤니티 (상위 ${Math.min(community.length, 30)}건)
${communityBlock || '(없음)'}

## 채널 피드백 규칙 (최신)
${feedbackMd || '(아직 피드백 없음 — 일반 기준으로 기획)'}

## 스코어 가중치
${JSON.stringify(weights)}

위 데이터 기반으로 쇼츠 카드 10개 + 롱폼 후보 3~4개를 생성해줘. JSON만 응답.`

  const client = new Anthropic({ apiKey })

  try {
    // 스트리밍으로 호출 → finalMessage 로 전체 수집 (HTTP timeout 회피)
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    })

    const final = await stream.finalMessage()

    // 텍스트 블록 합치기
    const text = final.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim()

    // JSON 추출 (코드펜스 섞여 들어와도 관대하게)
    const jsonText = extractJson(text)
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch (err) {
      return res.status(502).json({
        error: 'Claude 응답 JSON 파싱 실패',
        raw: text.slice(0, 2000),
      })
    }

    return res.status(200).json({
      ok: true,
      data: parsed,
      usage: final.usage,
    })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'rate_limit', message: error.message })
    }
    if (error instanceof Anthropic.APIError) {
      return res.status(error.status ?? 500).json({
        error: 'anthropic_api_error',
        status: error.status,
        message: error.message,
      })
    }
    const message = error instanceof Error ? error.message : String(error)
    return res.status(500).json({ error: 'internal', message })
  }
}

function extractJson(text: string): string {
  // ```json ... ``` 또는 ``` ... ``` 제거
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) return fence[1].trim()
  // 첫 { 부터 마지막 } 까지
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first >= 0 && last > first) return text.slice(first, last + 1)
  return text
}

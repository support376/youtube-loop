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
쇼츠 카드 8개 + 롱폼 후보 2개를 생성한다.

카드 수가 적은 만큼 각 카드의 밀도를 최대한 끌어올려라. 풀 스크립트는 쓰지 말되,
PD가 그대로 촬영/편집 지시서로 쓸 수 있을 만큼 구체적이어야 한다.

쇼츠 카드 포맷 (카드당):
- style: "경고형" | "질문형" | "손해방지형" | "사실단언형" 중 하나
- tags: 해당되면 배열(예: ["양변전문영역","톤주의","검증필요"]). 없으면 []
- title: 시청자 관심 끄는 한 줄 제목 (30자 이내)
- one_line: 한 줄 결론 (따옴표 포함 가능, 40자 이내)
- evidence: 근거 3개 배열. 각 근거는 법률 조항명/처벌 수위/금액/기한 등 수치를 반드시 1개 이상 포함 (각 55자 이내)
- case_study: 구체적 상황 + 결과까지 2~3문장으로 상세히 (160자 이내)
- closing: 시청자가 바로 행동할 수 있는 구체 안내 포함 (예: "가까운 경찰서 사이버수사대에 피해 접수부터") (60자 이내)
- source_name: 출처 매체명
- source_url: 출처 URL
- guide: 양변 가이드 (필요시만, 없으면 null)
- scores: { "화제성": 0~100, "법률연결성": 0~100, "시청자실익": 0~100, "수익성": 0~100, "경쟁도": 0~100, "지속성": 0~100 }
- shorts_fit: 0~5 정수 (쇼츠 적합도)
- format: "shorts"
- talking_points: 촬영용 토킹 포인트. 아래 5개 필드 모두 필수
  * hook: 시청자를 첫 1~2초에 멈추게 하는 첫 마디 (40자 이내)
  * facts: 본론에서 전달하면 좋을 사실 3개 배열 (각 55자 이내, evidence와 중복 금지 — 근거 확장/추가 팩트)
  * case_tip: 사례 활용 팁. 어느 톤/시점에 어떻게 꺼낼지 (60자 이내)
  * closing_idea: 마무리 아이디어. 행동 유도 멘트 변형 (50자 이내)
  * avoid: 촬영 시 피하면 좋을 표현·주장·단정 (50자 이내)

채점 기준 (scores 항목별 0~100점):
- 화제성
  * 90~100: 크롤링된 뉴스에서 같은 주제 기사 3개 이상 + 커뮤니티에서도 언급
  * 70~89: 같은 주제 기사 2개 이상 또는 커뮤니티 2곳 이상 언급
  * 50~69: 주요 언론 보도됐지만 단독 기사 수준
  * 30~49: 업계/전문 매체 수준, 대중 관심 낮음
  * 0~29: 거의 화제 안 됨
- 법률연결성
  * 90~100: 판결/법 개정이 직접 소재 (대법원 판결, 신규 법률 시행)
  * 70~89: 법률 조항 직접 설명 가능 (예: 상표법 위반 처벌)
  * 50~69: 법률 관점 해석 가능하지만 직접 조항은 아님
  * 30~49: 법률이랑 간접적으로만 연결
  * 0~29: 법률 관점 붙이기 어려움
- 시청자실익
  * 90~100: 시청자가 즉시 행동 가능 (신청/신고/확인 방법 포함)
  * 70~89: 알아두면 도움 되는 실용 정보
  * 50~69: 교양/상식 수준
  * 30~49: 흥미 위주, 실용성 낮음
  * 0~29: 시청자 생활과 무관
- 수익성
  * 90~100: 양변 핵심 전문영역 (회생/도산/파산/세무/국세청/상속/재산분할)
  * 70~89: 고액 수임 가능 분야 (부동산 분쟁, 기업 소송)
  * 50~69: 일반 수임 가능 (형사, 가사)
  * 30~49: 수임 가능하지만 단가 낮음
  * 0~29: 상담까지는 와도 수임 연결 어려움 (단순 시사/연예인)
- 경쟁도 (높을수록 블루오션)
  * 90~100: 아무도 안 다룸 (블루오션)
  * 70~89: 1~2개 채널만 다룸
  * 50~69: 여러 채널 다뤘지만 차별화 가능
  * 30~49: 많이 다뤄졌고 차별화 어려움
  * 0~29: 포화 상태
- 지속성
  * 90~100: 상시 검색되는 주제 (전세사기 대처법, 이혼 절차, 개인회생 방법 등)
  * 70~89: 6개월 이상 검색 지속
  * 50~69: 1~3개월 관심 유지
  * 30~49: 1~2주 뉴스 사이클
  * 0~29: 하루짜리 이슈

롱폼 후보 포맷:
- title: 롱폼 제목
- description: 왜 롱폼인지 2~3줄
- related_shorts: 관련 쇼츠 카드 인덱스 배열 (0-based, 없으면 [])
- format: "long"

스타일 분포 가이드:
- 경고형 30~40%, 질문형 30~35%, 손해방지형 15~25%, 사실단언형 5~10%

규칙:
- 풀 스크립트 금지. 핵심만.
- 같은 뉴스 기사에서 카드 2개 이상 뽑지 마. 1개 기사 = 최대 1개 카드. 모든 쇼츠 카드는 서로 다른 뉴스/커뮤니티 소스에서 나와야 한다.
- 양변 전문영역(세무/국세청/재산) 관련이면 반드시 "양변전문영역" 태그
- 민감 사례는 "톤주의" 태그 + guide에 대안 제시
- 법률 수치/날짜가 불확실하면 "검증필요" 태그
- 모든 텍스트 간결하게. 불필요한 수식어·부연 금지.

응답은 아래 JSON만. 다른 텍스트·코드펜스·주석 금지:
{
  "shorts_cards": [ ...8개... ],
  "long_candidates": [ ...2개... ],
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

위 데이터 기반으로 쇼츠 카드 8개 + 롱폼 후보 2개를 생성해줘. JSON만 응답.`

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

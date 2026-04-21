import type { CSSProperties } from 'react'

interface TalkingPoints {
  hook?: string
  facts?: string[]
  case_tip?: string
  ending?: string
  avoid?: string
}

export interface PdfCard {
  id: string
  title: string
  one_line: string | null
  evidence: string[] | null
  case_study: string | null
  closing: string | null
  source_name: string | null
  source_url: string | null
  guide: string | null
  style: string | null
  special_tags: string[] | null
  format: 'shorts' | 'long' | null
  score_total: number | null
  topic_summary?: string | null
  talking_points?: TalkingPoints | null
}

interface Props {
  cards: PdfCard[]
  longCards: PdfCard[]
  date: Date
  title?: string
}

// A4 @ 96DPI
const PAGE: CSSProperties = {
  width: 794,
  minHeight: 1123,
  backgroundColor: '#ffffff',
  color: '#0F1117',
  fontFamily: "'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif",
  fontSize: 14,
  lineHeight: 1.5,
  padding: 56,
  boxSizing: 'border-box',
  pageBreakAfter: 'always',
}

const STYLE_COLORS: Record<string, { bg: string; fg: string }> = {
  경고형: { bg: 'rgba(239,68,68,0.15)', fg: '#B91C1C' },
  질문형: { bg: 'rgba(59,130,246,0.15)', fg: '#1D4ED8' },
  손해방지형: { bg: 'rgba(34,197,94,0.15)', fg: '#15803D' },
  사실단언형: { bg: 'rgba(251,191,36,0.15)', fg: '#B45309' },
}

const TAG_ICON: Record<string, string> = {
  양변전문영역: '★',
  톤주의: '⚠',
  검증필요: '🔍',
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

function Pill({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 999,
        backgroundColor: bg,
        color: fg,
        fontSize: 12,
        fontWeight: 600,
        marginRight: 6,
      }}
    >
      {text}
    </span>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
        ▸ {label}
      </div>
      <div style={{ fontSize: 14, color: '#1F2937' }}>{children}</div>
    </div>
  )
}

export default function PdfTemplate({ cards, longCards, date, title }: Props) {
  const styleCount = cards.reduce<Record<string, number>>((acc, c) => {
    const s = c.style || '기타'
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})
  const tagCount = cards.reduce<Record<string, number>>((acc, c) => {
    for (const t of c.special_tags ?? []) {
      acc[t] = (acc[t] || 0) + 1
    }
    return acc
  }, {})

  return (
    <div>
      {/* 요약 페이지 */}
      <div className="pdf-page" style={PAGE}>
        <div style={{ borderBottom: '2px solid #0F1117', paddingBottom: 16, marginBottom: 32 }}>
          <div style={{ fontSize: 13, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {formatDate(date)}
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 0', color: '#0F1117' }}>
            {title ?? '양홍수 변호사 쇼츠 카드'}
          </h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
          <div>
            <div style={{ fontSize: 13, color: '#64748B', marginBottom: 4 }}>승인된 쇼츠 카드</div>
            <div style={{ fontSize: 48, fontWeight: 700, lineHeight: 1 }}>{cards.length}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#64748B', marginBottom: 4 }}>롱폼 후보</div>
            <div style={{ fontSize: 48, fontWeight: 700, lineHeight: 1 }}>{longCards.length}</div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: '#0F1117' }}>
            스타일 분포
          </div>
          <div>
            {['경고형', '질문형', '손해방지형', '사실단언형'].map(s => {
              const c = styleCount[s] || 0
              const color = STYLE_COLORS[s] ?? { bg: '#F1F5F9', fg: '#475569' }
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  <Pill text={s} bg={color.bg} fg={color.fg} />
                  <span style={{ fontSize: 14, color: '#1F2937' }}>{c}개</span>
                </div>
              )
            })}
          </div>
        </div>

        {Object.keys(tagCount).length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: '#0F1117' }}>
              특수 태그
            </div>
            <div>
              {Object.entries(tagCount).map(([tag, cnt]) => (
                <div key={tag} style={{ fontSize: 14, color: '#1F2937', marginBottom: 4 }}>
                  {TAG_ICON[tag] || '•'} {tag} · {cnt}개
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 카드별 페이지 */}
      {cards.map((c, i) => {
        const sColor = c.style ? STYLE_COLORS[c.style] : null
        return (
          <div key={c.id} className="pdf-page" style={PAGE}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              {sColor && <Pill text={c.style!} bg={sColor.bg} fg={sColor.fg} />}
              {(c.special_tags ?? []).map(t => (
                <Pill key={t} text={`${TAG_ICON[t] || ''} ${t}`} bg="#F1F5F9" fg="#475569" />
              ))}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8' }}>
                {i + 1} / {cards.length}
              </span>
            </div>

            <h2 style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.3, margin: '0 0 8px', color: '#0F1117' }}>
              {c.title}
            </h2>

            {typeof c.score_total === 'number' && (
              <div style={{ fontSize: 12, color: '#64748B' }}>종합 점수 {c.score_total}</div>
            )}

            {c.one_line && (
              <Section label="한 줄 결론">
                <div style={{ fontStyle: 'italic', color: '#334155' }}>"{c.one_line}"</div>
              </Section>
            )}

            {c.evidence && c.evidence.length > 0 && (
              <Section label="근거">
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {c.evidence.map((e, idx) => (
                    <li key={idx} style={{ marginBottom: 4 }}>{e}</li>
                  ))}
                </ul>
              </Section>
            )}

            {c.case_study && <Section label="사례">{c.case_study}</Section>}
            {c.closing && <Section label="마무리">{c.closing}</Section>}

            {c.source_name && (
              <Section label="출처">
                <div>{c.source_name}</div>
                {c.source_url && (
                  <div style={{ fontSize: 11, color: '#64748B', wordBreak: 'break-all', marginTop: 2 }}>
                    {c.source_url}
                  </div>
                )}
              </Section>
            )}

            {c.guide && (
              <div
                style={{
                  marginTop: 20,
                  padding: 14,
                  backgroundColor: 'rgba(139,92,246,0.08)',
                  border: '1px solid rgba(139,92,246,0.2)',
                  borderRadius: 10,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: '#7C3AED', marginBottom: 6 }}>
                  양변 가이드
                </div>
                <div style={{ fontSize: 14, color: '#1F2937' }}>{c.guide}</div>
              </div>
            )}

            {c.talking_points && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  ▸ 토킹 포인트
                </div>
                <div style={{ fontSize: 13, color: '#1F2937', lineHeight: 1.7 }}>
                  {c.talking_points.hook && (
                    <div><b>훅 아이디어:</b> {c.talking_points.hook}</div>
                  )}
                  {c.talking_points.facts && c.talking_points.facts.length > 0 && (
                    <div>
                      <b>전달할 사실:</b>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {c.talking_points.facts.map((f, idx) => <li key={idx}>{f}</li>)}
                      </ul>
                    </div>
                  )}
                  {c.talking_points.case_tip && (
                    <div><b>사례 활용 팁:</b> {c.talking_points.case_tip}</div>
                  )}
                  {c.talking_points.ending && (
                    <div><b>마무리 아이디어:</b> {c.talking_points.ending}</div>
                  )}
                  {c.talking_points.avoid && (
                    <div><b>피하면 좋을 것:</b> {c.talking_points.avoid}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* 롱폼 후보 페이지 */}
      {longCards.length > 0 && (
        <div className="pdf-page" style={PAGE}>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 24px', color: '#0F1117' }}>
            롱폼 후보
          </h2>
          {longCards.map((c, i) => (
            <div
              key={c.id}
              style={{
                padding: 16,
                border: '1px solid #E2E8F0',
                borderRadius: 12,
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>#{i + 1}</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#0F1117' }}>
                {c.title}
              </div>
              {c.topic_summary && (
                <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                  {c.topic_summary}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

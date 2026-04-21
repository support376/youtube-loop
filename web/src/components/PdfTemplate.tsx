import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'

// Noto Sans KR — jsDelivr CDN (googlefonts/noto-cjk 저장소). CORS 허용.
Font.register({
  family: 'NotoSansKR',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/SubsetOTF/KR/NotoSansKR-Regular.otf',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/SubsetOTF/KR/NotoSansKR-Bold.otf',
      fontWeight: 700,
    },
  ],
})

// ─── 타입 ───
interface TalkingPoints {
  hook?: string | null
  facts?: string[] | null
  case_tip?: string | null
  closing_idea?: string | null
  avoid?: string | null
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

// ─── 색·아이콘 ───
const STYLE_COLORS: Record<string, { bg: string; fg: string }> = {
  경고형: { bg: '#FEE2E2', fg: '#B91C1C' },
  질문형: { bg: '#DBEAFE', fg: '#1D4ED8' },
  손해방지형: { bg: '#DCFCE7', fg: '#15803D' },
  사실단언형: { bg: '#FEF3C7', fg: '#B45309' },
}

const TAG_ICON: Record<string, string> = {
  양변전문영역: '★',
  톤주의: '⚠',
  검증필요: '🔍',
}

// ─── 스타일 ───
const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansKR',
    backgroundColor: '#FFFFFF',
    padding: 48,
    fontSize: 11,
    lineHeight: 1.55,
    color: '#0F1117',
  },

  // 공통 pill
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 9,
    fontWeight: 700,
    marginRight: 6,
    marginBottom: 4,
  },

  // 요약 페이지
  summaryHeader: {
    borderBottomWidth: 2,
    borderBottomColor: '#0F1117',
    paddingBottom: 14,
    marginBottom: 28,
  },
  summaryDate: {
    fontSize: 10,
    color: '#475569',
    marginBottom: 6,
    letterSpacing: 1,
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: 700,
  },
  countRow: {
    flexDirection: 'row',
    marginBottom: 28,
  },
  countBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    marginRight: 12,
  },
  countBoxLast: { marginRight: 0 },
  countLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 6,
  },
  countValue: {
    fontSize: 36,
    fontWeight: 700,
  },
  blockLabel: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 10,
    color: '#0F1117',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },

  // 카드 페이지
  cardHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 14,
  },
  pageNum: {
    marginLeft: 'auto',
    fontSize: 9,
    color: '#94A3B8',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 700,
    lineHeight: 1.3,
    marginBottom: 6,
  },
  scoreBig: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  scoreBigNum: {
    fontSize: 22,
    fontWeight: 700,
    color: '#0F1117',
  },
  oneLine: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 16,
  },
  section: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#475569',
    marginBottom: 6,
  },
  sectionBody: {
    fontSize: 11,
    color: '#1F2937',
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  bulletDot: {
    width: 10,
    fontSize: 11,
    color: '#475569',
  },
  bulletText: {
    flex: 1,
    fontSize: 11,
    color: '#1F2937',
  },
  sourceUrl: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 3,
  },
  guideBox: {
    borderRadius: 8,
    backgroundColor: '#F5F0FF',
    borderWidth: 1,
    borderColor: '#DDD0FF',
    padding: 12,
    marginBottom: 12,
  },
  guideTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#7C3AED',
    marginBottom: 6,
  },
  talkBox: {
    borderRadius: 8,
    backgroundColor: '#F3EBFF',
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
    padding: 14,
    marginTop: 8,
    marginBottom: 12,
  },
  talkTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#6D28D9',
    marginBottom: 8,
  },
  talkItem: {
    fontSize: 10.5,
    color: '#1F2937',
    marginBottom: 5,
    lineHeight: 1.5,
  },
  talkLabel: {
    fontWeight: 700,
    color: '#6D28D9',
  },
  talkFactsWrap: { marginBottom: 5 },
  talkFactRow: { flexDirection: 'row', marginBottom: 2, paddingLeft: 8 },

  // 롱폼 페이지
  longHeader: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 20,
  },
  longItem: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  longIdx: {
    fontSize: 9,
    color: '#94A3B8',
    marginBottom: 3,
  },
  longTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 6,
  },
  longBody: {
    fontSize: 11,
    color: '#475569',
  },
})

function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return <Text style={[styles.pill, { backgroundColor: bg, color: fg }]}>{label}</Text>
}

function formatDateKo(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

// ─── 요약 페이지 ───
function SummaryPage({ cards, longCards, date, title }: Props) {
  const styleCount = cards.reduce<Record<string, number>>((acc, c) => {
    const s = c.style || '기타'
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})
  const tagCount = cards.reduce<Record<string, number>>((acc, c) => {
    for (const t of c.special_tags ?? []) acc[t] = (acc[t] || 0) + 1
    return acc
  }, {})

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.summaryHeader}>
        <Text style={styles.summaryDate}>{formatDateKo(date)}</Text>
        <Text style={styles.summaryTitle}>{title ?? '양홍수 변호사 쇼츠 카드'}</Text>
      </View>

      <View style={styles.countRow}>
        <View style={styles.countBox}>
          <Text style={styles.countLabel}>승인된 쇼츠 카드</Text>
          <Text style={styles.countValue}>{cards.length}</Text>
        </View>
        <View style={[styles.countBox, styles.countBoxLast]}>
          <Text style={styles.countLabel}>롱폼 후보</Text>
          <Text style={styles.countValue}>{longCards.length}</Text>
        </View>
      </View>

      <Text style={styles.blockLabel}>스타일 분포</Text>
      <View style={styles.pillRow}>
        {['경고형', '질문형', '손해방지형', '사실단언형'].map(s => {
          const c = styleCount[s] || 0
          const col = STYLE_COLORS[s] ?? { bg: '#F1F5F9', fg: '#475569' }
          return <Pill key={s} label={`${s} · ${c}개`} bg={col.bg} fg={col.fg} />
        })}
      </View>

      {Object.keys(tagCount).length > 0 && (
        <>
          <Text style={styles.blockLabel}>특수 태그</Text>
          <View style={styles.pillRow}>
            {Object.entries(tagCount).map(([t, cnt]) => (
              <Pill
                key={t}
                label={`${TAG_ICON[t] ?? ''} ${t} · ${cnt}개`}
                bg="#F1F5F9"
                fg="#475569"
              />
            ))}
          </View>
        </>
      )}
    </Page>
  )
}

// ─── 카드 페이지 ───
function CardPage({ card, index, total }: { card: PdfCard; index: number; total: number }) {
  const sCol = card.style ? STYLE_COLORS[card.style] : null
  const tp = card.talking_points

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.cardHeader}>
        {sCol && <Pill label={card.style!} bg={sCol.bg} fg={sCol.fg} />}
        {(card.special_tags ?? []).map(t => (
          <Pill key={t} label={`${TAG_ICON[t] ?? ''} ${t}`} bg="#F1F5F9" fg="#475569" />
        ))}
        <Text style={styles.pageNum}>
          {index + 1} / {total}
        </Text>
      </View>

      <Text style={styles.cardTitle}>{card.title}</Text>
      {typeof card.score_total === 'number' && (
        <Text style={styles.scoreBig}>
          종합 <Text style={styles.scoreBigNum}>{card.score_total}</Text>
        </Text>
      )}

      {card.one_line && <Text style={styles.oneLine}>&ldquo;{card.one_line}&rdquo;</Text>}

      {card.evidence && card.evidence.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>▸ 근거</Text>
          {card.evidence.map((e, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{e}</Text>
            </View>
          ))}
        </View>
      )}

      {card.case_study && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>▸ 사례</Text>
          <Text style={styles.sectionBody}>{card.case_study}</Text>
        </View>
      )}

      {card.closing && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>▸ 마무리</Text>
          <Text style={styles.sectionBody}>{card.closing}</Text>
        </View>
      )}

      {card.source_name && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>▸ 출처</Text>
          <Text style={styles.sectionBody}>{card.source_name}</Text>
          {card.source_url && <Text style={styles.sourceUrl}>{card.source_url}</Text>}
        </View>
      )}

      {card.guide && (
        <View style={styles.guideBox}>
          <Text style={styles.guideTitle}>양변 가이드</Text>
          <Text style={styles.sectionBody}>{card.guide}</Text>
        </View>
      )}

      {tp && (
        <View style={styles.talkBox}>
          <Text style={styles.talkTitle}>▸ 토킹 포인트</Text>
          {tp.hook && (
            <Text style={styles.talkItem}>
              <Text style={styles.talkLabel}>훅 아이디어: </Text>
              {tp.hook}
            </Text>
          )}
          {tp.facts && tp.facts.length > 0 && (
            <View style={styles.talkFactsWrap}>
              <Text style={styles.talkItem}>
                <Text style={styles.talkLabel}>전달하면 좋을 사실:</Text>
              </Text>
              {tp.facts.map((f, i) => (
                <View key={i} style={styles.talkFactRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={[styles.bulletText, { fontSize: 10.5 }]}>{f}</Text>
                </View>
              ))}
            </View>
          )}
          {tp.case_tip && (
            <Text style={styles.talkItem}>
              <Text style={styles.talkLabel}>사례 활용 팁: </Text>
              {tp.case_tip}
            </Text>
          )}
          {tp.closing_idea && (
            <Text style={styles.talkItem}>
              <Text style={styles.talkLabel}>마무리 아이디어: </Text>
              {tp.closing_idea}
            </Text>
          )}
          {tp.avoid && (
            <Text style={styles.talkItem}>
              <Text style={styles.talkLabel}>피하면 좋을 것: </Text>
              {tp.avoid}
            </Text>
          )}
        </View>
      )}
    </Page>
  )
}

// ─── 롱폼 페이지 ───
function LongPage({ longCards }: { longCards: PdfCard[] }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.longHeader}>롱폼 후보</Text>
      {longCards.map((c, i) => (
        <View key={c.id} style={styles.longItem}>
          <Text style={styles.longIdx}>#{i + 1}</Text>
          <Text style={styles.longTitle}>{c.title}</Text>
          {c.topic_summary && <Text style={styles.longBody}>{c.topic_summary}</Text>}
        </View>
      ))}
    </Page>
  )
}

// ─── 엔트리 ───
export default function PdfTemplate({ cards, longCards, date, title }: Props) {
  return (
    <Document>
      <SummaryPage cards={cards} longCards={longCards} date={date} title={title} />
      {cards.map((c, i) => (
        <CardPage key={c.id} card={c} index={i} total={cards.length} />
      ))}
      {longCards.length > 0 && <LongPage longCards={longCards} />}
    </Document>
  )
}

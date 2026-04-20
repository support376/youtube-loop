import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Pencil, Pause, Trash2, Star, TrendingUp, Users } from 'lucide-react'

type CardStatus = '초안' | '승인' | '수정중' | '보류' | '폐기'

interface PlanCard {
  id: string
  title: string
  topic_summary: string
  recommendation_reason: string
  shorts_fit: number            // 0~5
  score_total: number           // 0~100
  competitor_note: string
  status: CardStatus
}

const MOCK_CARDS: PlanCard[] = [
  {
    id: 'p1',
    title: '전세사기 피해자 구제 신청 기간 연장 — 3가지 챙길 것',
    topic_summary: '전세사기 특별법 개정안 시행. 피해자 인정 기준 확대.',
    recommendation_reason: '뉴스 인기 섹션 1위 + 지난주 "전세사기" 키워드 영상 평균 조회수 +38%',
    shorts_fit: 4,
    score_total: 82,
    competitor_note: '법률전문 채널 2곳이 어제 업로드. 쇼츠는 아직 없음.',
    status: '초안',
  },
  {
    id: 'p2',
    title: '이혼 시 퇴직연금 분할 — 대법원 판례 정리',
    topic_summary: '2026년 판례로 퇴직연금 분할 기준 명확화.',
    recommendation_reason: '"이혼" 주제 우선 순위 + 숫자형 제목 CTR +22%',
    shorts_fit: 5,
    score_total: 78,
    competitor_note: '경쟁 적음. 포털 검색량 주간 +15%',
    status: '초안',
  },
  {
    id: 'p3',
    title: '층간소음 신고 실전 가이드 — 경찰 부를까 말까',
    topic_summary: '더쿠 핫글, 에펨코리아 실시간 공감 TOP.',
    recommendation_reason: '커뮤니티 화제성 높음. 생활밀착형 쇼츠 평균 조회 2배',
    shorts_fit: 5,
    score_total: 71,
    competitor_note: '유사 영상 다수. 차별점 각도 필요.',
    status: '초안',
  },
  {
    id: 'p4',
    title: '상속세 절세 구조 3단계 — 증여 타이밍',
    topic_summary: '수임 연결 포인트 있음. 세법 개정 이슈.',
    recommendation_reason: '수임 모드 가중치에서 최고점. 실익형 롱폼 평균 조회수 상위',
    shorts_fit: 2,
    score_total: 66,
    competitor_note: '전문 채널 과밀. 롱폼 전략이 유리.',
    status: '초안',
  },
]

const STATUS_COLORS: Record<CardStatus, string> = {
  초안: 'bg-[var(--bg-hover)] text-[var(--text-secondary)]',
  승인: 'bg-[var(--green-soft)] text-[var(--green)]',
  수정중: 'bg-amber-500/15 text-amber-400',
  보류: 'bg-blue-500/15 text-blue-400',
  폐기: 'bg-[var(--accent-soft)] text-[var(--accent)]',
}

export default function PlanDraft() {
  const [cards, setCards] = useState<PlanCard[]>(MOCK_CARDS)

  const updateStatus = (id: string, status: CardStatus) => {
    setCards(prev => prev.map(c => (c.id === id ? { ...c, status } : c)))
  }

  const active = cards.filter(c => c.status === '초안' || c.status === '수정중')
  const settled = cards.filter(c => c.status === '승인' || c.status === '보류' || c.status === '폐기')

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">기획안</h2>
        <span className="text-xs text-[var(--text-secondary)]">
          초안 {cards.filter(c => c.status === '초안').length} · 승인 {cards.filter(c => c.status === '승인').length}
        </span>
      </div>

      {active.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {active.map((card, i) => (
            <Card key={card.id} card={card} index={i} onAction={updateStatus} />
          ))}
        </div>
      )}

      {settled.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
            처리 완료
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {settled.map((card, i) => (
              <Card key={card.id} card={card} index={i} onAction={updateStatus} dimmed />
            ))}
          </div>
        </div>
      )}

      {cards.length === 0 && (
        <div className="text-center py-16 text-[var(--text-secondary)]">기획안이 없습니다.</div>
      )}
    </motion.div>
  )
}

function Card({
  card,
  index,
  onAction,
  dimmed = false,
}: {
  card: PlanCard
  index: number
  onAction: (id: string, status: CardStatus) => void
  dimmed?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: dimmed ? 0.55 : 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-5 flex flex-col gap-4"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-base leading-snug flex-1">{card.title}</h3>
        <span
          className={`shrink-0 px-2.5 py-1 text-xs rounded-full font-medium ${STATUS_COLORS[card.status]}`}
        >
          {card.status}
        </span>
      </div>

      <p className="text-sm text-[var(--text-secondary)]">{card.topic_summary}</p>

      {/* 메트릭 그리드 */}
      <div className="grid grid-cols-3 gap-3">
        <Metric
          icon={<TrendingUp size={14} />}
          label="스코어"
          value={
            <span className="text-lg font-bold tabular-nums">{card.score_total}</span>
          }
        />
        <Metric
          label="쇼츠 적합도"
          value={
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={14}
                  className={
                    i < card.shorts_fit
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-[var(--border)]'
                  }
                />
              ))}
            </div>
          }
        />
        <Metric
          icon={<Users size={14} />}
          label="경쟁"
          value={
            <span className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-snug">
              {card.competitor_note}
            </span>
          }
        />
      </div>

      <div className="p-3 rounded-xl bg-[var(--bg-hover)]">
        <p className="text-xs text-[var(--text-secondary)] mb-1 font-semibold uppercase tracking-wide">
          추천 이유
        </p>
        <p className="text-sm">{card.recommendation_reason}</p>
      </div>

      {/* 액션 버튼 */}
      <div className="grid grid-cols-4 gap-2 pt-1">
        <ActionBtn icon={<Check size={14} />} label="승인" color="green"
          active={card.status === '승인'} onClick={() => onAction(card.id, '승인')} />
        <ActionBtn icon={<Pencil size={14} />} label="수정" color="amber"
          active={card.status === '수정중'} onClick={() => onAction(card.id, '수정중')} />
        <ActionBtn icon={<Pause size={14} />} label="보류" color="blue"
          active={card.status === '보류'} onClick={() => onAction(card.id, '보류')} />
        <ActionBtn icon={<Trash2 size={14} />} label="폐기" color="red"
          active={card.status === '폐기'} onClick={() => onAction(card.id, '폐기')} />
      </div>
    </motion.div>
  )
}

function Metric({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)] mb-1">
        {icon}
        {label}
      </div>
      <div>{value}</div>
    </div>
  )
}

function ActionBtn({
  icon,
  label,
  color,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  color: 'green' | 'amber' | 'blue' | 'red'
  active: boolean
  onClick: () => void
}) {
  const colorMap: Record<typeof color, string> = {
    green: active ? 'bg-[var(--green)] text-white' : 'hover:bg-[var(--green-soft)] hover:text-[var(--green)]',
    amber: active ? 'bg-amber-500 text-white' : 'hover:bg-amber-500/15 hover:text-amber-400',
    blue: active ? 'bg-blue-500 text-white' : 'hover:bg-blue-500/15 hover:text-blue-400',
    red: active ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]',
  }
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition bg-[var(--bg-hover)] text-[var(--text-secondary)] ${colorMap[color]}`}
    >
      {icon}
      {label}
    </button>
  )
}

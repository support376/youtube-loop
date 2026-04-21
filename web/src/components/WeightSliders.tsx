import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Sliders } from 'lucide-react'

export const WEIGHT_KEYS = [
  '화제성',
  '법률연결성',
  '시청자실익',
  '수익성',
  '경쟁도',
  '지속성',
] as const

export type WeightKey = typeof WEIGHT_KEYS[number]
export type Weights = Record<WeightKey, number>

export const DEFAULT_WEIGHTS: Weights = {
  화제성: 30,
  법률연결성: 25,
  시청자실익: 10,
  수익성: 15,
  경쟁도: 10,
  지속성: 10,
}

const PRESETS: { id: string; name: string; weights: Weights }[] = [
  {
    id: 'viral',
    name: '바이럴 모드',
    weights: { 화제성: 40, 법률연결성: 20, 시청자실익: 10, 수익성: 10, 경쟁도: 10, 지속성: 10 },
  },
  {
    id: 'client',
    name: '수임 모드',
    weights: { 화제성: 15, 법률연결성: 25, 시청자실익: 10, 수익성: 30, 경쟁도: 10, 지속성: 10 },
  },
]

function rebalance(prev: Weights, key: WeightKey, newVal: number): Weights {
  const clamped = Math.max(0, Math.min(100, Math.round(newVal)))
  const remaining = 100 - clamped

  const others = WEIGHT_KEYS.filter(k => k !== key)
  const sumOthers = others.reduce((a, k) => a + prev[k], 0)

  const next: Weights = { ...prev, [key]: clamped }

  if (sumOthers === 0) {
    others.forEach(k => (next[k] = 0))
  } else {
    others.forEach(k => {
      next[k] = Math.round((prev[k] * remaining) / sumOthers)
    })
  }

  // 반올림 잔차 보정: 가장 큰 other에 보정
  const total = WEIGHT_KEYS.reduce((a, k) => a + next[k], 0)
  const diff = 100 - total
  if (diff !== 0) {
    const largest = others.reduce((a, b) => (next[a] >= next[b] ? a : b), others[0])
    next[largest] = Math.max(0, next[largest] + diff)
  }
  return next
}

function equalWeights(a: Weights, b: Weights): boolean {
  return WEIGHT_KEYS.every(k => a[k] === b[k])
}

interface Props {
  initial?: Weights
  weights?: Weights
  onChange?: (w: Weights) => void
}

export default function WeightSliders({ initial = DEFAULT_WEIGHTS, weights: controlled, onChange }: Props) {
  const [internal, setInternal] = useState<Weights>(initial)
  const [open, setOpen] = useState(true)

  const weights = controlled ?? internal
  const setWeights = (next: Weights) => {
    if (controlled === undefined) setInternal(next)
    onChange?.(next)
  }

  const activePreset = PRESETS.find(p => equalWeights(p.weights, weights))?.id ?? 'custom'
  const total = WEIGHT_KEYS.reduce((a, k) => a + weights[k], 0)

  const applyPreset = (id: string) => {
    if (id === 'custom') return
    const preset = PRESETS.find(p => p.id === id)
    if (!preset) return
    setWeights(preset.weights)
  }

  const handleSlide = (key: WeightKey, v: number) => {
    const next = rebalance(weights, key, v)
    setWeights(next)
  }

  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-[var(--bg-hover)] transition"
      >
        <div className="flex items-center gap-3">
          <Sliders size={16} className="text-[var(--accent)]" />
          <span className="font-semibold text-sm">스코어 가중치</span>
          <span className="text-xs text-[var(--text-secondary)]">
            {PRESETS.find(p => p.id === activePreset)?.name || '커스텀'} · 합계 {total}%
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`text-[var(--text-secondary)] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 py-5 border-t border-[var(--border)] space-y-5">
              {/* 프리셋 버튼 */}
              <div className="flex flex-wrap gap-2">
                {[...PRESETS, { id: 'custom', name: '커스텀', weights: DEFAULT_WEIGHTS }].map(p => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p.id)}
                    className={`px-4 py-1.5 text-xs font-medium rounded-full transition ${
                      activePreset === p.id
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              {/* 슬라이더 그리드 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                {WEIGHT_KEYS.map(key => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-[var(--text-secondary)]">{key}</span>
                      <span className="text-sm font-semibold tabular-nums">{weights[key]}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={weights[key]}
                      onChange={e => handleSlide(key, parseInt(e.target.value))}
                      className="w-full accent-[var(--accent)] cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

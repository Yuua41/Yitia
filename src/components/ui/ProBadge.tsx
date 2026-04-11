import type { RuleConfig } from '@/types'

interface Props {
  playerId?: string
  config: RuleConfig
  size?: number
  marginLeft?: number
}

export default function ProBadge({ playerId, config, size = 15, marginLeft = 5 }: Props) {
  if (!playerId) return null
  if (!config.proPlayers?.[playerId]) return null
  return (
    <span
      title="プロ"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: `${size}px`, height: `${size}px`, borderRadius: '50%',
        background: 'var(--gold)', color: '#fff',
        fontSize: `${Math.max(8, Math.round(size * 0.6))}px`,
        fontWeight: 800, fontFamily: 'monospace',
        marginLeft: `${marginLeft}px`, verticalAlign: 'middle', flexShrink: 0,
        lineHeight: 1,
      }}
    >P</span>
  )
}

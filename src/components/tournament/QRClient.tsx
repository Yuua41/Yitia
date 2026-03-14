'use client'

import { useEffect, useRef } from 'react'
import type { Tournament, Player } from '@/types'
import HeaderIcons from '@/components/ui/HeaderIcons'

interface Props {
  tournament: Tournament
  players: Player[]
  adminToken?: string
  isOwner?: boolean
}

export default function QRClient({ tournament, players, adminToken, isOwner = true }: Props) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .qr-header { padding: 0 16px !important; }
          .qr-content { padding: 16px !important; }
        }
        @media print {
          body, body * { visibility: hidden; }
          #qr-print-area, #qr-print-area * { visibility: visible !important; }
          #qr-print-area {
            position: absolute; top: 0; left: 0; width: 100%;
            background: #fff !important; color: #000 !important;
          }
          #qr-print-area div {
            background: transparent !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            border-color: #ccc !important;
            color: #000 !important;
            box-shadow: none !important;
          }
          #qr-print-area canvas { visibility: visible !important; }
          .no-print { display: none !important; }
          .qr-grid { grid-template-columns: repeat(4, 1fr) !important; }
        }
      `}</style>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="no-print qr-header" style={{
          height: '52px', background: 'var(--header-bg)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--header-border)',
          padding: '0 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          position: 'relative', zIndex: 100, overflow: 'visible',
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--mist)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tournament.name}</span>
          {isOwner && <HeaderIcons />}
        </div>
        <div className="qr-content" style={{ flex: 1, overflowY: 'auto', padding: '24px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ fontFamily: 'serif', fontSize: '20px', fontWeight: 800 }}>QRコード</div>
            <button className="no-print" onClick={() => window.print()} style={{
              padding: '6px 14px', background: 'transparent', color: 'var(--gold)',
              border: '1.5px solid var(--gold)', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}>PDF出力</button>
          </div>
          <div id="qr-print-area">
            {adminToken && (() => {
              const adminUrl = `${origin}/a/${adminToken}`
              return (
                <div style={{
                  background: 'var(--card-bg)', border: '2px solid var(--cyan-deep)',
                  borderRadius: '12px', padding: '20px', textAlign: 'center',
                  marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' as const, justifyContent: 'center',
                  boxShadow: '0 2px 16px rgba(0,240,255,0.15)',
                }}>
                  <div style={{ background: '#fff', borderRadius: '10px', padding: '8px', flexShrink: 0 }}>
                    <QRCode value={adminUrl} size={110} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--cyan-deep)', marginBottom: '4px' }}>管理者用</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>卓組・成績入力 QR</div>
                    <div style={{ fontSize: '11px', color: 'var(--mist)', marginBottom: '8px' }}>
                      ログインなしで卓組・成績入力、全体成績、QRコードページにアクセスできます
                    </div>
                    <div
                      onClick={() => window.open(adminUrl, '_blank')}
                      style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--cyan-deep)', wordBreak: 'break-all', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      /a/{adminToken}
                    </div>
                  </div>
                </div>
              )
            })()}
            <div className="qr-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))',
              gap: '12px',
            }}>
              {players.map(player => {
                const url = `${origin}/p/${player.token}`
                return (
                  <div key={player.id} style={{
                    background: 'var(--card-bg)',
                    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid var(--card-border)',
                    borderRadius: '12px', padding: '16px', textAlign: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}>
                    <QRCode value={url} size={100} />
                    <div style={{ fontSize: '13px', fontWeight: 700, margin: '10px 0 4px' }}>
                      {player.seat_order + 1}. {player.name}
                    </div>
                    <div
                      onClick={() => window.open(url, '_blank')}
                      style={{ fontSize: '9px', fontFamily: 'monospace', color: 'var(--cyan-deep)', wordBreak: 'break-all', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      /p/{player.token}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function QRCode({ value, size }: { value: string; size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!canvasRef.current) return
    import('qrcode').then(QRCodeLib => {
      QRCodeLib.toCanvas(canvasRef.current!, value, {
        width: size,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      })
    })
  }, [value, size])
  return <canvas ref={canvasRef} style={{ borderRadius: '8px', display: 'block', margin: '0 auto' }} />
}

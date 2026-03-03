'use client'

import { useEffect, useRef } from 'react'
import type { Tournament, Player } from '@/types'

interface Props {
  tournament: Tournament
  players: Player[]
}

export default function QRClient({ tournament, players }: Props) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #qr-print-area, #qr-print-area * { visibility: visible; }
          #qr-print-area { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
          .qr-grid { grid-template-columns: repeat(4, 1fr) !important; }
        }
      `}</style>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="no-print" style={{
          height: '52px', background: '#fff', borderBottom: '1px solid var(--border)',
          padding: '0 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--mist)' }}>{tournament.name} › </span>
            <span style={{ fontSize: '14px', fontWeight: 700 }}>QRコード</span>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 26px' }}>
          <div style={{ fontFamily: 'serif', fontSize: '20px', fontWeight: 800, marginBottom: '3px' }}>QRコード</div>
          <div style={{ fontSize: '12px', color: 'var(--mist)', marginBottom: '18px' }}>
            参加者にQRを見せるとスコア入力・成績確認ができます
          </div>
          <div className="no-print" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button onClick={() => window.print()} style={{
              padding: '8px 16px', background: 'var(--gold)', color: 'var(--navy)',
              border: 'none', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
            }}>PDF出力</button>
          </div>
          <div id="qr-print-area">
            <div className="qr-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))',
              gap: '12px',
            }}>
              {players.map(player => {
                const url = `${origin}/p/${player.token}`
                return (
                  <div key={player.id} style={{
                    background: '#fff', border: '1px solid var(--border)',
                    borderRadius: '12px', padding: '16px', textAlign: 'center',
                    boxShadow: '0 1px 8px rgba(15,21,32,0.07)',
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
        color: { dark: '#0f1e3c', light: '#ffffff' },
      })
    })
  }, [value, size])
  return <canvas ref={canvasRef} style={{ borderRadius: '8px', display: 'block', margin: '0 auto' }} />
}

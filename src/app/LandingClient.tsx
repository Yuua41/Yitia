'use client'

import { useEffect, useState } from 'react'

/* ── Theme toggle (reuse existing pattern) ── */
function useTheme() {
  const [isDark, setIsDark] = useState(true)
  useEffect(() => {
    setIsDark(document.body.getAttribute('data-theme') !== 'light')
  }, [])
  const toggle = () => {
    const next = !isDark
    if (next) {
      document.body.removeAttribute('data-theme')
    } else {
      document.body.setAttribute('data-theme', 'light')
    }
    localStorage.setItem('theme', next ? 'dark' : 'light')
    setIsDark(next)
  }
  return { isDark, toggle }
}

/* ── SVG Icons (header) ── */
const SunIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)
const MoonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
)
const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

/* ── Styles ── */
const container: React.CSSProperties = { maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }

const btnCyan: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: '12px 28px', borderRadius: '10px', fontWeight: 700, fontSize: '15px',
  background: 'linear-gradient(135deg, var(--cyan-deep), var(--cyan-dim))',
  color: '#fff', border: 'none', cursor: 'pointer', transition: 'opacity 0.2s',
}
export default function LandingClient() {
  const { isDark, toggle } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const fadeUp = (): React.CSSProperties => ({
    opacity: 1, transform: 'translateY(0)',
  })

  const navLinks: { href: string; label: string }[] = []

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', color: 'var(--ink)' }}>
      <style>{`
        .lp-link { color: var(--mist); text-decoration: none; transition: color 0.15s; font-size: 14px; }
        .lp-link:hover { color: var(--cyan-deep); }
        .lp-btn:hover { opacity: 0.85; }
        @media (max-width: 768px) {
          .lp-desktop { display: none !important; }
          .lp-footer-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 769px) {
          .lp-mobile { display: none !important; }
        }
        @keyframes lp-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .lp-carousel {
          animation: lp-scroll 45s linear infinite;
        }
        .lp-carousel:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* ── Header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--header-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--header-border)',
      }}>
        <nav style={{ ...container, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--cyan-deep), var(--cyan-dim))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: '20px' }}>Y</span>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '18px', color: 'var(--cyan-deep)' }}>Yitia</div>
              <div style={{ fontSize: '10px', color: 'var(--mist)', letterSpacing: '0.1em' }}>Mahjong Taikai Manager</div>
            </div>
          </div>

          <div className="lp-desktop" style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            {navLinks.map(l => <a key={l.href} href={l.href} className="lp-link">{l.label}</a>)}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={toggle} className="lp-btn" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', color: 'var(--mist)', display: 'flex' }}>
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lp-mobile lp-btn" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', color: 'var(--ink)', display: 'flex' }}>
              {mobileMenuOpen ? <XIcon /> : <MenuIcon />}
            </button>
            <a href="/login" className="lp-desktop">
              <button className="lp-btn" style={btnCyan}>ログイン</button>
            </a>
          </div>
        </nav>

        {mobileMenuOpen && (
          <div style={{ borderTop: '1px solid var(--border-md)', padding: '16px 24px' }}>
            {navLinks.map(l => <a key={l.href} href={l.href} className="lp-link" style={{ display: 'block', padding: '8px 0' }} onClick={() => setMobileMenuOpen(false)}>{l.label}</a>)}
            <a href="/login" style={{ display: 'block', marginTop: '12px' }}>
              <button className="lp-btn" style={{ ...btnCyan, width: '100%' }}>ログイン</button>
            </a>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section style={{ position: 'relative', padding: '80px 0 60px', overflow: 'hidden' }}>
        <div style={{ ...container, position: 'relative', zIndex: 10, textAlign: 'center' }}>
          <div id="hero-title" style={fadeUp()}>
            <h1 style={{ fontSize: 'clamp(28px, 5vw, 52px)', fontWeight: 800, lineHeight: 1.3, marginBottom: '24px' }}>
              麻雀大会の運営を， 
              <br>
              </br>
              <span style={{ color: 'var(--cyan-deep)' }}>一気通貫</span>
              で
            </h1>
          </div>

          <div id="hero-sub" style={fadeUp()}>
          
            <p style={{ fontSize: '14px', color: 'var(--mist)', marginBottom: '40px' }}>
              自動で卓組生成，大会中のモニター表示，参加者用QRコードからアカウント不要の点数入力。<br />
              麻雀大会の運営をシンプルに，スマートに。
            </p>
          </div>

          <div id="hero-cta" style={{ ...fadeUp(), display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/login?mode=register"><button className="lp-btn" style={btnCyan}>無料で始める</button></a>
          </div>

          {/* App Screenshots – auto-scrolling carousel */}
          <div id="hero-mockup" data-animate style={{ ...fadeUp(), marginTop: '48px', overflow: 'hidden' }}>
            <div className="lp-carousel" style={{ display: 'flex', gap: '24px', width: 'max-content' }}>
              {[
                { src: '/screenshots/dashboard-light.png', alt: 'ダッシュボード画面' },
                { src: '/screenshots/schedule-light.png', alt: '卓組・成績入力画面' },
                { src: '/screenshots/standings-light.png', alt: '順位表画面' },
                { src: '/screenshots/monitor-dark.png', alt: 'モニター画面' },
                { src: '/screenshots/qr-light.png', alt: 'QRコード画面' },
                { src: '/screenshots/player-dark.png', alt: '個人ページ' },
                { src: '/screenshots/settings-light.png', alt: '設定画面' },
                { src: '/screenshots/dashboard-light.png', alt: 'ダッシュボード画面' },
                { src: '/screenshots/schedule-light.png', alt: '卓組・成績入力画面' },
                { src: '/screenshots/standings-light.png', alt: '順位表画面' },
                { src: '/screenshots/monitor-dark.png', alt: 'モニター画面' },
                { src: '/screenshots/qr-light.png', alt: 'QRコード画面' },
                { src: '/screenshots/player-dark.png', alt: '個人ページ' },
                { src: '/screenshots/settings-light.png', alt: '設定画面' },
              ].map((img, i) => (
                <img key={i} src={img.src} alt={img.alt}
                  style={{ width: '380px', flexShrink: 0, borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', border: '1px solid var(--border-md)' }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 広告枠 */}
      <div style={{ ...container, padding: '0 24px' }}>
        <div id="ad-slot-lp" style={{ margin:'0 auto', padding:'16px', minHeight:'100px', background:'var(--hover-bg)', border:'1px dashed var(--border-md)', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', color:'var(--mist)' }}><span>AD</span></div>
      </div>

      {/* ── CTA ── */}
      <section id="cta" style={{ padding: '80px 0', background: 'var(--navy)', color: '#fff' }}>
        <div style={{ ...container, textAlign: 'center' }}>
          <div id="cta-title" data-animate style={fadeUp()}>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, marginBottom: '16px' }}>
            紙での成績管理，アガリにしませんか？
            </h2>
           
          </div>
          <div id="cta-btn" data-animate style={fadeUp()}>
            <a href="/login">
              <button className="lp-btn" style={{ ...btnCyan, fontSize: '16px', padding: '16px 40px' }}>無料で始める</button>
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid var(--border-md)', padding: '48px 0', background: 'var(--surface)' }}>
        <div style={container}>
         
          <div style={{ borderTop: '1px solid var(--border-md)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <p style={{ fontSize: '13px', color: 'var(--mist)' }}>&copy; 2026 Yitia. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

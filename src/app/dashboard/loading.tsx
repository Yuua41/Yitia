export default function DashboardLoading() {
  const cardShadow = '0 2px 8px rgba(0,0,0,0.3)'

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header skeleton */}
      <div style={{
        height: '56px',
        background: 'rgba(10,14,30,0.85)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0,240,255,0.08)',
        padding: '0 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div className="skeleton-pulse" style={{ width: '80px', height: '17px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="skeleton-pulse" style={{ width: '110px', height: '28px', borderRadius: '8px' }} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="skeleton-pulse" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
            <div className="skeleton-pulse" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
            <div className="skeleton-pulse" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
          </div>
        </div>
      </div>

      {/* Grid skeleton */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '14px',
        }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={{
              background: 'rgba(15,21,40,0.5)',
              border: '1px solid rgba(0,240,255,0.10)',
              backdropFilter: 'blur(16px)',
              borderRadius: '16px', overflow: 'hidden',
              boxShadow: cardShadow,
            }}>
              {/* color bar */}
              <div className="skeleton-pulse" style={{ height: '4px', borderRadius: 0 }} />
              <div style={{ padding: '16px 18px 20px' }}>
                {/* top row: badge + buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div className="skeleton-pulse" style={{ width: '52px', height: '22px', borderRadius: '100px' }} />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div className="skeleton-pulse" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                    <div className="skeleton-pulse" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                  </div>
                </div>
                {/* title */}
                <div className="skeleton-pulse" style={{ width: `${60 + (i * 17) % 40}%`, height: '18px', marginBottom: '10px' }} />
                {/* meta */}
                <div className="skeleton-pulse" style={{ width: '55%', height: '12px' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

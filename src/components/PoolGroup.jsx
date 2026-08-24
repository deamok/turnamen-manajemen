import React from 'react';
import { getNamaPeserta } from '../utils/tournament';

const PoolGroup = ({ pool, onInputSkor, tipe, isAdmin }) => {
  const getPesertaNama = (pesertaId) => {
    const peserta = pool.peserta.find(p => p.id === pesertaId);
    return peserta ? getNamaPeserta(peserta) : 'Belum Diketahui';
  };
  return (
    <>
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h3>Klasemen Pool</h3>
        </div>
        <div className="table-container" style={{ padding: '0', border: 'none', background: 'transparent' }}>
          <table className="data-table" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Wins</th>
              <th>Sets</th>
              <th>Points</th>
              <th>Set Ratio</th>
              <th>Point Ratio</th>
            </tr>
          </thead>
          <tbody>
            {pool.klasemen.map((item, index) => (
              <tr key={item.pesertaId}>
                <td>{index + 1}</td>
                <td style={{ fontWeight: index === 0 ? 'bold' : 'normal' }}>
                  {index === 0 && <span style={{ marginRight: '5px' }}>🏆</span>}
                  {getPesertaNama(item.pesertaId)}
                </td>
                <td>{item.menang}</td>
                <td>{item.setMenang || 0}-{item.setKalah || 0}</td>
                <td>{item.poinMenang || 0}-{item.poinKalah || 0}</td>
                <td style={{ color: (item.setMenang || 0) - (item.setKalah || 0) > 0 ? 'var(--color-success)' : (item.setMenang || 0) - (item.setKalah || 0) < 0 ? 'var(--color-danger)' : 'inherit' }}>
                  {(item.setMenang || 0) - (item.setKalah || 0) > 0 ? '+' : ''}{(item.setMenang || 0) - (item.setKalah || 0)}
                </td>
                <td style={{ color: (item.poinMenang || 0) - (item.poinKalah || 0) > 0 ? 'var(--color-success)' : (item.poinMenang || 0) - (item.poinKalah || 0) < 0 ? 'var(--color-danger)' : 'inherit' }}>
                  {(item.poinMenang || 0) - (item.poinKalah || 0) > 0 ? '+' : ''}{(item.poinMenang || 0) - (item.poinKalah || 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Pertandingan</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {pool.pertandingan.map((match) => {
              const nama1 = getNamaPeserta(match.peserta1);
              const nama2 = getNamaPeserta(match.peserta2);
              const isClickable = isAdmin;

              return (
                <div key={match.id} style={{
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid var(--glass-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  {/* Header Match */}
                  <div style={{ 
                    padding: '8px 15px', 
                    background: 'var(--primary-color)', 
                    color: 'white', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    fontSize: '0.72rem', 
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}>
                    <span>
                      POOL 
                      {(match.jam || match.meja || match.tanggal) && (
                        <span style={{ marginLeft: '6px', opacity: 0.85 }}>
                          [{match.tanggal ? `${match.tanggal.split('-').slice(1).join('/')} ` : ''}{match.jam || ''} | {match.meja || '-'}]
                        </span>
                      )}
                    </span>
                    {match.selesai ? (
                      <span style={{ background: 'var(--color-success)', padding: '2px 8px', borderRadius: '4px' }}>FINISHED</span>
                    ) : (
                      (match.jam || match.meja) && <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px' }}>SCHEDULED</span>
                    )}
                  </div>
                  
                  {/* Body Match */}
                  <div style={{ padding: '20px 15px', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{
                      padding: '12px',
                      borderRadius: '8px',
                      background: match.pemenang === match.peserta1?.id ? 'rgba(16,185,129,0.15)' : 'transparent',
                      color: match.pemenang === match.peserta1?.id ? 'var(--color-success)' : 'var(--color-text)',
                      fontWeight: match.pemenang === match.peserta1?.id ? 'bold' : 'normal',
                      transition: 'all 0.2s ease'
                    }}>
                      {nama1}
                    </div>
                    
                    <div style={{ padding: '10px 0', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>vs</div>
                    
                    <div style={{
                      padding: '12px',
                      borderRadius: '8px',
                      background: match.pemenang === match.peserta2?.id ? 'rgba(16,185,129,0.15)' : 'transparent',
                      color: match.pemenang === match.peserta2?.id ? 'var(--color-success)' : 'var(--color-text)',
                      fontWeight: match.pemenang === match.peserta2?.id ? 'bold' : 'normal',
                      transition: 'all 0.2s ease'
                    }}>
                      {nama2}
                    </div>
                  </div>

                  {/* Footer Match */}
                  <div style={{ padding: '10px 15px', borderTop: '1px solid var(--glass-border)', textAlign: 'center', fontSize: '0.9rem' }}>
                    {match.selesai ? (
                      <span>Winner: <strong>{match.pemenang === match.peserta1?.id ? nama1 : nama2}</strong></span>
                    ) : (
                      <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
                    )}
                  </div>

                  {/* Button for Admin */}
                  {isAdmin && (
                    <button 
                      className="btn"
                      onClick={() => isClickable && onInputSkor && onInputSkor(match, pool)}
                      style={{ 
                        width: '100%', 
                        borderRadius: '0', 
                        padding: '12px',
                        background: match.selesai ? 'var(--bg-surface)' : 'var(--gradient-primary)',
                        color: match.selesai ? 'var(--color-text-secondary)' : 'white',
                        border: 'none',
                        cursor: match.selesai ? 'default' : 'pointer',
                        borderTop: '1px solid var(--glass-border)'
                      }}
                    >
                      {match.selesai ? (
                        <>
                          <span>📊 Lihat/Edit Skor: {match.skor.map(s => `${s[0]}-${s[1]}`).join(' | ')}</span>
                        </>
                      ) : (
                        '✏️ Input Skor'
                      )}
                    </button>
                  )}

                  {/* Read-only Skor for Non-Admin */}
                  {!isAdmin && match.selesai && (
                    <div style={{ 
                      padding: '12px', 
                      background: 'var(--bg-surface)', 
                      color: 'var(--color-text-secondary)',
                      textAlign: 'center',
                      borderTop: '1px solid var(--glass-border)',
                      fontSize: '0.85rem'
                    }}>
                      📊 Skor: {match.skor.map(s => `${s[0]}-${s[1]}`).join(' | ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export default PoolGroup;

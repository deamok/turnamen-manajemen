import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTurnamen } from '../utils/storage';
import { getNamaPeserta } from '../utils/tournament';
import { parseMatchScore, formatMatchScore } from '../utils/helpers';
import { useAuth } from '../contexts/AuthContext';

const Jadwal = () => {
  const navigate = useNavigate();
  const { currentUser, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua');

  useEffect(() => {
    const fetchAllMatches = async () => {
      setLoading(true);
      try {
        let listTurnamen = (await getTurnamen()) || [];
        
        // Filter turnamen: Superadmin lihat semua. User biasa hanya lihat yg dibuatnya atau diikutinya.
        if (!isSuperAdmin && currentUser) {
          listTurnamen = listTurnamen.filter(t => {
             if (t.ownerUid === currentUser.uid) return true;
             if (t.peserta) {
               return t.peserta.some(p => {
                 if (p.id === currentUser.uid) return true;
                 if (p.pemain1?.id === currentUser.uid) return true;
                 if (p.pemain2?.id === currentUser.uid) return true;
                 return false;
               });
             }
             return false;
          });
        }

        const allMatches = [];

        listTurnamen.forEach(t => {
          const tName = t.nama;
          const tType = t.tipe;
          const tDivisi = t.divisi;
          const tDate = t.jadwalMulai || 'Belum Ditentukan';
          const tStatus = t.status;

          // 1. Ambil dari Babak Pool
          if (t.pools) {
            t.pools.forEach(pool => {
              const matchesList = pool.pertandingan || [];
              matchesList.forEach(m => {
                let status = 'UPCOMING';
                if (m.selesai) {
                  status = 'FINISHED';
                } else if (tStatus === 'pool') {
                  status = 'LIVE';
                }

                allMatches.push({
                  ...m,
                  tId: t.id,
                  tName,
                  tType,
                  tDivisi,
                  tDate: m.tanggal || tDate,
                  stage: `Pool ${pool.nama.split(' ').pop()}`,
                  status
                });
              });
            });
          }

          // 2. Ambil dari Babak Eliminasi
          if (t.bracket && t.bracket.rounds) {
            t.bracket.rounds.forEach(round => {
              const matchesList = round.pertandingan || [];
              matchesList.forEach(m => {
                // Jangan masukkan match bye (null vs null atau salah satu null) ke jadwal umum jika belum terisi
                if (!m.peserta1 && !m.peserta2) return;

                let status = 'UPCOMING';
                if (m.selesai) {
                  status = 'FINISHED';
                } else if (tStatus === 'eliminasi' && m.peserta1 && m.peserta2) {
                  status = 'LIVE';
                }

                allMatches.push({
                  ...m,
                  tId: t.id,
                  tName,
                  tType,
                  tDivisi,
                  tDate: m.tanggal || tDate,
                  stage: round.nama,
                  status
                });
              });
            });
          }
        });

        setMatches(allMatches);
      } catch (error) {
        console.error("Gagal memuat jadwal:", error);
      } finally {
        setLoading(false);
      }
    };

    if (currentUser !== undefined) fetchAllMatches();
  }, [currentUser, isSuperAdmin]);

  const getDisplayName = (peserta, opponent = null, isSelesai = false) => {
    if (!peserta) {
      if (isSelesai && opponent) return 'BYE';
      return 'Menunggu...';
    }
    return getNamaPeserta(peserta);
  };

  const getPTMName = (peserta) => {
    if (!peserta) return '';
    if (peserta.pemain1) {
      return peserta.pemain1.namaPTM || 'Umum';
    }
    return peserta.namaPTM || 'Umum';
  };

  // Hitung jumlah skor set yang dimenangkan masing-masing
  const getSetsWon = (match, playerNum) => {
    if (!match.selesai || !match.skor) return 0;
    const [p1Wins, p2Wins] = parseMatchScore(match.skor);
    return playerNum === 1 ? p1Wins : p2Wins;
  };

  const formatIndonesianDate = (dateStr) => {
    if (!dateStr || dateStr === 'Belum Ditentukan') return 'Tanggal Belum Ditentukan';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  const [detailMatch, setDetailMatch] = useState(null);

  // Filter logika
  const filteredMatches = matches.filter(m => {
    const p1Name = m.peserta1 ? getDisplayName(m.peserta1).toLowerCase() : '';
    const p2Name = m.peserta2 ? getDisplayName(m.peserta2).toLowerCase() : '';
    const ptm1 = m.peserta1 ? getPTMName(m.peserta1).toLowerCase() : '';
    const ptm2 = m.peserta2 ? getPTMName(m.peserta2).toLowerCase() : '';
    const tName = m.tName.toLowerCase();
    const query = searchQuery.toLowerCase();

    // 1. Filter Pencarian
    const matchQuery = 
      p1Name.includes(query) || 
      p2Name.includes(query) || 
      ptm1.includes(query) || 
      ptm2.includes(query) || 
      tName.includes(query) ||
      m.stage.toLowerCase().includes(query);

    // 2. Filter Status Tab
    let matchStatus = true;
    if (statusFilter === 'Live') {
      matchStatus = m.status === 'LIVE';
    } else if (statusFilter === 'Terjadwal') {
      matchStatus = m.status === 'UPCOMING';
    } else if (statusFilter === 'Selesai') {
      matchStatus = m.status === 'FINISHED';
    }

    return matchQuery && matchStatus;
  });

  // Kelompokkan hasil berdasarkan tanggal (tDate)
  const groupedMatches = {};
  filteredMatches.forEach(m => {
    if (!groupedMatches[m.tDate]) {
      groupedMatches[m.tDate] = [];
    }
    groupedMatches[m.tDate].push(m);
  });

  // Urutkan tanggal (terbaru dulu atau terlama dulu)
  const sortedDates = Object.keys(groupedMatches).sort((a, b) => {
    if (a === 'Belum Ditentukan') return 1;
    if (b === 'Belum Ditentukan') return -1;
    return new Date(b) - new Date(a);
  });

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', marginTop: '50px' }}>
        <h2>Memuat Catatan Pertandingan...</h2>
      </div>
    );
  }

  return (
    <div className="page-container fade-in">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4" style={{ marginBottom: '30px' }}>
        <div>
          <h1 className="font-display" style={{ fontSize: '2.5rem', margin: 0, textTransform: 'uppercase', color: 'var(--text-primary)' }}>Catatan Pertandingan</h1>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '5px' }}>
            Catatan semua hasil pertandingan di babak pool dan penyisihan secara lengkap, dikelompokkan per hari pelaksanaan turnamen.
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="panel" style={{ padding: '20px', marginBottom: '30px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Search Input */}
            <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Cari pemain, klub PTM, atau turnamen..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '40px' }}
              />
              <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
            </div>

            {/* Status Filters */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '5px' }}>Status:</span>
              {['Semua', 'Live', 'Terjadwal', 'Selesai'].map(status => (
                <button
                  key={status}
                  className={`btn btn-sm ${statusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setStatusFilter(status)}
                >
                  {status === 'Live' ? '🔴 LIVE' : status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Match List Grouped by Day */}
      {sortedDates.length === 0 ? (
        <div className="panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '15px' }}>📅</div>
          <h3>Tidak ada catatan pertandingan ditemukan</h3>
          <p style={{ marginTop: '10px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Silakan sesuaikan filter pencarian atau status Bapak.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          {sortedDates.map(date => (
            <div key={date}>
              {/* Date Header */}
              <h3 className="font-display" style={{ 
                fontSize: '1.4rem', 
                marginBottom: '15px', 
                color: 'var(--primary-color)', 
                borderBottom: '1px solid rgba(0, 200, 255, 0.2)',
                paddingBottom: '8px'
              }}>
                📅 {formatIndonesianDate(date)}
              </h3>

              {/* Matches list for this date */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {groupedMatches[date].sort((a, b) => {
                  if (!a.jam) return -1;
                  if (!b.jam) return 1;
                  return a.jam.localeCompare(b.jam);
                }).map(match => {
                  const isFinished = match.status === 'FINISHED';
                  const isLive = match.status === 'LIVE';
                  const p1Winner = isFinished && match.pemenang === match.peserta1?.id;
                  const p2Winner = isFinished && match.pemenang === match.peserta2?.id;

                  return (
                    <div 
                      key={match.id} 
                      className="card"
                      onClick={() => setDetailMatch(match)}
                      style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap',
                        alignItems: 'center', 
                        padding: '15px 20px', 
                        cursor: 'pointer',
                        gap: '15px',
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid var(--border-light)'
                      }}
                    >
                      {/* Left: Status Badge */}
                      <div style={{ minWidth: '100px' }}>
                        {isLive && (
                          <span className="badge" style={{ 
                            background: 'rgba(244, 63, 94, 0.15)', 
                            color: 'var(--danger-color)', 
                            border: '1px solid rgba(244, 63, 94, 0.3)',
                            fontWeight: 'bold',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}>
                            <span className="animate-pulse" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--danger-color)' }}></span>
                            LIVE
                          </span>
                        )}
                        {isFinished && (
                          <span className="badge badge-success">SELESAI</span>
                        )}
                        {!isFinished && !isLive && (
                          <span className="badge badge-warning" style={{ background: 'rgba(245, 158, 11, 0.08)', color: 'var(--warning-color)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>JADWAL</span>
                        )}
                      </div>

                      {/* Center: Matchup (P1 vs P2) */}
                      <div style={{ flex: 1, minWidth: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                        {/* Player 1 */}
                        <div style={{ flex: 1, textAlign: 'right' }}>
                          <span style={{ fontWeight: p1Winner ? 'bold' : 'normal', color: p1Winner ? 'var(--color-success)' : 'var(--text-primary)', fontSize: '0.95rem' }}>
                            {getDisplayName(match.peserta1, match.peserta2, match.selesai)}
                          </span>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {getPTMName(match.peserta1)}
                          </span>
                        </div>

                        {/* Versus / Score */}
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          minWidth: isFinished && (!match.peserta1 || !match.peserta2) ? '90px' : '70px',
                          height: '34px',
                          borderRadius: '6px',
                          background: isLive ? 'rgba(244, 63, 94, 0.1)' : 'rgba(0,0,0,0.2)',
                          border: isLive ? '1px solid rgba(244, 63, 94, 0.2)' : '1px solid var(--border-light)',
                          padding: '0 10px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 'bold',
                          fontSize: isFinished && (!match.peserta1 || !match.peserta2) ? '0.75rem' : '1rem',
                          color: isLive ? 'var(--danger-color)' : 'var(--text-secondary)'
                        }}>
                          {isFinished ? (
                            (!match.peserta1 || !match.peserta2) ? (
                              <span style={{ color: 'var(--color-success)', fontStyle: 'italic' }}>MENANG BYE</span>
                            ) : (
                              <span>{getSetsWon(match, 1)} - {getSetsWon(match, 2)}</span>
                            )
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>VS</span>
                          )}
                        </div>

                        {/* Player 2 */}
                        <div style={{ flex: 1, textAlign: 'left' }}>
                          <span style={{ fontWeight: p2Winner ? 'bold' : 'normal', color: p2Winner ? 'var(--color-success)' : 'var(--text-primary)', fontSize: '0.95rem' }}>
                            {getDisplayName(match.peserta2, match.peserta1, match.selesai)}
                          </span>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {getPTMName(match.peserta2)}
                          </span>
                        </div>
                      </div>

                      {/* Right: Tournament Context */}
                      <div style={{ minWidth: '220px', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{match.tName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {match.tType === 'Single' ? '👤 Single' : '👥 Double'} • Div {match.tDivisi} • <span style={{ color: 'var(--primary-color)' }}>{match.stage}</span>
                        </div>
                        {(match.jam || match.meja) && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--warning-color)', fontWeight: 'bold', marginTop: '2px' }}>
                            ⏰ {match.jam || '-'} • 🏓 {match.meja || '-'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Match Result Detail Modal */}
      {detailMatch && (
        <div className="modal-overlay" onClick={() => setDetailMatch(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>📊 Detail Hasil Skor</h3>
              <button 
                onClick={() => setDetailMatch(null)} 
                className="btn btn-secondary btn-sm"
                style={{ padding: '4px 8px', borderRadius: '50%' }}
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Context */}
              <div style={{ textAlign: 'center' }}>
                <span className="badge badge-primary" style={{ fontSize: '0.75rem', marginBottom: '5px' }}>
                  {detailMatch.tName}
                </span>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {detailMatch.tType === 'Single' ? '👤 Tunggal (Single)' : '👥 Ganda (Double)'} • Divisi {detailMatch.tDivisi} • <strong>{detailMatch.stage}</strong>
                </div>
                {(detailMatch.jam || detailMatch.meja || detailMatch.tanggal) && (
                  <div style={{ color: 'var(--warning-color)', fontWeight: 'bold', marginTop: '5px', fontSize: '0.85rem' }}>
                    ⏰ {detailMatch.jam || '-'} • 🏓 {detailMatch.meja || '-'} {detailMatch.tanggal && `• 📅 ${formatIndonesianDate(detailMatch.tanggal)}`}
                  </div>
                )}
              </div>

              {/* Match Score Display */}
              <div style={{ 
                background: 'rgba(0,0,0,0.2)', 
                border: '1px solid var(--border-light)', 
                borderRadius: '8px', 
                padding: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '15px'
              }}>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-primary)' }}>{getDisplayName(detailMatch.peserta1)}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{getPTMName(detailMatch.peserta1)}</div>
                </div>

                <div style={{ 
                  fontFamily: 'var(--font-mono)', 
                  fontWeight: 'bold', 
                  fontSize: '1.4rem', 
                  color: 'var(--primary-color)',
                  background: 'rgba(0,0,0,0.3)',
                  padding: '4px 12px',
                  borderRadius: '6px'
                }}>
                  {detailMatch.status === 'FINISHED' ? (
                    `${getSetsWon(detailMatch, 1)} - ${getSetsWon(detailMatch, 2)}`
                  ) : (
                    'VS'
                  )}
                </div>

                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-primary)' }}>{getDisplayName(detailMatch.peserta2)}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{getPTMName(detailMatch.peserta2)}</div>
                </div>
              </div>

              {/* Sets Breakdown */}
              <div>
                <h4 style={{ 
                  fontSize: '0.9rem', 
                  color: 'var(--primary-color)', 
                  marginBottom: '10px',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '5px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Hasil / Skor Pertandingan
                </h4>

                {detailMatch.skor && (Array.isArray(detailMatch.skor) ? detailMatch.skor.length > 0 : true) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 18px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)'
                    }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Skor Set</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', fontSize: '1.4rem' }}>
                        {formatMatchScore(detailMatch.skor)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: '20px 0', fontSize: '0.9rem' }}>
                    {detailMatch.status === 'LIVE' ? '🔴 Sedang berlangsung. Skor set belum tercatat.' : '📅 Pertandingan terjadwal. Menunggu permainan dimulai.'}
                  </p>
                )}
              </div>

              {/* Winner Banner */}
              {detailMatch.status === 'FINISHED' && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  color: 'var(--success-color)',
                  padding: '10px',
                  borderRadius: '6px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}>
                  🏆 PEMENANG: {detailMatch.pemenang === detailMatch.peserta1?.id ? getDisplayName(detailMatch.peserta1) : getDisplayName(detailMatch.peserta2)}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setDetailMatch(null)}
              >
                Tutup
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  setDetailMatch(null);
                  navigate(`/turnamen/${detailMatch.tId}`);
                }}
              >
                Buka Turnamen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Jadwal;

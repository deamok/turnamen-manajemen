import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLigaById, updateLiga, deleteLiga } from '../utils/storage';
import { hitungKlasemenLiga, calculateLeagueStats } from '../utils/league';
import { tentukanPemenang } from '../utils/tournament';
import { useAuth } from '../contexts/AuthContext';
import { formatTanggal } from '../utils/helpers';

const LeagueDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, isSuperAdmin } = useAuth();

  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('klasemen'); // 'klasemen' | 'jadwal' | 'statistik' | 'pengaturan'
  const [selectedPekan, setSelectedPekan] = useState('semua');

  // Score Modal State
  const [activeMatch, setActiveMatch] = useState(null);
  const [activePekan, setActivePekan] = useState(null);
  const [scores, setScores] = useState(Array.from({ length: 5 }, () => ['', '']));
  const [modalMeja, setModalMeja] = useState('Meja 1');
  const [modalJam, setModalJam] = useState('09:00');
  const [showScoreModal, setShowScoreModal] = useState(false);

  // Digital Scoreboard Fullscreen
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [liveP1Score, setLiveP1Score] = useState(0);
  const [liveP2Score, setLiveP2Score] = useState(0);
  const [liveP1Sets, setLiveP1Sets] = useState(0);
  const [liveP2Sets, setLiveP2Sets] = useState(0);
  const [liveHistory, setLiveHistory] = useState([]);
  const [servingPlayer, setServingPlayer] = useState(1); // 1 or 2

  const loadLeague = async () => {
    try {
      const data = await getLigaById(id);
      if (data) {
        setLeague(data);
      } else {
        alert("Liga tidak ditemukan!");
        navigate('/liga');
      }
    } catch (err) {
      console.error("Error loading league:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLeague();
  }, [id]);

  const canManage = isSuperAdmin || (currentUser && league?.createdBy === currentUser.uid);

  // Open Score Modal
  const handleOpenScoreModal = (pekan, match) => {
    if (!canManage) return;
    setActivePekan(pekan);
    setActiveMatch(match);
    setModalMeja(match.meja || 'Meja 1');
    const now = new Date();
    const currentFormattedTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setModalJam(match.jam && match.jam !== 'Bebas' ? match.jam : currentFormattedTime);

    const maxSets = league.formatSet === 'best_of_3' ? 3 : 5;
    if (match.skor && match.skor.length > 0) {
      const initial = Array.from({ length: maxSets }, (_, i) =>
        match.skor[i] ? [String(match.skor[i][0]), String(match.skor[i][1])] : ['', '']
      );
      setScores(initial);
    } else {
      setScores(Array.from({ length: maxSets }, () => ['', '']));
    }
    setShowScoreModal(true);
  };

  const handleScoreChange = (setIndex, playerIndex, value) => {
    const newScores = scores.map((s, i) =>
      i === setIndex ? s.map((v, j) => (j === playerIndex ? value : v)) : [...s]
    );
    setScores(newScores);
  };

  const handleSaveScore = async () => {
    if (!activeMatch || !activePekan || !league) return;

    const requiredWins = league.formatSet === 'best_of_3' ? 2 : 3;
    const currentValidScores = scores
      .filter(s => s[0] !== '' && s[1] !== '')
      .map(s => [parseInt(s[0]) || 0, parseInt(s[1]) || 0]);

    const winnerNumber = tentukanPemenang(currentValidScores, requiredWins);
    let pemenangId = null;
    let isFinished = false;

    if (winnerNumber === 1) {
      pemenangId = activeMatch.peserta1?.id;
      isFinished = true;
    } else if (winnerNumber === 2) {
      pemenangId = activeMatch.peserta2?.id;
      isFinished = true;
    }

    // Update match inside jadwal
    const updatedJadwal = league.jadwal.map(pekan => {
      if (pekan.id === activePekan.id) {
        return {
          ...pekan,
          pertandingan: pekan.pertandingan.map(m => {
            if (m.id === activeMatch.id) {
              return {
                ...m,
                skor: currentValidScores,
                pemenang: pemenangId,
                selesai: isFinished,
                meja: modalMeja,
                jam: modalJam
              };
            }
            return m;
          })
        };
      }
      return pekan;
    });

    // Recompute standings
    const updatedKlasemen = hitungKlasemenLiga(league.peserta, updatedJadwal, {
      poinMenang: Number(league.poinMenang || 3),
      poinKalah: Number(league.poinKalah || 0)
    });

    const updatedLeague = {
      ...league,
      jadwal: updatedJadwal,
      klasemen: updatedKlasemen
    };

    try {
      await updateLiga(league.id, updatedLeague);
      setLeague(updatedLeague);
      setShowScoreModal(false);
    } catch (err) {
      alert("Gagal menyimpan skor pertandingan: " + err.message);
    }
  };

  // Open Fullscreen Live Scoreboard
  const handleOpenScoreboard = (pekan, match) => {
    setActivePekan(pekan);
    setActiveMatch(match);
    setLiveP1Score(0);
    setLiveP2Score(0);
    setLiveP1Sets(0);
    setLiveP2Sets(0);
    setLiveHistory([]);
    setServingPlayer(1);

    // If there is existing score
    if (match.skor && match.skor.length > 0) {
      let p1Sets = 0;
      let p2Sets = 0;
      match.skor.forEach(s => {
        if (s[0] > s[1]) p1Sets++;
        else if (s[1] > s[0]) p2Sets++;
      });
      setLiveP1Sets(p1Sets);
      setLiveP2Sets(p2Sets);
      setLiveHistory(match.skor.map(s => [...s]));
    }
    setShowScoreboard(true);
  };

  const handleScoreboardPoint = (player) => {
    let newP1 = liveP1Score;
    let newP2 = liveP2Score;

    if (player === 1) newP1 += 1;
    else newP2 += 1;

    setLiveP1Score(newP1);
    setLiveP2Score(newP2);

    // Switch service every 2 points, or every 1 point if deuce (>= 10-10)
    const totalPoints = newP1 + newP2;
    if (newP1 >= 10 && newP2 >= 10) {
      setServingPlayer(totalPoints % 2 === 0 ? 1 : 2);
    } else {
      setServingPlayer(Math.floor(totalPoints / 2) % 2 === 0 ? 1 : 2);
    }

    // Check Set Win (11 points, win by 2)
    if ((newP1 >= 11 || newP2 >= 11) && Math.abs(newP1 - newP2) >= 2) {
      const setWinner = newP1 > newP2 ? 1 : 2;
      const finishedSetScore = [newP1, newP2];
      const newHistory = [...liveHistory, finishedSetScore];
      setLiveHistory(newHistory);

      let newP1Sets = liveP1Sets + (setWinner === 1 ? 1 : 0);
      let newP2Sets = liveP2Sets + (setWinner === 2 ? 1 : 0);
      setLiveP1Sets(newP1Sets);
      setLiveP2Sets(newP2Sets);

      // Reset points for next set
      setLiveP1Score(0);
      setLiveP2Score(0);

      const targetSets = league.formatSet === 'best_of_3' ? 2 : 3;
      if (newP1Sets === targetSets || newP2Sets === targetSets) {
        alert(`Pertandingan Selesai! Pemenang: ${setWinner === 1 ? activeMatch.peserta1?.nama : activeMatch.peserta2?.nama}`);
      }
    }
  };

  const handleSaveScoreboardResult = async () => {
    if (!activeMatch || !activePekan || !league) return;

    let finalScores = [...liveHistory];
    if (liveP1Score > 0 || liveP2Score > 0) {
      finalScores.push([liveP1Score, liveP2Score]);
    }

    const requiredWins = league.formatSet === 'best_of_3' ? 2 : 3;
    const winnerNumber = tentukanPemenang(finalScores, requiredWins);
    let pemenangId = null;
    let isFinished = false;

    if (winnerNumber === 1) {
      pemenangId = activeMatch.peserta1?.id;
      isFinished = true;
    } else if (winnerNumber === 2) {
      pemenangId = activeMatch.peserta2?.id;
      isFinished = true;
    }

    const updatedJadwal = league.jadwal.map(pekan => {
      if (pekan.id === activePekan.id) {
        return {
          ...pekan,
          pertandingan: pekan.pertandingan.map(m => {
            if (m.id === activeMatch.id) {
              return {
                ...m,
                skor: finalScores,
                pemenang: pemenangId,
                selesai: isFinished
              };
            }
            return m;
          })
        };
      }
      return pekan;
    });

    const updatedKlasemen = hitungKlasemenLiga(league.peserta, updatedJadwal, {
      poinMenang: Number(league.poinMenang || 3),
      poinKalah: Number(league.poinKalah || 0)
    });

    const updatedLeague = {
      ...league,
      jadwal: updatedJadwal,
      klasemen: updatedKlasemen
    };

    try {
      await updateLiga(league.id, updatedLeague);
      setLeague(updatedLeague);
      setShowScoreboard(false);
    } catch (err) {
      alert("Gagal menyimpan hasil scoreboard: " + err.message);
    }
  };

  // Toggle Finish League
  const handleToggleSelesaiLiga = async () => {
    if (!canManage) return;

    if (league.status !== 'selesai') {
      const topLeader = league.klasemen && league.klasemen.length > 0 ? league.klasemen[0] : null;
      if (window.confirm(`Selesaikan Liga secara resmi? Peringkat 1 (${topLeader ? topLeader.nama : 'Peserta'}) akan dinobatkan sebagai Juara Liga.`)) {
        const updated = {
          ...league,
          status: 'selesai',
          juara: topLeader ? { id: topLeader.pesertaId, nama: topLeader.nama, namaPTM: topLeader.namaPTM } : null
        };
        await updateLiga(league.id, updated);
        setLeague(updated);
      }
    } else {
      if (window.confirm("Buka kembali Liga ke status Berlangsung?")) {
        const updated = {
          ...league,
          status: 'berlangsung',
          juara: null
        };
        await updateLiga(league.id, updated);
        setLeague(updated);
      }
    }
  };

  const handleDeleteLeague = async () => {
    if (!canManage) return;
    if (window.confirm(`Apakah Anda yakin ingin menghapus liga "${league.nama}" secara permanen?`)) {
      try {
        await deleteLiga(league.id);
        navigate('/liga');
      } catch (e) {
        alert("Gagal menghapus liga: " + e.message);
      }
    }
  };

  if (loading) {
    return <div className="page-container" style={{ textAlign: 'center', marginTop: '50px' }}>Memuat data liga...</div>;
  }

  if (!league) return null;

  const stats = calculateLeagueStats(league);

  return (
    <div className="page-container fade-in">
      {/* Top Breadcrumb & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '10px' }}>
        <button onClick={() => navigate('/liga')} className="btn btn-secondary btn-sm">
          ⬅ Kembali ke Daftar Liga
        </button>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => window.print()} className="btn btn-secondary btn-sm">
            🖨️ Cetak / Print View
          </button>
          {canManage && (
            <button
              onClick={handleToggleSelesaiLiga}
              className={`btn btn-sm ${league.status === 'selesai' ? 'btn-secondary' : 'btn-primary'}`}
            >
              {league.status === 'selesai' ? '🔄 Buka Kembali Liga' : '🏆 Selesaikan Liga & Nobatkan Juara'}
            </button>
          )}
        </div>
      </div>

      {/* Hero Header Panel */}
      <div className="card" style={{
        padding: '24px',
        marginBottom: '2rem',
        border: '1px solid var(--border-color)',
        background: 'linear-gradient(180deg, rgba(15, 19, 36, 0.8) 0%, rgba(22, 27, 51, 0.95) 100%)',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span style={{
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                background: league.status === 'selesai' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0, 200, 255, 0.15)',
                border: league.status === 'selesai' ? '1px solid var(--success-color)' : '1px solid var(--primary-color)',
                color: league.status === 'selesai' ? 'var(--success-color)' : 'var(--primary-color)',
                textTransform: 'uppercase'
              }}>
                {league.status === 'selesai' ? '🏆 LIGA SELESAI' : '⚡ LIGA BERLANGSUNG'}
              </span>
              <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.06)' }}>
                {league.tipe === 'Double' ? '👥 Kategori Ganda' : '👤 Kategori Tunggal'}
              </span>
              <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', background: 'rgba(168, 85, 247, 0.15)', color: 'var(--secondary-color)' }}>
                {league.putaran === 2 ? '🔄 2 Putaran (Home & Away)' : '➡️ 1 Putaran Penuh'}
              </span>
              <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.06)' }}>
                {league.formatSet === 'best_of_3' ? 'Best of 3 Sets' : 'Best of 5 Sets'}
              </span>
            </div>

            <h1 style={{ fontSize: '2.2rem', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
              {league.nama}
            </h1>

            {league.deskripsi && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0, maxWidth: '700px' }}>
                {league.deskripsi}
              </p>
            )}
          </div>

          {/* Quick Stats in Hero */}
          <div style={{
            display: 'flex',
            gap: '16px',
            background: 'var(--bg-surface)',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{league.peserta?.length || 0}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Peserta</div>
            </div>
            <div style={{ width: '1px', background: 'var(--border-light)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--secondary-color)' }}>{league.jadwal?.length || 0}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pekan</div>
            </div>
            <div style={{ width: '1px', background: 'var(--border-light)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--success-color)' }}>{stats?.progressPercent || 0}%</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Selesai</div>
            </div>
          </div>
        </div>

        {/* Winner Banner if Finished */}
        {league.status === 'selesai' && league.juara && (
          <div style={{
            marginTop: '1.5rem',
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(90deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.1) 100%)',
            border: '1px solid rgba(251, 191, 36, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <span style={{ fontSize: '2.5rem' }}>👑</span>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#fbbf24', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.1em' }}>
                JUARA RESMI LIGA TENIS MEJA
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                {league.juara.nama} <span style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>({league.juara.namaPTM})</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '10px',
        borderBottom: '1px solid var(--border-light)',
        marginBottom: '1.5rem',
        overflowX: 'auto',
        paddingBottom: '4px'
      }}>
        {[
          { key: 'klasemen', label: '🏆 Tabel Klasemen', icon: '🏆' },
          { key: 'jadwal', label: '📅 Jadwal & Hasil Pekan', icon: '📅' },
          { key: 'statistik', label: '📊 Statistik & Rekap', icon: '📊' },
          ...(canManage ? [{ key: 'pengaturan', label: '⚙️ Pengaturan Liga', icon: '⚙️' }] : [])
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === tab.key ? '3px solid var(--primary-color)' : '3px solid transparent',
              color: activeTab === tab.key ? 'var(--primary-color)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.key ? 'bold' : '500',
              fontSize: '1rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: KLASEMEN */}
      {activeTab === 'klasemen' && (
        <div className="card" style={{ padding: '20px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.25rem' }}>
              Klasemen Sementara Liga
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Aturan Poin: Menang ({league.poinMenang || 3} Poin) • Kalah ({league.poinKalah || 0} Poin)
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 8px', textAlign: 'center', width: '40px' }}>Pos</th>
                <th style={{ padding: '12px 12px' }}>Peserta / Klub</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>M</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>W</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>L</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>Set (W-L)</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>Sel. Set</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>Poin (W-L)</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>Sel. Poin</th>
                <th style={{ padding: '12px 12px', textAlign: 'center', color: 'var(--primary-color)', fontWeight: 'bold' }}>PTS</th>
                <th style={{ padding: '12px 12px', textAlign: 'center' }}>Form (5 Laga)</th>
              </tr>
            </thead>
            <tbody>
              {(league.klasemen || []).map((row, idx) => {
                let posBadge = `${idx + 1}`;
                let rowBg = 'transparent';

                if (idx === 0) {
                  posBadge = '🥇 1';
                  rowBg = 'rgba(251, 191, 36, 0.06)';
                } else if (idx === 1) {
                  posBadge = '🥈 2';
                  rowBg = 'rgba(156, 163, 175, 0.04)';
                } else if (idx === 2) {
                  posBadge = '🥉 3';
                  rowBg = 'rgba(217, 119, 6, 0.04)';
                }

                return (
                  <tr
                    key={row.pesertaId}
                    style={{
                      borderBottom: '1px solid var(--border-light)',
                      background: rowBg,
                      transition: 'background 0.15s'
                    }}
                  >
                    <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>
                      {posBadge}
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ fontWeight: idx < 3 ? 'bold' : 'normal', color: 'var(--text-primary)' }}>
                        {row.nama}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {row.namaPTM}
                      </div>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>{row.main}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--success-color)', fontWeight: 'bold' }}>{row.menang}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--danger-color)' }}>{row.kalah}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>{row.setMenang}-{row.setKalah}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', color: row.selisihSet > 0 ? 'var(--success-color)' : row.selisihSet < 0 ? 'var(--danger-color)' : 'inherit' }}>
                      {row.selisihSet > 0 ? `+${row.selisihSet}` : row.selisihSet}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>{row.poinMenang}-{row.poinKalah}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', color: row.selisihPoin > 0 ? 'var(--success-color)' : row.selisihPoin < 0 ? 'var(--danger-color)' : 'inherit' }}>
                      {row.selisihPoin > 0 ? `+${row.selisihPoin}` : row.selisihPoin}
                    </td>
                    <td style={{ padding: '12px 12px', textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                      {row.poin}
                    </td>
                    <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        {(row.last5Form || []).length === 0 ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>
                        ) : (
                          row.last5Form.map((f, fIdx) => (
                            <span
                              key={fIdx}
                              style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '4px',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: '0.7rem',
                                fontWeight: 'bold',
                                background: f === 'W' ? 'var(--success-color)' : 'var(--danger-color)',
                                color: '#fff'
                              }}
                            >
                              {f}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Tie-breaker Legend */}
          <div style={{ marginTop: '1.5rem', padding: '12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-elevated)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <strong>💡 Urutan Penentuan Peringkat (Tie-Breaker):</strong> Poin Klasemen (PTS) ➔ Selisih Set (Set Won - Set Lost) ➔ Selisih Angka Poin ➔ Jumlah Set Menang ➔ Nama Peserta.
          </div>
        </div>
      )}

      {/* TAB 2: JADWAL & HASIL PEKAN */}
      {activeTab === 'jadwal' && (
        <div>
          {/* Pekan Filter Pills */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '1.5rem',
            overflowX: 'auto',
            paddingBottom: '6px'
          }}>
            <button
              onClick={() => setSelectedPekan('semua')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                border: selectedPekan === 'semua' ? '1px solid var(--primary-color)' : '1px solid var(--border-light)',
                background: selectedPekan === 'semua' ? 'rgba(0, 200, 255, 0.15)' : 'var(--bg-surface)',
                color: selectedPekan === 'semua' ? 'var(--primary-color)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: selectedPekan === 'semua' ? 'bold' : 'normal',
                whiteSpace: 'nowrap'
              }}
            >
              Semua Pekan
            </button>
            {(league.jadwal || []).map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPekan(p.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  border: selectedPekan === p.id ? '1px solid var(--primary-color)' : '1px solid var(--border-light)',
                  background: selectedPekan === p.id ? 'rgba(0, 200, 255, 0.15)' : 'var(--bg-surface)',
                  color: selectedPekan === p.id ? 'var(--primary-color)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: selectedPekan === p.id ? 'bold' : 'normal',
                  whiteSpace: 'nowrap'
                }}
              >
                {p.nama}
              </button>
            ))}
          </div>

          {/* List of Weeks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {(league.jadwal || [])
              .filter(p => selectedPekan === 'semua' || p.id === selectedPekan)
              .map(pekan => {
                const activeMatches = pekan.pertandingan.filter(m => !m.isBye);
                const byeMatches = pekan.pertandingan.filter(m => m.isBye);

                return (
                  <div key={pekan.id} className="card" style={{ padding: '0', overflow: 'hidden' }}>
                    {/* Week Header */}
                    <div style={{
                      padding: '14px 20px',
                      background: 'rgba(0, 200, 255, 0.08)',
                      borderBottom: '1px solid var(--border-light)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.2rem' }}>📅</span>
                        <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                          {pekan.nama}
                        </h4>
                      </div>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Tanggal: {pekan.tanggal ? formatTanggal(pekan.tanggal) : '-'}
                      </span>
                    </div>

                    {/* Match Cards */}
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {activeMatches.map((m, mIdx) => {
                        const isP1Winner = m.selesai && m.pemenang === m.peserta1?.id;
                        const isP2Winner = m.selesai && m.pemenang === m.peserta2?.id;

                        // Count sets won
                        let p1Sets = 0;
                        let p2Sets = 0;
                        (m.skor || []).forEach(s => {
                          if (s[0] > s[1]) p1Sets++;
                          else if (s[1] > s[0]) p2Sets++;
                        });

                        return (
                          <div
                            key={m.id}
                            style={{
                              padding: '14px 18px',
                              borderRadius: 'var(--radius-md)',
                              background: 'var(--bg-surface-elevated)',
                              border: m.selesai ? '1px solid var(--border-light)' : '1px solid var(--border-color)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '12px'
                            }}
                          >
                            {/* Match Meta */}
                            <div style={{ width: '110px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              <div style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>🏓 {m.meja || 'Meja 1'}</div>
                              <div style={{ marginTop: '2px', fontSize: '0.75rem' }}>⏰ {m.jam && m.jam !== 'Bebas' ? `${m.jam} WIB` : 'Waktu Bebas'}</div>
                            </div>

                            {/* Player 1 vs Player 2 Card */}
                            <div style={{
                              flex: 1,
                              minWidth: '280px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '16px'
                            }}>
                              {/* Player 1 */}
                              <div style={{ flex: 1, textAlign: 'right' }}>
                                <div style={{
                                  fontWeight: isP1Winner ? 'bold' : '500',
                                  color: isP1Winner ? 'var(--primary-color)' : 'var(--text-primary)',
                                  fontSize: '0.95rem'
                                }}>
                                  {isP1Winner && '👑 '} {m.peserta1?.nama}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {m.peserta1?.namaPTM}
                                </div>
                              </div>

                              {/* Score Display */}
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                minWidth: '100px',
                                padding: '6px 12px',
                                background: 'var(--bg-surface)',
                                borderRadius: '8px',
                                border: '1px solid var(--border-light)'
                              }}>
                                {m.selesai ? (
                                  <>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', letterSpacing: '2px', color: 'var(--text-primary)' }}>
                                      {p1Sets} - {p2Sets}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                      {m.skor.map(s => `${s[0]}-${s[1]}`).join(', ')}
                                    </div>
                                  </>
                                ) : (
                                  <div style={{ fontSize: '0.85rem', color: 'var(--warning-color)', fontWeight: 'bold' }}>
                                    VS
                                  </div>
                                )}
                              </div>

                              {/* Player 2 */}
                              <div style={{ flex: 1, textAlign: 'left' }}>
                                <div style={{
                                  fontWeight: isP2Winner ? 'bold' : '500',
                                  color: isP2Winner ? 'var(--primary-color)' : 'var(--text-primary)',
                                  fontSize: '0.95rem'
                                }}>
                                  {m.peserta2?.nama} {isP2Winner && ' 👑'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {m.peserta2?.namaPTM}
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons for Match */}
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {canManage && (
                                <button
                                  onClick={() => handleOpenScoreModal(pekan, m)}
                                  className={`btn btn-sm ${m.selesai ? 'btn-secondary' : 'btn-primary'}`}
                                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                                >
                                  {m.selesai ? '✏️ Edit Skor' : '⚡ Input Skor'}
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenScoreboard(pekan, m)}
                                className="btn btn-secondary btn-sm"
                                title="Papan Skor Digital Langsung"
                                style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                              >
                                📺 Scoreboard
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* BYE Notices */}
                      {byeMatches.map(m => (
                        <div
                          key={m.id}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '6px',
                            background: 'rgba(245, 158, 11, 0.08)',
                            border: '1px solid rgba(245, 158, 11, 0.2)',
                            color: 'var(--warning-color)',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          <span>☕</span> {m.catatan}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 3: STATISTIK */}
      {activeTab === 'statistik' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {/* Ringkasan Liga Card */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', fontSize: '1.2rem' }}>
              📊 Ringkasan Liga
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Pertandingan</span>
                <strong>{stats?.totalMatches || 0} Partai</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Pertandingan Selesai</span>
                <strong style={{ color: 'var(--success-color)' }}>{stats?.finishedMatches || 0} Partai</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Sisa Pertandingan</span>
                <strong style={{ color: 'var(--warning-color)' }}>{stats?.remainingMatches || 0} Partai</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Set Dimainkan</span>
                <strong>{stats?.totalSets || 0} Set</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Poin Angka Tercipta</span>
                <strong>{stats?.totalPoints || 0} Poin</strong>
              </div>
            </div>
          </div>

          {/* Top Performer Card */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', fontSize: '1.2rem' }}>
              🥇 Top Klasemen Sementara
            </h3>
            {league.klasemen && league.klasemen.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {league.klasemen.slice(0, 3).map((p, idx) => (
                  <div
                    key={p.pesertaId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-light)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.4rem' }}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                      <div>
                        <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{p.nama}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.namaPTM}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary-color)', fontSize: '1.1rem' }}>{p.poin} PTS</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.menang}M - {p.kalah}K</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>Belum ada data statistik.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: PENGATURAN (ADMIN ONLY) */}
      {activeTab === 'pengaturan' && canManage && (
        <div className="card" style={{ padding: '24px', maxWidth: '650px' }}>
          <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', fontSize: '1.3rem' }}>
            ⚙️ Pengaturan & Kelola Liga
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-light)'
            }}>
              <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)' }}>Status Kompetisi</h4>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Status saat ini: <strong style={{ textTransform: 'uppercase', color: league.status === 'selesai' ? 'var(--success-color)' : 'var(--primary-color)' }}>{league.status}</strong>
              </p>
              <button
                onClick={handleToggleSelesaiLiga}
                className={`btn ${league.status === 'selesai' ? 'btn-secondary' : 'btn-primary'}`}
              >
                {league.status === 'selesai' ? '🔄 Aktifkan Kembali Liga' : '🏆 Selesaikan Liga Secara Resmi'}
              </button>
            </div>

            <div style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(244, 63, 94, 0.08)',
              border: '1px solid rgba(244, 63, 94, 0.25)'
            }}>
              <h4 style={{ margin: '0 0 6px 0', color: 'var(--danger-color)' }}>Zona Bahaya</h4>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Menghapus liga akan menghapus semua jadwal pekan, pertandingan, dan riwayat klasemen secara permanen.
              </p>
              <button onClick={handleDeleteLeague} className="btn btn-secondary" style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}>
                🗑️ Hapus Liga Ini
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INPUT SKOR PER SET */}
      {showScoreModal && activeMatch && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div className="card fade-in" style={{ width: '100%', maxWidth: '520px', padding: '24px', background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Input Skor Pertandingan</h3>
              <button onClick={() => setShowScoreModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}>
                ✕
              </button>
            </div>

            <div style={{
              padding: '12px',
              borderRadius: '8px',
              background: 'var(--bg-surface-elevated)',
              marginBottom: '16px',
              textAlign: 'center'
            }}>
              <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-primary)' }}>
                {activeMatch.peserta1?.nama} <span style={{ color: 'var(--primary-color)' }}>VS</span> {activeMatch.peserta2?.nama}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Format: {league.formatSet === 'best_of_3' ? 'Best of 3 Sets' : 'Best of 5 Sets'}
              </div>
            </div>

            {/* Set by Set inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {scores.map((set, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <span style={{ width: '60px', fontWeight: 'bold', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Set {idx + 1}
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    className="input"
                    placeholder="0"
                    value={set[0]}
                    onChange={(e) => handleScoreChange(idx, 0, e.target.value)}
                    style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}
                  />
                  <span style={{ color: 'var(--text-muted)' }}>-</span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    className="input"
                    placeholder="0"
                    value={set[1]}
                    onChange={(e) => handleScoreChange(idx, 1, e.target.value)}
                    style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}
                  />
                </div>
              ))}
            </div>

            {/* Meja & Jam */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Lokasi Meja
                </label>
                <select
                  className="input"
                  value={modalMeja}
                  onChange={(e) => setModalMeja(e.target.value)}
                >
                  <option value="Meja 1">Meja 1</option>
                  <option value="Meja 2">Meja 2</option>
                  <option value="Meja 3">Meja 3</option>
                  <option value="Meja 4">Meja 4</option>
                </select>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Waktu Main</label>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      setModalJam(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    ⚡ Jam Sekarang
                  </button>
                </div>
                <input
                  type="text"
                  className="input"
                  placeholder="Bebas / e.g. 19:30"
                  value={modalJam}
                  onChange={(e) => setModalJam(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setShowScoreModal(false)} className="btn btn-secondary">
                Batal
              </button>
              <button type="button" onClick={handleSaveScore} className="btn btn-primary">
                💾 Simpan Skor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN DIGITAL SCOREBOARD */}
      {showScoreboard && activeMatch && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: '#040711',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '24px',
          color: '#fff'
        }}>
          {/* Top Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.8rem' }}>🏓</span>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#fff' }}>Papan Skor Live: {league.nama}</h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {activeMatch.meja || 'Meja 1'} • {league.formatSet === 'best_of_3' ? 'Best of 3' : 'Best of 5'}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowScoreboard(false)}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#fff',
                fontSize: '1.2rem',
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              ✕ Tutup
            </button>
          </div>

          {/* Main Scoring Box: Split 2 Sides */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px',
            flex: 1,
            margin: '20px 0',
            alignItems: 'center'
          }}>
            {/* Player 1 Box */}
            <div style={{
              background: 'rgba(0, 200, 255, 0.08)',
              border: servingPlayer === 1 ? '3px solid var(--primary-color)' : '1px solid rgba(0, 200, 255, 0.2)',
              borderRadius: '20px',
              padding: '30px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              position: 'relative'
            }}>
              {servingPlayer === 1 && (
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  background: 'var(--primary-color)',
                  color: '#000',
                  fontWeight: 'bold',
                  fontSize: '0.8rem'
                }}>
                  SERVICE 🎾
                </div>
              )}
              <div>
                <h3 style={{ fontSize: '2rem', margin: '0 0 6px 0', color: '#fff' }}>{activeMatch.peserta1?.nama}</h3>
                <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{activeMatch.peserta1?.namaPTM}</div>
                <div style={{ marginTop: '10px', fontSize: '1.2rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>
                  Set Dimenangkan: {liveP1Sets}
                </div>
              </div>

              {/* Huge Score Digits */}
              <div
                onClick={() => handleScoreboardPoint(1)}
                style={{
                  fontSize: 'clamp(5rem, 15vw, 10rem)',
                  fontWeight: '900',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: 'var(--primary-color)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  lineHeight: '1'
                }}
              >
                {liveP1Score}
              </div>

              {/* Point Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => setLiveP1Score(Math.max(0, liveP1Score - 1))}
                  className="btn btn-secondary"
                  style={{ fontSize: '1.5rem', width: '60px', height: '60px', borderRadius: '50%' }}
                >
                  -
                </button>
                <button
                  onClick={() => handleScoreboardPoint(1)}
                  className="btn btn-primary"
                  style={{ fontSize: '1.5rem', width: '60px', height: '60px', borderRadius: '50%' }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Player 2 Box */}
            <div style={{
              background: 'rgba(168, 85, 247, 0.08)',
              border: servingPlayer === 2 ? '3px solid var(--secondary-color)' : '1px solid rgba(168, 85, 247, 0.2)',
              borderRadius: '20px',
              padding: '30px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              position: 'relative'
            }}>
              {servingPlayer === 2 && (
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  background: 'var(--secondary-color)',
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: '0.8rem'
                }}>
                  SERVICE 🎾
                </div>
              )}
              <div>
                <h3 style={{ fontSize: '2rem', margin: '0 0 6px 0', color: '#fff' }}>{activeMatch.peserta2?.nama}</h3>
                <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{activeMatch.peserta2?.namaPTM}</div>
                <div style={{ marginTop: '10px', fontSize: '1.2rem', color: 'var(--secondary-color)', fontWeight: 'bold' }}>
                  Set Dimenangkan: {liveP2Sets}
                </div>
              </div>

              {/* Huge Score Digits */}
              <div
                onClick={() => handleScoreboardPoint(2)}
                style={{
                  fontSize: 'clamp(5rem, 15vw, 10rem)',
                  fontWeight: '900',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: 'var(--secondary-color)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  lineHeight: '1'
                }}
              >
                {liveP2Score}
              </div>

              {/* Point Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => setLiveP2Score(Math.max(0, liveP2Score - 1))}
                  className="btn btn-secondary"
                  style={{ fontSize: '1.5rem', width: '60px', height: '60px', borderRadius: '50%' }}
                >
                  -
                </button>
                <button
                  onClick={() => handleScoreboardPoint(2)}
                  className="btn btn-primary"
                  style={{ fontSize: '1.5rem', width: '60px', height: '60px', borderRadius: '50%' }}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Controls & Set History */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Riwayat Set:</span>
              {liveHistory.map((s, i) => (
                <span
                  key={i}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    fontWeight: 'bold',
                    fontSize: '0.9rem'
                  }}
                >
                  Set {i + 1}: {s[0]} - {s[1]}
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setServingPlayer(servingPlayer === 1 ? 2 : 1)}
                className="btn btn-secondary btn-sm"
              >
                🔄 Ganti Server
              </button>
              {canManage && (
                <button
                  onClick={handleSaveScoreboardResult}
                  className="btn btn-primary btn-sm"
                >
                  💾 Simpan Hasil Pertandingan
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeagueDetail;

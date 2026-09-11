import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTurnamen, getPemain, getPemainByScope, getUsers } from '../utils/storage';
import StatsCard from '../components/StatsCard';
import TournamentCard from '../components/TournamentCard';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ peserta: 0, turnamen: 0, aktif: 0, selesai: 0 });
  const [recentTournaments, setRecentTournaments] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  const { currentUser, isSuperAdmin, isAdmin, userPTM } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const turnamenData = (await getTurnamen()) || [];

        // Semua user bisa melihat semua turnamen
        const visibleTurnamen = turnamenData;

        // Scope Pemain (Hanya pemain dari PTM yang sama)
        const scopedPemain = await getPemainByScope({
          isSuperAdmin,
          uid: currentUser?.uid,
          ptm: userPTM
        });

        // Hitung Total Peserta (semua peserta dari semua turnamen, pemain sama dihitung berulang)
        let totalPeserta = 0;
        visibleTurnamen.forEach(t => {
          if (t.peserta) {
            totalPeserta += t.peserta.length;
          }
        });

        setStats({
          peserta: totalPeserta,
          turnamen: visibleTurnamen.length,
          aktif: visibleTurnamen.filter(t => t.status === 'pool' || t.status === 'eliminasi').length,
          selesai: visibleTurnamen.filter(t => t.status === 'selesai').length
        });

        setRecentTournaments(
          [...visibleTurnamen].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6)
        );

        // Papan peringkat: hanya pemain atau user yg mempunyai PTM sama (scopedPemain)
        const sortedPemain = [...scopedPemain]
          .map(p => ({ ...p, pts: p.pts || 0 }))
          .sort((a, b) => b.pts - a.pts)
          .slice(0, 8); // Top 8 players
        setLeaderboard(sortedPemain);
      } catch (e) {
        console.error("Error loading dashboard:", e);
      }
      setLoading(false);
    };
    if (currentUser !== undefined) loadData();
  }, [currentUser, isSuperAdmin, userPTM]);

  if (loading) return <div className="page-container" style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>;

  return (
    <div className="page-container fade-in">
      {/* Hero Banner Section */}
      <section className="panel" style={{ 
        padding: '2.5rem 2rem', 
        marginBottom: '2rem', 
        border: '1px solid rgba(0, 200, 255, 0.2)',
        boxShadow: '0 0 50px -12px rgba(0, 200, 255, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        borderRadius: 'var(--radius-lg)'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          borderRadius: '9999px',
          border: '1px solid rgba(0, 200, 255, 0.3)',
          background: 'rgba(214, 234, 198, 0.88)',
          padding: '6px 14px',
          width: 'fit-content',
          fontSize: '1rem',
          fontWeight: 'bold',
          color: 'rgba(20, 10, 95, 0.98)',
          textTransform: 'uppercase',
          letterSpacing: '0.15em'
        }}>
          <span className="animate-pulse" style={{ width: '8px', height: '10px', borderRadius: '50%', background: 'rgba(236, 29, 14, 0.75)' }}></span>
          Portal Resmi {userPTM || 'Turnamen'}
        </div>

        <div>
          <h1 style={{ 
            fontFamily: 'var(--font-display)', 
            fontSize: 'clamp(2.2rem, 6vw, 4rem)', 
            fontWeight: '800', 
            lineHeight: '1.05', 
            textTransform: 'uppercase', 
            margin: 0,
            background: 'var(--gradient-text)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Turnamen Tenis Meja
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: '10px', maxWidth: '650px', lineHeight: '1.6' }}>
            Sistem Informasi & Live Scoring Resmi Even Turnamen Tenis Meja {userPTM ? userPTM : ''}. Kelola jadwal pertandingan, hitung klasemen otomatis, dan pantau pemeringkatan poin (PTS) pemain terupdate.
            <span style={{ display: 'block', fontSize: '12px', marginTop: '6px', lineHeight: '1.2' }}>
              Hanya admin yang dapat membuat turnamen dan menambahkan pemain.
              <br />
              Hubungi 085781335527 untuk menjadi admin.
            </span>
          </p>
        </div>

        {(isAdmin || isSuperAdmin) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px' }}>
            <button className="btn btn-primary" onClick={() => navigate('/turnamen/baru')}>🏆 Buat Turnamen Baru</button>
            <button className="btn btn-secondary" onClick={() => navigate('/liga/baru')}>🏆 Buat Liga Baru</button>
            <button className="btn btn-secondary" onClick={() => navigate('/persahabatan/baru')}>🤝 Buat Laga Persahabatan</button>
            <button className="btn btn-secondary" onClick={() => navigate('/pemain')}>👥 Kelola Pemain</button>
          </div>
        )}
      </section>

      <div className="stats-grid">
        <StatsCard icon="👥" value={stats.peserta} label="Total Peserta" />
        <StatsCard icon="🏆" value={stats.turnamen} label="Total Turnamen" />
        <StatsCard icon="⚡" value={stats.aktif} label="Turnamen Aktif" />
        <StatsCard icon="✅" value={stats.selesai} label="Turnamen Selesai" />
      </div>

      <div className="dashboard-content-grid" style={{ marginTop: '30px' }}>
        {/* Left Column: Recent Tournaments */}
        <div>
          <h2 style={{ marginBottom: '20px', color: 'var(--color-text)' }}>Turnamen Terbaru</h2>
          {recentTournaments.length === 0 ? (
            <div className="empty-state card" style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '15px' }}>🏓</div>
              <h3>Belum ada turnamen</h3>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
                Mulai buat turnamen pertama Anda!
              </p>
              {isAdmin && (
                <button className="btn btn-primary" onClick={() => navigate('/turnamen/baru')}>
                  Buat Turnamen Pertama
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {recentTournaments.map(turnamen => (
                <TournamentCard key={turnamen.id} turnamen={turnamen} />
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Leaderboard */}
        <div>
          <h2 style={{ marginBottom: '20px', color: 'var(--color-text)' }}>🏆 Papan Peringkat (PTS)</h2>
          <div className="card" style={{ padding: '20px' }}>
            {leaderboard.length === 0 ? (
              <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '20px 0' }}>Belum ada peringkat</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {leaderboard.map((player, idx) => {
                  let badgeIcon = `${idx + 1}`;
                  let badgeStyle = {
                    background: 'var(--bg-surface-elevated)',
                    color: 'var(--color-text-secondary)'
                  };

                  if (idx === 0) {
                    badgeIcon = '🥇';
                    badgeStyle = { background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', fontWeight: 'bold' };
                  } else if (idx === 1) {
                    badgeIcon = '🥈';
                    badgeStyle = { background: 'rgba(156, 163, 175, 0.15)', color: '#d1d5db', fontWeight: 'bold' };
                  } else if (idx === 2) {
                    badgeIcon = '🥉';
                    badgeStyle = { background: 'rgba(217, 119, 6, 0.15)', color: '#f59e0b', fontWeight: 'bold' };
                  }

                  return (
                    <div key={player.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 15px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-light)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          fontSize: idx < 3 ? '1.2rem' : '0.9rem',
                          ...badgeStyle
                        }}>
                          {badgeIcon}
                        </span>
                        <div>
                          <div style={{ fontWeight: idx < 3 ? 'bold' : 'normal', color: 'var(--color-text)' }}>{player.nama || player.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                            {player.namaPTM || 'Klub Umum'} • Div {player.divisi || '-'}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--color-primary)' }}>{player.pts} <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>PTS</span></div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                          🏆 {player.statsPTS?.juara || 0}x Juara
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

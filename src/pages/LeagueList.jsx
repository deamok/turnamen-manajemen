import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLiga, deleteLiga } from '../utils/storage';
import { calculateLeagueStats } from '../utils/league';
import { useAuth } from '../contexts/AuthContext';
import { formatTanggal } from '../utils/helpers';

const LeagueList = () => {
  const navigate = useNavigate();
  const { currentUser, canCreateTournament, isSuperAdmin } = useAuth();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('semua');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getLiga();
      setLeagues(data || []);
    } catch (e) {
      console.error("Error fetching leagues:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (e, league) => {
    e.stopPropagation();
    if (window.confirm(`Yakin ingin menghapus kompetisi "${league.nama}"? Seluruh jadwal dan klasemen akan terhapus permanen.`)) {
      try {
        await deleteLiga(league.id);
        await loadData();
      } catch (err) {
        alert("Gagal menghapus liga: " + err.message);
      }
    }
  };

  const filteredLeagues = leagues
    .filter(l => {
      if (filterStatus === 'semua') return true;
      return l.status === filterStatus;
    })
    .filter(l => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const nama = (l.nama || '').toLowerCase();
      const deskripsi = (l.deskripsi || '').toLowerCase();
      return nama.includes(q) || deskripsi.includes(q);
    })
    .sort((a, b) => new Date(b.createdAt || b.tanggalMulai) - new Date(a.createdAt || a.tanggalMulai));

  const countTotal = leagues.length;
  const countLive = leagues.filter(l => l.status === 'berlangsung').length;
  const countDraft = leagues.filter(l => l.status === 'terjadwal' || l.status === 'draft').length;
  const countDone = leagues.filter(l => l.status === 'selesai').length;

  return (
    <div className="page-container fade-in">
      {/* Header Section */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '2rem' }}>🏆</span>
            <h1 style={{ fontSize: '2rem', margin: 0, color: 'var(--text-primary)' }}>
              Liga Tenis Meja <span style={{ color: 'var(--primary-color)' }}>Kompetisi Penuh</span>
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Format kompetisi round-robin berjenjang per pekan, klasemen otomatis, dan statistik lengkap.
          </p>
        </div>

        {canCreateTournament && (
          <button 
            onClick={() => navigate('/liga/baru')}
            className="btn btn-primary"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '12px 24px', 
              fontSize: '1rem', 
              fontWeight: 'bold',
              boxShadow: '0 0 20px rgba(0, 200, 255, 0.3)'
            }}
          >
            <span>+</span> Buat Liga Baru
          </button>
        )}
      </div>

      {/* Stats Summary Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '2rem' }}>🏓</span>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Liga</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{countTotal}</div>
          </div>
        </div>
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '4px solid var(--primary-color)' }}>
          <span style={{ fontSize: '2rem' }}>⚡</span>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--primary-color)', textTransform: 'uppercase' }}>Sedang Berlangsung</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{countLive}</div>
          </div>
        </div>
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '4px solid var(--warning-color)' }}>
          <span style={{ fontSize: '2rem' }}>📅</span>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--warning-color)', textTransform: 'uppercase' }}>Terjadwal / Draft</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--warning-color)' }}>{countDraft}</div>
          </div>
        </div>
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '4px solid var(--success-color)' }}>
          <span style={{ fontSize: '2rem' }}>🥇</span>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--success-color)', textTransform: 'uppercase' }}>Liga Selesai</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success-color)' }}>{countDone}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { key: 'semua', label: 'Semua Status' },
            { key: 'berlangsung', label: '⚡ Berlangsung' },
            { key: 'terjadwal', label: '📅 Terjadwal' },
            { key: 'selesai', label: '🏆 Selesai' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-full)',
                border: filterStatus === tab.key ? '1px solid var(--primary-color)' : '1px solid var(--border-light)',
                background: filterStatus === tab.key ? 'rgba(0, 200, 255, 0.15)' : 'var(--bg-surface)',
                color: filterStatus === tab.key ? 'var(--primary-color)' : 'var(--text-secondary)',
                fontWeight: filterStatus === tab.key ? '600' : 'normal',
                cursor: 'pointer',
                transition: 'var(--transition-fast)'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div style={{ position: 'relative', minWidth: '260px', flex: '1', maxWidth: '380px' }}>
          <input
            type="text"
            className="input"
            placeholder="Cari nama liga atau catatan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingRight: '35px' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Loading & Empty State */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }} className="animate-pulse">🏓</div>
          <p>Memuat daftar liga tenis meja...</p>
        </div>
      ) : filteredLeagues.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-surface)' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '15px' }}>🏆</div>
          <h3 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '8px' }}>
            {searchQuery || filterStatus !== 'semua' ? 'Tidak ada liga yang cocok dengan filter' : 'Belum Ada Liga Tenis Meja'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 24px', fontSize: '0.95rem' }}>
            {searchQuery || filterStatus !== 'semua' 
              ? 'Coba ganti kata kunci pencarian atau ubah filter status di atas.' 
              : 'Buat kompetisi liga round-robin penuh pertama Anda untuk PTM / Komunitas tenis meja.'}
          </p>
          {canCreateTournament && !searchQuery && filterStatus === 'semua' && (
            <button onClick={() => navigate('/liga/baru')} className="btn btn-primary">
              + Buat Liga Pertama Sekarang
            </button>
          )}
        </div>
      ) : (
        /* League Cards Grid */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '1.5rem'
        }}>
          {filteredLeagues.map(league => {
            const stats = calculateLeagueStats(league);
            const canManageThis = isSuperAdmin || (currentUser && league.createdBy === currentUser.uid);

            let statusBadge = {
              text: 'Terjadwal',
              bg: 'rgba(245, 158, 11, 0.15)',
              border: 'rgba(245, 158, 11, 0.3)',
              color: 'var(--warning-color)',
              icon: '📅'
            };

            if (league.status === 'berlangsung') {
              statusBadge = {
                text: 'Berlangsung',
                bg: 'rgba(0, 200, 255, 0.15)',
                border: 'rgba(0, 200, 255, 0.3)',
                color: 'var(--primary-color)',
                icon: '⚡'
              };
            } else if (league.status === 'selesai') {
              statusBadge = {
                text: 'Selesai',
                bg: 'rgba(16, 185, 129, 0.15)',
                border: 'rgba(16, 185, 129, 0.3)',
                color: 'var(--success-color)',
                icon: '🏆'
              };
            }

            return (
              <div
                key={league.id}
                className="card"
                onClick={() => navigate(`/liga/${league.id}`)}
                style={{
                  padding: '24px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: '1px solid var(--border-color)',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = 'var(--primary-color)';
                  e.currentTarget.style.boxShadow = '0 12px 30px rgba(0, 200, 255, 0.15)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Top Row: Tags & Delete */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        background: statusBadge.bg,
                        border: `1px solid ${statusBadge.border}`,
                        color: statusBadge.color,
                        textTransform: 'uppercase'
                      }}>
                        <span>{statusBadge.icon}</span> {statusBadge.text}
                      </span>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-secondary)'
                      }}>
                        {league.tipe === 'Double' ? '👥 Ganda' : '👤 Tunggal'}
                      </span>
                      {league.putaran === 2 && (
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          background: 'rgba(168, 85, 247, 0.12)',
                          color: 'var(--secondary-color)',
                          border: '1px solid rgba(168, 85, 247, 0.25)'
                        }}>
                          🔄 2 Putaran
                        </span>
                      )}
                    </div>

                    {canManageThis && (
                      <button
                        onClick={(e) => handleDelete(e, league)}
                        title="Hapus Liga"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--danger-color)',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          opacity: 0.7,
                          transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                      >
                        🗑️
                      </button>
                    )}
                  </div>

                  {/* Title & Description */}
                  <h3 style={{
                    fontSize: '1.25rem',
                    color: 'var(--text-primary)',
                    marginBottom: '8px',
                    lineHeight: '1.3'
                  }}>
                    {league.nama}
                  </h3>
                  {league.deskripsi && (
                    <p style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      marginBottom: '16px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {league.deskripsi}
                    </p>
                  )}

                  {/* Winner Banner if finished */}
                  {league.status === 'selesai' && league.juara && (
                    <div style={{
                      margin: '12px 0',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'rgba(251, 191, 36, 0.1)',
                      border: '1px solid rgba(251, 191, 36, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <span style={{ fontSize: '1.3rem' }}>👑</span>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#fbbf24', textTransform: 'uppercase', fontWeight: 'bold' }}>Juara Liga</div>
                        <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                          {league.juara.nama || league.juara}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Current Leader if not finished */}
                  {league.status !== 'selesai' && stats?.topLeader && (
                    <div style={{
                      margin: '12px 0',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(0, 200, 255, 0.06)',
                      border: '1px solid rgba(0, 200, 255, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.85rem'
                    }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Pemimpin Klasemen:</span>
                      <span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                        🥇 {stats.topLeader.nama} ({stats.topLeader.poin} pts)
                      </span>
                    </div>
                  )}
                </div>

                {/* Progress & Meta Info */}
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    <span>Progres Liga</span>
                    <span>{stats?.finishedMatches || 0} / {stats?.totalMatches || 0} Partai ({stats?.progressPercent || 0}%)</span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div style={{
                    width: '100%',
                    height: '6px',
                    borderRadius: '999px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    overflow: 'hidden',
                    marginBottom: '14px'
                  }}>
                    <div style={{
                      width: `${stats?.progressPercent || 0}%`,
                      height: '100%',
                      background: league.status === 'selesai' ? 'var(--success-color)' : 'var(--gradient-primary)',
                      borderRadius: '999px',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)'
                  }}>
                    <span>👥 {league.peserta?.length || 0} Peserta • {league.jadwal?.length || 0} Pekan</span>
                    <span>{league.tanggalMulai ? formatTanggal(league.tanggalMulai) : 'Tanggal -'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LeagueList;

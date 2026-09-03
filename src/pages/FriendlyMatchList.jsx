import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPersahabatan, deletePersahabatan } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import { formatTanggal } from '../utils/helpers';

const FriendlyMatchList = () => {
  const navigate = useNavigate();
  const { currentUser, canCreateTournament, isSuperAdmin } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('semua');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getPersahabatan();
      setMatches(data || []);
    } catch (e) {
      console.error("Error fetching friendly matches:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (e, match) => {
    e.stopPropagation();
    if (window.confirm(`Yakin ingin menghapus laga persahabatan "${match.judul}"?`)) {
      try {
        await deletePersahabatan(match.id);
        await loadData();
      } catch (err) {
        alert("Gagal menghapus laga persahabatan: " + err.message);
      }
    }
  };

  const filteredMatches = matches
    .filter(m => {
      if (filterStatus === 'semua') return true;
      return m.status === filterStatus;
    })
    .filter(m => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const ptmA = (m.ptmA?.nama || '').toLowerCase();
      const ptmB = (m.ptmB?.nama || '').toLowerCase();
      const judul = (m.judul || '').toLowerCase();
      const lokasi = (m.lokasi || '').toLowerCase();
      return ptmA.includes(q) || ptmB.includes(q) || judul.includes(q) || lokasi.includes(q);
    })
    .sort((a, b) => new Date(b.createdAt || b.tanggal) - new Date(a.createdAt || a.tanggal));

  const countTotal = matches.length;
  const countLive = matches.filter(m => m.status === 'berlangsung').length;
  const countTerjadwal = matches.filter(m => m.status === 'terjadwal').length;
  const countSelesai = matches.filter(m => m.status === 'selesai').length;

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
            <span style={{ fontSize: '2rem' }}>🤝</span>
            <h1 style={{ fontSize: '2rem', margin: 0, color: 'var(--text-primary)' }}>
              Laga Persahabatan <span style={{ color: 'var(--primary-color)' }}>Antar PTM</span>
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Manajemen pertandingan persahabatan, sparring, dan silaturahmi beregu antar klub tenis meja.
          </p>
        </div>

        {canCreateTournament && (
          <button 
            onClick={() => navigate('/persahabatan/baru')}
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
            <span>+</span> Buat Laga Persahabatan
          </button>
        )}
      </div>

      {/* Stats Overview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div className="panel" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Laga</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '4px' }}>{countTotal}</div>
        </div>
        <div className="panel" style={{ padding: '1.25rem', textAlign: 'center', borderLeft: '3px solid var(--warning-color)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--warning-color)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🔴 Sedang Berlangsung</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning-color)', marginTop: '4px' }}>{countLive}</div>
        </div>
        <div className="panel" style={{ padding: '1.25rem', textAlign: 'center', borderLeft: '3px solid var(--primary-color)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📅 Terjadwal</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)', marginTop: '4px' }}>{countTerjadwal}</div>
        </div>
        <div className="panel" style={{ padding: '1.25rem', textAlign: 'center', borderLeft: '3px solid var(--success-color)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--success-color)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🏆 Selesai</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success-color)', marginTop: '4px' }}>{countSelesai}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="panel" style={{ 
        padding: '1rem 1.25rem', 
        marginBottom: '2rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '1rem' 
      }}>
        {/* Status Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'semua', label: 'Semua Laga' },
            { id: 'berlangsung', label: '🔴 Berlangsung' },
            { id: 'terjadwal', label: '📅 Terjadwal' },
            { id: 'selesai', label: '🏆 Selesai' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`btn btn-sm ${filterStatus === tab.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 'var(--radius-full)' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ minWidth: '260px', flex: '1 1 260px', maxWidth: '400px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="🔍 Cari PTM, judul, atau lokasi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '8px 14px', fontSize: '0.9rem' }}
          />
        </div>
      </div>

      {/* Matches List */}
      {loading ? (
        <div className="panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Memuat data laga persahabatan...</p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏓</div>
          <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Belum Ada Pertandingan Persahabatan</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 1.5rem' }}>
            {searchQuery || filterStatus !== 'semua'
              ? 'Tidak ada pertandingan yang cocok dengan filter pencarian Anda.'
              : 'Jalin silaturahmi dan uji kemampuan antar klub dengan membuat laga persahabatan antar PTM.'}
          </p>
          {canCreateTournament && (
            <button 
              onClick={() => navigate('/persahabatan/baru')}
              className="btn btn-primary"
            >
              + Buat Laga Persahabatan Sekarang
            </button>
          )}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '1.5rem'
        }}>
          {filteredMatches.map(match => {
            const ptmA = match.ptmA?.nama || 'PTM Tuan Rumah';
            const ptmB = match.ptmB?.nama || 'PTM Tamu';
            const skorA = match.skorA ?? 0;
            const skorB = match.skorB ?? 0;
            const totalPartai = match.partai?.length || 0;
            const partaiSelesai = match.partai?.filter(p => p.selesai).length || 0;
            
            const isFinished = match.status === 'selesai';
            const isLive = match.status === 'berlangsung';

            const canManage = isSuperAdmin || (currentUser && match.createdBy === currentUser.uid);

            return (
              <div
                key={match.id}
                className="panel"
                onClick={() => navigate(`/persahabatan/${match.id}`)}
                style={{
                  cursor: 'pointer',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1.25rem',
                  transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                  border: isLive 
                    ? '1px solid var(--warning-color)' 
                    : isFinished 
                    ? '1px solid rgba(16, 185, 129, 0.3)' 
                    : '1px solid var(--border-color)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = 'var(--primary-color)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = isLive ? 'var(--warning-color)' : isFinished ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)';
                }}
              >
                {/* Top Bar: Status & Date */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 'bold', 
                    padding: '4px 10px', 
                    borderRadius: 'var(--radius-full)',
                    background: isLive 
                      ? 'rgba(245, 158, 11, 0.15)' 
                      : isFinished 
                      ? 'rgba(16, 185, 129, 0.15)' 
                      : 'rgba(0, 200, 255, 0.15)',
                    color: isLive 
                      ? 'var(--warning-color)' 
                      : isFinished 
                      ? 'var(--success-color)' 
                      : 'var(--primary-color)',
                    border: `1px solid ${isLive ? 'var(--warning-color)' : isFinished ? 'var(--success-color)' : 'var(--primary-color)'}`,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    {isLive && <span className="animate-pulse" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--warning-color)' }}></span>}
                    {isLive ? 'LIVE MATCH' : isFinished ? 'SELESAI' : 'TERJADWAL'}
                  </span>

                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    📅 {match.tanggal ? formatTanggal(match.tanggal) : 'Belum diatur'}
                  </span>
                </div>

                {/* Match Title & Location */}
                <div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '4px', color: 'var(--text-primary)' }}>
                    {match.judul || `${ptmA} vs ${ptmB}`}
                  </h3>
                  {match.lokasi && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      📍 {match.lokasi}
                    </div>
                  )}
                </div>

                {/* Scoreboard Box */}
                <div style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.2rem 1rem',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem'
                }}>
                  {/* PTM A */}
                  <div style={{ flex: 1, textAlign: 'center', overflow: 'hidden' }}>
                    <div style={{ 
                      fontSize: '1rem', 
                      fontWeight: 'bold', 
                      color: skorA > skorB ? 'var(--primary-color)' : 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden'
                    }} title={ptmA}>
                      {ptmA}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tuan Rumah</div>
                  </div>

                  {/* Score Board */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 14px',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)'
                  }}>
                    <span style={{ 
                      fontSize: '1.6rem', 
                      fontWeight: '800', 
                      fontFamily: 'var(--font-display)',
                      color: skorA > skorB ? 'var(--primary-color)' : 'var(--text-primary)'
                    }}>
                      {skorA}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>:</span>
                    <span style={{ 
                      fontSize: '1.6rem', 
                      fontWeight: '800', 
                      fontFamily: 'var(--font-display)',
                      color: skorB > skorA ? 'var(--primary-color)' : 'var(--text-primary)'
                    }}>
                      {skorB}
                    </span>
                  </div>

                  {/* PTM B */}
                  <div style={{ flex: 1, textAlign: 'center', overflow: 'hidden' }}>
                    <div style={{ 
                      fontSize: '1rem', 
                      fontWeight: 'bold', 
                      color: skorB > skorA ? 'var(--primary-color)' : 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden'
                    }} title={ptmB}>
                      {ptmB}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tamu</div>
                  </div>
                </div>

                {/* Footer Progress & Actions */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-light)',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)'
                }}>
                  <div>
                    🏸 {partaiSelesai} dari {totalPartai} partai selesai
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {canManage && (
                      <button
                        onClick={(e) => handleDelete(e, match)}
                        className="btn btn-sm danger"
                        title="Hapus Pertandingan"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      >
                        🗑️
                      </button>
                    )}
                    <span style={{ color: 'var(--primary-color)', fontWeight: '600' }}>
                      Detail &rarr;
                    </span>
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

export default FriendlyMatchList;

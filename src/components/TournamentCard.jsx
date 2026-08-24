import React from 'react';
import { useNavigate } from 'react-router-dom';

const statusColors = {
  pendaftaran: 'badge-primary',
  draft: 'badge-warning',
  pool: 'badge-primary',
  eliminasi: 'badge-secondary',
  selesai: 'badge-success'
};

const statusLabels = {
  pendaftaran: 'Pendaftaran Dibuka',
  draft: 'Draft',
  pool: 'Babak Pool',
  eliminasi: 'Babak Eliminasi',
  selesai: 'Selesai'
};

const TournamentCard = ({ turnamen }) => {
  const navigate = useNavigate();

  const jumlahPeserta = turnamen.status === 'pendaftaran'
    ? (turnamen.peserta?.length || 0)
    : (turnamen.pools
      ? turnamen.pools.reduce((total, pool) => total + pool.peserta.length, 0)
      : 0);

  const formatDateRange = (mulai, selesai) => {
    if (!mulai && !selesai) return '';
    if (mulai && selesai && mulai !== selesai) {
      return `${mulai} s/d ${selesai}`;
    }
    return mulai || selesai;
  };

  return (
    <div className="card" onClick={() => navigate(`/turnamen/${turnamen.id}`)} style={{ cursor: 'pointer' }}>
      <div className="card-header">
        <h3 style={{ margin: 0 }}>{turnamen.nama}</h3>
      </div>
      <div className="card-body">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <span className="badge badge-primary">{turnamen.tipe === 'Single' ? '👤 Single' : '👥 Double'}</span>
          {turnamen.divisi && <span className="badge">Divisi {turnamen.divisi}</span>}
          <span className={`badge ${statusColors[turnamen.status] || ''}`}>
            {statusLabels[turnamen.status] || turnamen.status}
          </span>
          {(turnamen.jadwalMulai || turnamen.jadwalSelesai) && (
            <span className="badge" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
              📅 {formatDateRange(turnamen.jadwalMulai, turnamen.jadwalSelesai)}
            </span>
          )}
        </div>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
          {jumlahPeserta} peserta {turnamen.status !== 'pendaftaran' && `• ${turnamen.pools?.length || 0} pool`}
        </p>
      </div>
    </div>
  );
};

export default TournamentCard;

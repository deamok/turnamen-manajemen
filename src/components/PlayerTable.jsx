import React from 'react';

const badgeColors = {
  '1': 'badge-danger',
  '2': 'badge-warning',
  '3': 'badge-primary',
  '4': 'badge-success',
  '5': 'badge-secondary',
  '6': ''
};

const PlayerTable = ({ pemainList, onEdit, onDelete, canEdit = true }) => {
  if (!pemainList || pemainList.length === 0) {
    return (
      <div className="empty-state" style={{ textAlign: 'center', padding: '30px' }}>
        <div style={{ fontSize: '2rem', marginBottom: '10px' }}>👤</div>
        <p>Belum ada pemain terdaftar.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: '5%' }}>No</th>
            <th style={{ width: '22%' }}>Nama</th>
            <th style={{ width: '13%' }}>Nomor HP</th>
            <th style={{ width: '10%' }}>Divisi</th>
            <th style={{ width: '18%' }}>Nama PTM</th>
            <th style={{ width: '17%' }}>Karet Bet (FH / BH)</th>
            <th style={{ width: '8%' }}>PTS</th>
            {canEdit && <th style={{ width: '12%' }}>Aksi</th>}
          </tr>
        </thead>
        <tbody>
          {pemainList.map((pemain, index) => {
            const fh = pemain.karetForehand || '-';
            const bh = pemain.karetBackhand || '-';

            return (
              <tr key={pemain.id}>
                <td>{index + 1}</td>
                <td><strong>{pemain.nama}</strong></td>
                <td>{pemain.noHP || '-'}</td>
                <td>
                  <span className={`badge ${badgeColors[pemain.divisi] || ''}`}>
                    Div {pemain.divisi}
                  </span>
                </td>
                <td>{pemain.namaPTM}</td>
                <td>
                  <div style={{ fontSize: '0.78rem', lineHeight: '1.4' }}>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>FH: </span>
                      <span style={{ color: fh === '-' || fh === 'Normal' ? 'var(--text-primary)' : 'var(--warning-color)', fontWeight: fh !== '-' && fh !== 'Normal' ? 'bold' : 'normal' }}>
                        {fh}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>BH: </span>
                      <span style={{ color: bh === '-' || bh === 'Normal' ? 'var(--text-primary)' : 'var(--secondary-color)', fontWeight: bh !== '-' && bh !== 'Normal' ? 'bold' : 'normal' }}>
                        {bh}
                      </span>
                    </div>
                  </div>
                </td>
                <td><strong style={{ color: 'var(--primary-color)' }}>{pemain.pts || 0}</strong></td>
                {canEdit && (
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => onEdit(pemain)}>✏️</button>
                      <button className="btn btn-sm btn-danger" onClick={() => onDelete(pemain.id)}>🗑️</button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PlayerTable;

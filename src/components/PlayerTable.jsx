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
            <th style={{ width: '25%' }}>Nama</th>
            <th style={{ width: '15%' }}>Nomor HP</th>
            <th style={{ width: '10%' }}>Divisi</th>
            <th style={{ width: '20%' }}>Nama PTM</th>
            <th style={{ width: '10%' }}>PTS</th>
            {canEdit && <th style={{ width: '15%' }}>Aksi</th>}
          </tr>
        </thead>
        <tbody>
          {pemainList.map((pemain, index) => (
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
              <td><strong style={{ color: 'var(--primary-color)' }}>{pemain.pts || 0}</strong></td>
              {canEdit && (
                <td>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => onEdit(pemain)}>✏️</button>
                    <button className="btn btn-sm btn-danger" onClick={() => onDelete(pemain.id)}>🗑️</button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PlayerTable;

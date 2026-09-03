import React, { useState, useEffect } from 'react';

const KARET_OPTIONS = [
  'Normal',
  'Anti Spin',
  'Bintik',
  'Bintik Serang'
];

const PlayerForm = ({ pemain, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    nama: '',
    email: '',
    noHP: '',
    divisi: '1',
    namaPTM: '',
    karetForehand: '',
    karetBackhand: ''
  });

  useEffect(() => {
    if (pemain) {
      setFormData({
        nama: pemain.nama || '',
        email: pemain.email || '',
        noHP: pemain.noHP || '',
        divisi: pemain.divisi || '1',
        namaPTM: pemain.namaPTM || '',
        karetForehand: pemain.karetForehand || '',
        karetBackhand: pemain.karetBackhand || ''
      });
    }
  }, [pemain]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Nama</label>
          <input type="text" className="form-input" name="nama" value={formData.nama} onChange={handleChange} required />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Email (Opsional)</label>
            <input type="email" className="form-input" name="email" value={formData.email} onChange={handleChange} placeholder="Email untuk sinkronisasi akun" />
          </div>
          <div className="form-group">
            <label className="form-label">Nomor HP</label>
            <input type="text" className="form-input" name="noHP" value={formData.noHP} onChange={handleChange} required placeholder="Contoh: 08123456789" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Divisi</label>
            <select className="form-select" name="divisi" value={formData.divisi} onChange={handleChange}>
              {[1, 2, 3, 4, 5].map(d => (
                <option key={d} value={d}>Divisi {d}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Nama PTM</label>
            <input type="text" className="form-input" name="namaPTM" value={formData.namaPTM} onChange={handleChange} required />
          </div>
        </div>
        
        {/* Jenis Karet Forehand & Backhand (Optional) */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">🏓 Karet Forehand <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Opsional)</span></label>
            <select className="form-select" name="karetForehand" value={formData.karetForehand || ''} onChange={handleChange}>
              <option value="">-- Pilih (Opsional) --</option>
              {KARET_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">🏓 Karet Backhand <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Opsional)</span></label>
            <select className="form-select" name="karetBackhand" value={formData.karetBackhand || ''} onChange={handleChange}>
              <option value="">-- Pilih (Opsional) --</option>
              {KARET_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="btn-group">
          <button type="submit" className="btn btn-primary">{pemain ? 'Simpan' : 'Tambah'}</button>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Batal</button>
        </div>
      </form>
    </div>
  );
};

export default PlayerForm;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPemain, addTurnamen } from '../utils/storage';
import { generateId, acakArray, buatPasangan } from '../utils/helpers';
import { buatPools, getNamaPeserta } from '../utils/tournament';
import { useAuth } from '../contexts/AuthContext';

const CreateTournament = () => {
  const { currentUser, canCreateTournament } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ 
    nama: '', 
    tipe: 'Single', 
    divisi: '',
    tanggalRegistrasi: '',
    jadwalMulai: '',
    jadwalSelesai: '',
    jamMulai: '09:00',
    jamSelesai: '17:00',
    mode: 'mandiri' // 'mandiri' (pemain daftar sendiri) atau 'manual' (admin pilih)
  });
  const [allPemain, setAllPemain] = useState([]);
  const [selectedPemainIds, setSelectedPemainIds] = useState([]);
  const [pasangan, setPasangan] = useState([]);
  const [pools, setPools] = useState([]);
  const [filterDivisi, setFilterDivisi] = useState('Semua');

  useEffect(() => {
    const fetchPemain = async () => {
      try {
        const data = await getPemain();
        setAllPemain(data || []);
      } catch (e) {
        console.error("Error fetching pemain:", e);
      }
    };
    fetchPemain();
  }, []);

  const pemainFiltered = filterDivisi === 'Semua'
    ? allPemain
    : allPemain.filter(p => p.divisi === filterDivisi);
  const selectedPemain = allPemain.filter(p => selectedPemainIds.includes(p.id));
  const divisiList = [...new Set(allPemain.map(p => p.divisi))].sort();

  const handleNext = () => {
    if (step === 1) {
      if (!formData.nama.trim()) return alert('Nama turnamen wajib diisi!');
      
      if (formData.mode === 'mandiri') {
        // Langsung buat turnamen dengan status pendaftaran
        handleCreate(true);
      } else {
        setStep(2);
      }
    } else if (step === 2) {
      if (formData.tipe === 'Single' && selectedPemainIds.length < 3) {
        return alert('Minimal 3 pemain untuk format Single!');
      }
      if (formData.tipe === 'Double' && selectedPemainIds.length < 4) {
        return alert('Minimal 4 pemain (2 pasang) untuk format Double!');
      }
      if (formData.tipe === 'Double' && selectedPemainIds.length % 2 !== 0) {
        return alert('Jumlah pemain harus genap untuk format Double!');
      }
      if (formData.tipe === 'Double') {
        handleGeneratePasangan();
      }
      setStep(3);
    } else if (step === 3) {
      handleGeneratePools();
      setStep(4);
    } else if (step === 4) {
      handleCreate(false);
    }
  };

  const handlePrev = () => {
    setStep(step - 1);
  };

  const handleGeneratePasangan = () => {
    const shuffled = acakArray([...selectedPemain]);
    const pairs = buatPasangan(shuffled);
    setPasangan(pairs);
  };

  const handleGeneratePools = () => {
    let pesertaList;
    if (formData.tipe === 'Single') {
      pesertaList = selectedPemain.map(p => ({
        id: p.id,
        nama: p.nama,
        namaPTM: p.namaPTM
      }));
    } else {
      pesertaList = pasangan.map(p => ({
        id: p.id,
        pemain1: p.pemain1,
        pemain2: p.pemain2
      }));
    }
    setPools(buatPools(pesertaList));
  };

  const togglePemain = (id) => {
    setSelectedPemainIds(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const ids = pemainFiltered.map(p => p.id);
    setSelectedPemainIds(prev => [...new Set([...prev, ...ids])]);
  };
  
  const deselectAll = () => {
    if (filterDivisi === 'Semua') {
      setSelectedPemainIds([]);
    } else {
      const filteredIds = pemainFiltered.map(p => p.id);
      setSelectedPemainIds(prev => prev.filter(id => !filteredIds.includes(id)));
    }
  };

  const handleCreate = async (isMandiri = false) => {
    let scheduledPools = isMandiri ? [] : JSON.parse(JSON.stringify(pools));

    if (!isMandiri && scheduledPools.length > 0) {
      const tStartDate = formData.jadwalMulai || new Date().toISOString().split('T')[0];
      const startHourMin = formData.jamMulai || '09:00';
      let tableTimes = {
        'Meja 1': new Date(`${tStartDate}T${startHourMin}:00`),
        'Meja 2': new Date(`${tStartDate}T${startHourMin}:00`)
      };

      scheduledPools.forEach((pool, poolIdx) => {
        const meja = poolIdx % 2 === 0 ? 'Meja 1' : 'Meja 2';
        let currentMatchTime = new Date(tableTimes[meja]);

        pool.pertandingan.forEach(match => {
          const h = currentMatchTime.getHours();
          const m = currentMatchTime.getMinutes();
          const totalMins = h * 60 + m;
          if (totalMins >= 720 && totalMins < 780) {
            currentMatchTime.setHours(13, 0, 0);
          }

          match.tanggal = tStartDate;
          const hours = String(currentMatchTime.getHours()).padStart(2, '0');
          const minutes = String(currentMatchTime.getMinutes()).padStart(2, '0');
          match.jam = `${hours}:${minutes}`;
          match.meja = meja;

          currentMatchTime.setMinutes(currentMatchTime.getMinutes() + 30);
        });

        tableTimes[meja] = new Date(currentMatchTime);
      });
    }

    const newTournament = {
      id: generateId(),
      nama: formData.nama,
      tipe: formData.tipe,
      divisi: formData.divisi || '',
      tanggalRegistrasi: formData.tanggalRegistrasi,
      jadwalMulai: formData.jadwalMulai,
      jadwalSelesai: formData.jadwalSelesai,
      jamMulai: formData.jamMulai || '09:00',
      jamSelesai: formData.jamSelesai || '17:00',
      status: isMandiri ? 'pendaftaran' : 'pool',
      peserta: isMandiri ? [] : (formData.tipe === 'Single'
        ? selectedPemain.map(p => ({ id: p.id, nama: p.nama, namaPTM: p.namaPTM }))
        : pasangan.map(p => ({ id: p.id, pemain1: p.pemain1, pemain2: p.pemain2 }))),
      pools: scheduledPools,
      bracket: null,
      juara: null,
      createdBy: currentUser?.uid || '',
      createdAt: new Date().toISOString()
    };

    try {
      await addTurnamen(newTournament);
      navigate(`/turnamen/${newTournament.id}`);
    } catch (e) {
      console.error("Error creating tournament:", e);
      alert("Gagal membuat turnamen.");
    }
  };

  const stepTitles = ['Info Turnamen', 'Pilih Pemain', 'Preview Peserta', 'Preview Pool'];

  if (!currentUser) {
    return (
      <div className="page-container" style={{ textAlign: 'center', marginTop: '50px' }}>
        <h2>Harap Login Terlebih Dahulu</h2>
      </div>
    );
  }

  if (!canCreateTournament) {
    return (
      <div className="page-container" style={{ textAlign: 'center', marginTop: '50px' }}>
        <h2>Anda tidak memiliki akses untuk membuat turnamen.</h2>
      </div>
    );
  }

  return (
    <div className="page-container fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Buat Turnamen Baru</h1>
      </div>

      {/* Progress Steps */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', overflowX: 'auto', paddingBottom: '10px' }}>
        {[1, 2, 3, 4].map(s => (
          <div
            key={s}
            style={{
              flex: 1,
              minWidth: '120px',
              textAlign: 'center',
              padding: '12px 10px',
              borderRadius: '8px',
              background: step === s ? 'var(--color-primary)' : step > s ? 'var(--color-success)' : 'rgba(0,0,0,0.2)',
              color: step === s || step > s ? 'white' : 'var(--color-text-secondary)',
              fontWeight: '500',
              fontSize: '0.9rem',
              transition: 'all 0.3s ease'
            }}
          >
            {s}. {stepTitles[s - 1]}
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '30px' }}>
          {step === 1 && (
            <div className="fade-in">
              <h2 style={{ marginBottom: '20px' }}>Informasi Dasar</h2>
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label className="form-label">Nama Turnamen</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.nama}
                  onChange={e => setFormData({ ...formData, nama: e.target.value })}
                  placeholder="Contoh: Turnamen Kemerdekaan Cup 2026"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Pilih Divisi Khusus (Opsional)</label>
                <select 
                  className="form-select"
                  value={formData.divisi}
                  onChange={e => setFormData({...formData, divisi: e.target.value})}
                >
                  <option value="">Semua Divisi Boleh Ikut</option>
                  {[1, 2, 3, 4, 5].map(div => <option key={div} value={div}>Divisi {div}</option>)}
                </select>
              </div>

              <div className="form-row" style={{ display: 'flex', gap: '15px', marginTop: '15px', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: '1 1 100%' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Batas Pendaftaran</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={formData.tanggalRegistrasi}
                    onChange={e => setFormData({...formData, tanggalRegistrasi: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{ flex: '1 1 200px' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Tanggal Mulai Pertandingan</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={formData.jadwalMulai}
                    onChange={e => setFormData({...formData, jadwalMulai: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{ flex: '1 1 200px' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Tanggal Selesai Pertandingan</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={formData.jadwalSelesai}
                    onChange={e => setFormData({...formData, jadwalSelesai: e.target.value})}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '15px' }}>
                <div className="form-group" style={{ flex: '1 1 200px' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Jam Mulai Pertandingan</label>
                  <input 
                    type="time" 
                    className="form-input" 
                    value={formData.jamMulai}
                    onChange={e => setFormData({...formData, jamMulai: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{ flex: '1 1 200px' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Jam Selesai Pertandingan</label>
                  <input 
                    type="time" 
                    className="form-input" 
                    value={formData.jamSelesai}
                    onChange={e => setFormData({...formData, jamSelesai: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '20px' }}>
                <label className="form-label">Tipe Pendaftaran</label>
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {[{id: 'mandiri', label: 'Buka Pendaftaran (Pemain Daftar Sendiri)'}, {id: 'manual', label: 'Manual (Admin Pilih Pemain)'}].map(opt => (
                    <button 
                      key={opt.id}
                      className={`btn ${formData.mode === opt.id ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setFormData({...formData, mode: opt.id})}
                      type="button"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {formData.mode === 'mandiri' && (
                  <p style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--color-success)' }}>
                    Turnamen akan langsung dibuat dengan status "Pendaftaran Dibuka". Pemain bisa mendaftar sendiri.
                  </p>
                )}
              </div>

              <div className="form-group" style={{ marginTop: '20px' }}>
                <label className="form-label">Tipe Turnamen</label>
                <div style={{ display: 'flex', gap: '15px', marginTop: '8px' }}>
                  {['Single', 'Double'].map(tipe => (
                    <label key={tipe} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="tipe"
                        value={tipe}
                        checked={formData.tipe === tipe}
                        onChange={e => setFormData({ ...formData, tipe: e.target.value })}
                        style={{ accentColor: 'var(--color-primary)', width: '18px', height: '18px' }}
                      />
                      {tipe}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <h2 style={{ margin: 0 }}>Pilih Pemain</h2>
                <select
                  className="form-select"
                  style={{ width: 'auto' }}
                  value={filterDivisi}
                  onChange={e => setFilterDivisi(e.target.value)}
                >
                  <option value="Semua">Semua Divisi</option>
                  {divisiList.map(div => <option key={div} value={div}>Divisi {div}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <p style={{ color: 'var(--color-text-secondary)' }}>
                  Terpilih: <strong style={{ color: 'var(--color-primary)' }}>{selectedPemainIds.length}</strong> pemain
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-sm btn-secondary" onClick={selectAll}>Pilih Semua</button>
                  <button className="btn btn-sm btn-secondary" onClick={deselectAll}>Batal</button>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                {pemainFiltered.map(p => (
                  <label key={p.id} style={{
                    display: 'flex', alignItems: 'center', padding: '12px 15px',
                    borderRadius: '10px', cursor: 'pointer',
                    background: selectedPemainIds.includes(p.id) ? 'rgba(6,182,212,0.15)' : 'var(--color-glass)',
                    border: selectedPemainIds.includes(p.id) ? '2px solid var(--color-primary)' : '2px solid transparent',
                    transition: 'all 0.2s ease'
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedPemainIds.includes(p.id)}
                      onChange={() => togglePemain(p.id)}
                      style={{ marginRight: '12px', accentColor: 'var(--color-primary)' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '500' }}>{p.nama}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{p.namaPTM}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="fade-in">
              {formData.tipe === 'Single' ? (
                <div>
                  <h3 style={{ marginBottom: '15px' }}>Peserta Terpilih ({selectedPemain.length} pemain)</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                    {selectedPemain.map((p, i) => (
                      <div key={p.id} className="card" style={{ padding: '12px' }}>
                        <strong>{i + 1}. {p.nama}</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{p.namaPTM} • Div {p.divisi}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3>Pasangan Acak ({pasangan.length} pasang)</h3>
                    <button className="btn btn-secondary" onClick={handleGeneratePasangan}>🔀 Acak Ulang</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                    {pasangan.map((p, i) => (
                      <div key={p.id} className="card player-pair" style={{ padding: '15px' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: '600', marginBottom: '8px' }}>
                          Pasangan {i + 1}
                        </div>
                        <div style={{ fontWeight: '500' }}>👤 {p.pemain1?.nama}</div>
                        <div style={{ fontWeight: '500' }}>👤 {p.pemain2?.nama}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3>Pembagian Pool ({pools.length} pool)</h3>
                <button className="btn btn-secondary" onClick={handleGeneratePools}>🔀 Acak Ulang Pool</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '15px' }}>
                {pools.map((pool, i) => (
                  <div key={pool.id} className="pool-card card" style={{ padding: '15px' }}>
                    <div className="pool-header">
                      <h4>{pool.nama}</h4>
                      <span className="badge">{pool.peserta.length} peserta</span>
                    </div>
                    <ol style={{ paddingLeft: '20px', margin: '10px 0 0' }}>
                      {pool.peserta.map((p, j) => (
                        <li key={p.id} style={{ padding: '4px 0' }}>
                          {getNamaPeserta(p)}
                        </li>
                      ))}
                    </ol>
                    <div style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      {pool.pertandingan.length} pertandingan
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 25px', borderTop: '1px solid var(--color-glass)' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            {step > 1 && (
              <button className="btn btn-secondary" onClick={handlePrev}>
                Kembali
              </button>
            )}
          </div>
          
          <button className="btn btn-primary" onClick={handleNext}>
            {step === 1 && formData.mode === 'mandiri' ? 'Buka Pendaftaran 🚀' : 
             step === 4 ? 'Simpan Turnamen' : 'Selanjutnya'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateTournament;

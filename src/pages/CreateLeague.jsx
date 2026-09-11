import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPemain, addLiga } from '../utils/storage';
import { generateId, acakArray, buatPasangan } from '../utils/helpers';
import { generateLeagueSchedule, hitungKlasemenLiga } from '../utils/league';
import { useAuth } from '../contexts/AuthContext';

const CreateLeague = () => {
  const { currentUser, canCreateTournament, isSuperAdmin, userPTM } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    nama: '',
    deskripsi: '',
    tipe: 'Single', // 'Single' atau 'Double'
    putaran: 1, // 1 atau 2 (Home-Away)
    formatSet: 'best_of_5', // 'best_of_5' (Default Best of 5)
    poinMenang: 3, // 3 atau 2
    poinKalah: 0, // 0 atau 1
    tanggalMulai: new Date().toISOString().split('T')[0],
    intervalHari: 7, // 7 hari = mingguan
    jamDefault: 'Bebas',
    jumlahMeja: 2 // Default 2 Meja
  });

  const [allPemain, setAllPemain] = useState([]);
  const [selectedPemainIds, setSelectedPemainIds] = useState([]);
  const [customPeserta, setCustomPeserta] = useState([]);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomPTM, setNewCustomPTM] = useState('');
  const [filterDivisi, setFilterDivisi] = useState('Semua');
  const [searchPemain, setSearchPemain] = useState('');

  const [pasangan, setPasangan] = useState([]);
  const [generatedJadwal, setGeneratedJadwal] = useState([]);
  const [previewKlasemen, setPreviewKlasemen] = useState([]);
  const [submitting, setSubmitting] = useState(false);

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

  const divisiList = [...new Set(allPemain.map(p => p.divisi).filter(Boolean))].sort();

  const filteredPemain = allPemain
    .filter(p => filterDivisi === 'Semua' || p.divisi === filterDivisi)
    .filter(p => {
      if (!searchPemain) return true;
      const q = searchPemain.toLowerCase();
      const nama = (p.nama || p.name || '').toLowerCase();
      const ptm = (p.namaPTM || p.ownerPTM || '').toLowerCase();
      return nama.includes(q) || ptm.includes(q);
    });

  const handleTogglePemain = (id) => {
    if (selectedPemainIds.includes(id)) {
      setSelectedPemainIds(selectedPemainIds.filter(x => x !== id));
    } else {
      setSelectedPemainIds([...selectedPemainIds, id]);
    }
  };

  const handleSelectAll = () => {
    const visibleIds = filteredPemain.map(p => p.id);
    const allSelected = visibleIds.every(id => selectedPemainIds.includes(id));
    if (allSelected) {
      setSelectedPemainIds(selectedPemainIds.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedPemainIds([...new Set([...selectedPemainIds, ...visibleIds])]);
    }
  };

  const handleAddCustomPeserta = (e) => {
    e.preventDefault();
    if (!newCustomName.trim()) return;
    const newP = {
      id: 'custom_' + generateId(),
      nama: newCustomName.trim(),
      namaPTM: newCustomPTM.trim() || userPTM || 'Klub Tamu',
      divisi: '-'
    };
    setCustomPeserta([...customPeserta, newP]);
    setNewCustomName('');
    setNewCustomPTM('');
  };

  const handleRemoveCustomPeserta = (id) => {
    setCustomPeserta(customPeserta.filter(p => p.id !== id));
  };

  const getCombinedParticipants = () => {
    const fromMember = allPemain
      .filter(p => selectedPemainIds.includes(p.id))
      .map(p => ({
        id: p.id,
        nama: p.nama || p.name,
        namaPTM: p.namaPTM || p.ownerPTM || '-'
      }));
    return [...fromMember, ...customPeserta];
  };

  const handleGeneratePairs = () => {
    const list = getCombinedParticipants();
    if (list.length < 4 || list.length % 2 !== 0) {
      alert("Format Ganda membutuhkan jumlah pemain genap (minimal 4 pemain)!");
      return;
    }
    const shuffled = acakArray(list);
    const pairs = buatPasangan(shuffled);
    setPasangan(pairs);
  };

  const handleProcessStep2 = () => {
    const list = getCombinedParticipants();
    if (formData.tipe === 'Single') {
      if (list.length < 3) {
        alert("Minimal 3 peserta untuk membuat liga!");
        return;
      }
      prepareSchedule(list);
      setStep(3);
    } else {
      if (list.length < 4) {
        alert("Minimal 4 pemain untuk liga ganda!");
        return;
      }
      if (list.length % 2 !== 0) {
        alert("Jumlah pemain harus genap untuk format ganda!");
        return;
      }
      if (pasangan.length === 0) {
        handleGeneratePairs();
      }
      const pairParticipants = pasangan.map(p => ({
        id: p.id,
        nama: `${p.pemain1?.nama || ''} / ${p.pemain2?.nama || ''}`,
        namaPTM: p.pemain1?.namaPTM || p.pemain2?.namaPTM || '-',
        pemain1: p.pemain1,
        pemain2: p.pemain2
      }));
      prepareSchedule(pairParticipants);
      setStep(3);
    }
  };

  const prepareSchedule = (pesertaList) => {
    const schedule = generateLeagueSchedule(pesertaList, {
      putaran: Number(formData.putaran),
      tanggalMulai: formData.tanggalMulai,
      intervalHari: Number(formData.intervalHari),
      jumlahMeja: Number(formData.jumlahMeja || 2),
      jamDefault: formData.jamDefault
    });
    setGeneratedJadwal(schedule);
    const initialStandings = hitungKlasemenLiga(pesertaList, schedule, {
      poinMenang: Number(formData.poinMenang),
      poinKalah: Number(formData.poinKalah)
    });
    setPreviewKlasemen(initialStandings);
  };

  const handleCreateLeague = async () => {
    setSubmitting(true);
    try {
      let finalPeserta;
      if (formData.tipe === 'Single') {
        finalPeserta = getCombinedParticipants();
      } else {
        finalPeserta = pasangan.map(p => ({
          id: p.id,
          nama: `${p.pemain1?.nama || ''} / ${p.pemain2?.nama || ''}`,
          namaPTM: p.pemain1?.namaPTM || p.pemain2?.namaPTM || '-',
          pemain1: p.pemain1,
          pemain2: p.pemain2
        }));
      }

      const newLeague = {
        id: generateId(),
        nama: formData.nama.trim(),
        deskripsi: formData.deskripsi.trim(),
        tipe: formData.tipe,
        putaran: Number(formData.putaran),
        formatSet: formData.formatSet,
        poinMenang: Number(formData.poinMenang),
        poinKalah: Number(formData.poinKalah),
        tanggalMulai: formData.tanggalMulai,
        intervalHari: Number(formData.intervalHari),
        jamDefault: formData.jamDefault,
        jumlahMeja: Number(formData.jumlahMeja),
        status: 'berlangsung', // langsung aktif berlangsung
        peserta: finalPeserta,
        jadwal: generatedJadwal,
        klasemen: previewKlasemen,
        juara: null,
        createdBy: currentUser?.uid || '',
        creatorName: currentUser?.displayName || 'Admin',
        createdAt: new Date().toISOString()
      };

      await addLiga(newLeague);
      navigate(`/liga/${newLeague.id}`);
    } catch (err) {
      console.error("Error creating league:", err);
      alert("Gagal membuat liga: " + err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Wizard Step Progress */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          {[
            { num: 1, label: 'Pengaturan & Format' },
            { num: 2, label: 'Pilih Peserta' },
            { num: 3, label: 'Pratinjau Jadwal & Publikasi' }
          ].map((s, idx) => (
            <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: idx < 2 ? 1 : 'none' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 'bold',
                fontSize: '1rem',
                background: step >= s.num ? 'var(--primary-color)' : 'var(--bg-surface-elevated)',
                color: step >= s.num ? '#080b16' : 'var(--text-secondary)',
                border: step === s.num ? '2px solid #fff' : '1px solid var(--border-light)',
                transition: 'all 0.3s ease'
              }}>
                {s.num}
              </div>
              <span style={{
                fontSize: '0.9rem',
                fontWeight: step === s.num ? 'bold' : 'normal',
                color: step >= s.num ? 'var(--text-primary)' : 'var(--text-muted)'
              }}>
                {s.label}
              </span>
              {idx < 2 && (
                <div style={{
                  flex: 1,
                  height: '2px',
                  background: step > s.num ? 'var(--primary-color)' : 'var(--border-light)',
                  margin: '0 12px'
                }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* STEP 1: PENGATURAN LIGA */}
      {step === 1 && (
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '1.8rem' }}>⚙️</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>Langkah 1: Pengaturan Liga</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Tentukan nama kompetisi, format partai, sistem putaran, dan aturan perolehan poin.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Nama Liga *</label>
              <input
                type="text"
                className="input"
                placeholder="Contoh: Liga Utama Tenis Meja PTM 2026"
                value={formData.nama}
                onChange={e => setFormData({ ...formData, nama: e.target.value })}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Deskripsi / Catatan Liga</label>
              <textarea
                className="input"
                rows="2"
                placeholder="Keterangan lokasi lapangan, sponsor, ketentuan khusus, dll..."
                value={formData.deskripsi}
                onChange={e => setFormData({ ...formData, deskripsi: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Kategori Partai</label>
                <select
                  className="input"
                  value={formData.tipe}
                  onChange={e => setFormData({ ...formData, tipe: e.target.value })}
                >
                  <option value="Single">👤 Tunggal (Single)</option>
                  <option value="Double">👥 Ganda (Double)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Sistem Putaran</label>
                <select
                  className="input"
                  value={formData.putaran}
                  onChange={e => setFormData({ ...formData, putaran: Number(e.target.value) })}
                >
                  <option value={1}>➡️ 1 Putaran (Single Round Robin)</option>
                  <option value={2}>🔄 2 Putaran (Home & Away / Timbal Balik)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Format Set Pertandingan</label>
                <select
                  className="input"
                  value={formData.formatSet}
                  onChange={e => setFormData({ ...formData, formatSet: e.target.value })}
                >
                  <option value="best_of_5">Best of 5 Sets (Mencari 3 Kemenangan Set) - Rekomendasi</option>
                  <option value="best_of_3">Best of 3 Sets (Mencari 2 Kemenangan Set)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Jumlah Meja Pertandingan</label>
                <select
                  className="input"
                  value={formData.jumlahMeja}
                  onChange={e => setFormData({ ...formData, jumlahMeja: Number(e.target.value) })}
                >
                  <option value={2}>2 Meja (Meja 1 & Meja 2) - Standar</option>
                  <option value={3}>3 Meja (Meja 1, 2, 3)</option>
                  <option value={4}>4 Meja (Meja 1 s/d 4)</option>
                  <option value={1}>1 Meja</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Sistem Poin Menang</label>
                <select
                  className="input"
                  value={formData.poinMenang}
                  onChange={e => {
                    const pm = Number(e.target.value);
                    setFormData({ ...formData, poinMenang: pm, poinKalah: pm === 3 ? 0 : 1 });
                  }}
                >
                  <option value={3}>Menang 3 Poin, Kalah 0 Poin (Standar Liga)</option>
                  <option value={2}>Menang 2 Poin, Kalah 1 Poin (Standar Tenis Meja Tradisional)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Tanggal Mulai Pekan 1</label>
                <input
                  type="date"
                  className="input"
                  value={formData.tanggalMulai}
                  onChange={e => setFormData({ ...formData, tanggalMulai: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Interval Hari per Pekan</label>
                <select
                  className="input"
                  value={formData.intervalHari}
                  onChange={e => setFormData({ ...formData, intervalHari: Number(e.target.value) })}
                >
                  <option value={7}>Tiap 7 Hari (Mingguan / 1 Pekan Sekali)</option>
                  <option value={14}>Tiap 14 Hari (2 Minggu Sekali)</option>
                  <option value={1}>Tiap Hari (Liga Harian / Turnamen Maraton)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Jadwal Waktu Pertandingan</label>
                <select
                  className="input"
                  value={formData.jamDefault}
                  onChange={e => setFormData({ ...formData, jamDefault: e.target.value })}
                >
                  <option value="Bebas">Bebas / Diisi saat pemain bertanding (Rekomendasi)</option>
                  <option value="09:00">09:00 WIB</option>
                  <option value="14:00">14:00 WIB</option>
                  <option value="19:00">19:00 WIB (Malam)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (!formData.nama.trim()) {
                    alert("Nama Liga wajib diisi!");
                    return;
                  }
                  setStep(2);
                }}
              >
                Lanjut: Pilih Peserta ➔
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: PILIH PESERTA */}
      {step === 2 && (
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.8rem' }}>👥</span>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>Langkah 2: Pilih Peserta Liga</h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Pilih peserta dari database Member atau tambahkan peserta tamu/manual.
                </p>
              </div>
            </div>
            <div style={{
              padding: '6px 14px',
              borderRadius: '999px',
              background: 'rgba(0, 200, 255, 0.15)',
              border: '1px solid var(--primary-color)',
              color: 'var(--primary-color)',
              fontWeight: 'bold',
              fontSize: '0.9rem'
            }}>
              Terpilih: {getCombinedParticipants().length} Pemain
            </div>
          </div>

          {/* Form Tambah Peserta Manual/Tamu */}
          <div style={{
            background: 'var(--bg-surface-elevated)',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            border: '1px dashed var(--border-color)'
          }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              ➕ Tambah Peserta Tamu / Non-Member
            </h4>
            <form onSubmit={handleAddCustomPeserta} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="input"
                placeholder="Nama Pemain Tamu..."
                value={newCustomName}
                onChange={e => setNewCustomName(e.target.value)}
                style={{ flex: 2, minWidth: '180px' }}
              />
              <input
                type="text"
                className="input"
                placeholder="Nama PTM / Klub (Opsional)..."
                value={newCustomPTM}
                onChange={e => setNewCustomPTM(e.target.value)}
                style={{ flex: 1, minWidth: '150px' }}
              />
              <button type="submit" className="btn btn-secondary">
                + Tambah
              </button>
            </form>

            {customPeserta.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                {customPeserta.map(p => (
                  <span
                    key={p.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: 'rgba(168, 85, 247, 0.2)',
                      border: '1px solid var(--secondary-color)',
                      fontSize: '0.85rem'
                    }}
                  >
                    👤 {p.nama} ({p.namaPTM})
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomPeserta(p.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Filter & Search Member */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="input"
              placeholder="Cari pemain dari Member..."
              value={searchPemain}
              onChange={e => setSearchPemain(e.target.value)}
              style={{ flex: 2, minWidth: '200px' }}
            />
            <select
              className="input"
              value={filterDivisi}
              onChange={e => setFilterDivisi(e.target.value)}
              style={{ flex: 1, minWidth: '130px' }}
            >
              <option value="Semua">Semua Divisi</option>
              {divisiList.map(div => (
                <option key={div} value={div}>Divisi {div}</option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary" onClick={handleSelectAll}>
              Pilih Semua Ditampilkan
            </button>
          </div>

          {/* Member List Table / Checkboxes */}
          <div style={{
            maxHeight: '300px',
            overflowY: 'auto',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '1.5rem',
            background: 'var(--bg-surface)'
          }}>
            {filteredPemain.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Tidak ada member yang cocok.
              </div>
            ) : (
              filteredPemain.map(p => {
                const isSelected = selectedPemainIds.includes(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => handleTogglePemain(p.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--border-light)',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(0, 200, 255, 0.1)' : 'transparent',
                      transition: 'background 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by parent div
                        style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                      />
                      <div>
                        <div style={{ fontWeight: isSelected ? 'bold' : 'normal', color: 'var(--text-primary)' }}>
                          {p.nama || p.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {p.namaPTM || p.ownerPTM || 'Umum'} • Divisi {p.divisi || '-'}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>
                      {p.pts || 0} PTS
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* If format is Double: Show Pairings */}
          {formData.tipe === 'Double' && (
            <div style={{
              marginTop: '1.5rem',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>👥 Pasangan Ganda ({pasangan.length} Pasang)</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Pasangan digenerate secara acak dari total {getCombinedParticipants().length} pemain terpilih.
                  </p>
                </div>
                <button type="button" className="btn btn-secondary" onClick={handleGeneratePairs}>
                  🔀 Acak Pasangan Ulang
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                {pasangan.map((pair, idx) => (
                  <div key={pair.id} style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-light)',
                    fontSize: '0.85rem'
                  }}>
                    <strong style={{ color: 'var(--primary-color)' }}>Pasang {idx + 1}:</strong>
                    <div>{pair.pemain1?.nama || 'Pemain 1'} & {pair.pemain2?.nama || 'Pemain 2'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
              ⬅ Kembali
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleProcessStep2}
            >
              Lanjut: Generate Jadwal Pekan ➔
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: PREVIEW JADWAL & SIMPAN */}
      {step === 3 && (
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.8rem' }}>📅</span>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>Langkah 3: Pratinjau Jadwal & Klasemen</h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Total {generatedJadwal.length} Pekan • {generatedJadwal.reduce((acc, p) => acc + p.pertandingan.filter(m => !m.isBye).length, 0)} Pertandingan
                </p>
              </div>
            </div>
          </div>

          {/* Preview Jadwal Accordion / List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
            {generatedJadwal.map(pekan => {
              const activeMatches = pekan.pertandingan.filter(m => !m.isBye);
              const byeMatches = pekan.pertandingan.filter(m => m.isBye);

              return (
                <div key={pekan.id} style={{
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-elevated)',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    padding: '12px 16px',
                    background: 'rgba(0, 200, 255, 0.08)',
                    borderBottom: '1px solid var(--border-light)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <strong style={{ color: 'var(--primary-color)' }}>{pekan.nama}</strong>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      📅 {pekan.tanggal}
                    </span>
                  </div>

                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {activeMatches.map((m, mIdx) => (
                      <div key={m.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: 'var(--bg-surface)',
                        fontSize: '0.85rem'
                      }}>
                        <div style={{ flex: 1, textAlign: 'right', fontWeight: 'bold' }}>
                          {m.peserta1?.nama} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({m.peserta1?.namaPTM})</span>
                        </div>
                        <div style={{ padding: '0 12px', color: 'var(--primary-color)', fontWeight: 'bold' }}>
                          VS
                        </div>
                        <div style={{ flex: 1, textAlign: 'left', fontWeight: 'bold' }}>
                          {m.peserta2?.nama} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({m.peserta2?.namaPTM})</span>
                        </div>
                        <div style={{ width: '100px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {m.meja} • {m.jam}
                        </div>
                      </div>
                    ))}

                    {byeMatches.map(m => (
                      <div key={m.id} style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: 'rgba(245, 158, 11, 0.1)',
                        color: 'var(--warning-color)',
                        fontSize: '0.8rem',
                        fontStyle: 'italic'
                      }}>
                        ℹ️ {m.catatan}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation & Submit Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setStep(2)} disabled={submitting}>
              ⬅ Kembali
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateLeague}
              disabled={submitting}
              style={{ padding: '12px 30px', fontSize: '1rem', fontWeight: 'bold' }}
            >
              {submitting ? 'Menyimpan Liga...' : '🚀 Terbitkan & Mulai Liga Sekarang'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateLeague;

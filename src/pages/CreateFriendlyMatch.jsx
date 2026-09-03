import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPemain, addPersahabatan, ensurePemainRegistered } from '../utils/storage';
import { generateId } from '../utils/helpers';
import { useAuth } from '../contexts/AuthContext';

const CreateFriendlyMatch = () => {
  const navigate = useNavigate();
  const { currentUser, userPTM } = useAuth();

  const [pemainList, setPemainList] = useState([]);
  const [ptmOptions, setPtmOptions] = useState([]);

  // Form states
  const [judul, setJudul] = useState('');
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [jam, setJam] = useState('09:00');
  const [lokasi, setLokasi] = useState('');
  const [jumlahMeja, setJumlahMeja] = useState(2); // Jumlah meja yang digunakan
  const [formatSet, setFormatSet] = useState('best_of_5'); // 'best_of_5' or 'best_of_3'
  const [catatan, setCatatan] = useState('');

  // Table options based on jumlahMeja
  const tableOptions = Array.from(
    { length: Math.max(1, parseInt(jumlahMeja) || 1) },
    (_, i) => `Meja ${i + 1}`
  );

  // PTM A (Home) & PTM B (Away)
  const [ptmANama, setPtmANama] = useState(userPTM || '');
  const [ptmAKapten, setPtmAKapten] = useState('');
  const [ptmBNama, setPtmBNama] = useState('');
  const [ptmBKapten, setPtmBKapten] = useState('');

  // Partai list
  const [partaiList, setPartaiList] = useState([
    {
      id: generateId(),
      nomor: 1,
      tipe: 'Single',
      namaPartai: 'Partai 1 (Tunggal)',
      meja: 'Meja 1',
      pemainA: { nama: '', id: '' },
      pemainB: { nama: '', id: '' }
    },
    {
      id: generateId(),
      nomor: 2,
      tipe: 'Double',
      namaPartai: 'Partai 2 (Ganda)',
      meja: 'Meja 2',
      pemainA: { nama: '', id: '', pemain1: { nama: '', id: '' }, pemain2: { nama: '', id: '' } },
      pemainB: { nama: '', id: '', pemain1: { nama: '', id: '' }, pemain2: { nama: '', id: '' } }
    },
    {
      id: generateId(),
      nomor: 3,
      tipe: 'Single',
      namaPartai: 'Partai 3 (Tunggal)',
      meja: 'Meja 1',
      pemainA: { nama: '', id: '' },
      pemainB: { nama: '', id: '' }
    }
  ]);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const players = await getPemain();
        setPemainList(players || []);

        // Extract unique PTM names
        const ptms = [...new Set(players.map(p => p.namaPTM || p.ownerPTM).filter(Boolean))].sort();
        setPtmOptions(ptms);

        if (!ptmANama && userPTM) {
          setPtmANama(userPTM);
        }
      } catch (err) {
        console.error("Error loading players:", err);
      }
    };
    fetchData();
  }, [userPTM]);

  // Filter players by selected PTM
  const playersPTMA = pemainList.filter(p => {
    if (!ptmANama) return true;
    const ptm = (p.namaPTM || p.ownerPTM || '').trim().toLowerCase();
    return ptm === ptmANama.trim().toLowerCase();
  });

  const playersPTMB = pemainList.filter(p => {
    if (!ptmBNama) return true;
    const ptm = (p.namaPTM || p.ownerPTM || '').trim().toLowerCase();
    return ptm === ptmBNama.trim().toLowerCase();
  });

  const getTableForIndex = (idx) => {
    const total = Math.max(1, parseInt(jumlahMeja) || 1);
    return `Meja ${(idx % total) + 1}`;
  };

  const applyPreset = (presetType) => {
    if (presetType === '3_partai') {
      setPartaiList([
        { id: generateId(), nomor: 1, tipe: 'Single', namaPartai: 'Partai 1 (Tunggal 1)', meja: getTableForIndex(0), pemainA: { nama: '', id: '' }, pemainB: { nama: '', id: '' } },
        { id: generateId(), nomor: 2, tipe: 'Double', namaPartai: 'Partai 2 (Ganda)', meja: getTableForIndex(1), pemainA: { nama: '', id: '', pemain1: { nama: '', id: '' }, pemain2: { nama: '', id: '' } }, pemainB: { nama: '', id: '', pemain1: { nama: '', id: '' }, pemain2: { nama: '', id: '' } } },
        { id: generateId(), nomor: 3, tipe: 'Single', namaPartai: 'Partai 3 (Tunggal 2)', meja: getTableForIndex(2), pemainA: { nama: '', id: '' }, pemainB: { nama: '', id: '' } }
      ]);
    } else if (presetType === '5_partai') {
      setPartaiList([
        { id: generateId(), nomor: 1, tipe: 'Single', namaPartai: 'Partai 1 (Tunggal 1)', meja: getTableForIndex(0), pemainA: { nama: '', id: '' }, pemainB: { nama: '', id: '' } },
        { id: generateId(), nomor: 2, tipe: 'Single', namaPartai: 'Partai 2 (Tunggal 2)', meja: getTableForIndex(1), pemainA: { nama: '', id: '' }, pemainB: { nama: '', id: '' } },
        { id: generateId(), nomor: 3, tipe: 'Double', namaPartai: 'Partai 3 (Ganda 1)', meja: getTableForIndex(2), pemainA: { nama: '', id: '', pemain1: { nama: '', id: '' }, pemain2: { nama: '', id: '' } }, pemainB: { nama: '', id: '', pemain1: { nama: '', id: '' }, pemain2: { nama: '', id: '' } } },
        { id: generateId(), nomor: 4, tipe: 'Single', namaPartai: 'Partai 4 (Tunggal 3)', meja: getTableForIndex(3), pemainA: { nama: '', id: '' }, pemainB: { nama: '', id: '' } },
        { id: generateId(), nomor: 5, tipe: 'Double', namaPartai: 'Partai 5 (Ganda 2)', meja: getTableForIndex(4), pemainA: { nama: '', id: '', pemain1: { nama: '', id: '' }, pemain2: { nama: '', id: '' } }, pemainB: { nama: '', id: '', pemain1: { nama: '', id: '' }, pemain2: { nama: '', id: '' } } }
      ]);
    } else if (presetType === '7_partai') {
      setPartaiList([
        { id: generateId(), nomor: 1, tipe: 'Single', namaPartai: 'Partai 1 (Tunggal 1)', meja: getTableForIndex(0), pemainA: { nama: '', id: '' }, pemainB: { nama: '', id: '' } },
        { id: generateId(), nomor: 2, tipe: 'Single', namaPartai: 'Partai 2 (Tunggal 2)', meja: getTableForIndex(1), pemainA: { nama: '', id: '' }, pemainB: { nama: '', id: '' } },
        { id: generateId(), nomor: 3, tipe: 'Double', namaPartai: 'Partai 3 (Ganda 1)', meja: getTableForIndex(2), pemainA: { nama: '', id: '', pemain1: { nama: '', id: '' }, pemain2: { nama: '', id: '' } }, pemainB: { nama: '', id: '', pemain1: { nama: '', id: '' }, pemain2: { nama: '', id: '' } } },
        { id: generateId(), nomor: 4, tipe: 'Single', namaPartai: 'Partai 4 (Tunggal 3)', meja: getTableForIndex(3), pemainA: { nama: '', id: '' }, pemainB: { nama: '', id: '' } },
        { id: generateId(), nomor: 5, tipe: 'Double', namaPartai: 'Partai 5 (Ganda 2)', meja: getTableForIndex(4), pemainA: { nama: '', id: '', pemain1: { nama: '', id: '' }, pemain2: { nama: '', id: '' } }, pemainB: { nama: '', id: '', pemain1: { nama: '', id: '' }, pemain2: { nama: '', id: '' } } },
        { id: generateId(), nomor: 6, tipe: 'Single', namaPartai: 'Partai 6 (Tunggal 4)', meja: getTableForIndex(5), pemainA: { nama: '', id: '' }, pemainB: { nama: '', id: '' } },
        { id: generateId(), nomor: 7, tipe: 'Double', namaPartai: 'Partai 7 (Ganda 3)', meja: getTableForIndex(6), pemainA: { nama: '', id: '', pemain1: { nama: '', id: '' }, pemain2: { nama: '', id: '' } }, pemainB: { nama: '', id: '', pemain1: { nama: '', id: '' }, pemain2: { nama: '', id: '' } } }
      ]);
    }
  };

  const handleAddPartai = (tipe = 'Single') => {
    const nextNomor = partaiList.length + 1;
    const newPartai = {
      id: generateId(),
      nomor: nextNomor,
      tipe: tipe,
      namaPartai: `Partai ${nextNomor} (${tipe === 'Single' ? 'Tunggal' : 'Ganda'})`,
      meja: getTableForIndex(nextNomor - 1),
      pemainA: tipe === 'Single' ? { nama: '', id: '' } : { nama: '', id: '', pemain1: { nama: '', id: '' }, pemain2: { nama: '', id: '' } },
      pemainB: tipe === 'Single' ? { nama: '', id: '' } : { nama: '', id: '', pemain1: { nama: '', id: '' }, pemain2: { nama: '', id: '' } }
    };
    setPartaiList([...partaiList, newPartai]);
  };

  const handleRemovePartai = (index) => {
    if (partaiList.length <= 1) {
      return alert("Minimal harus ada 1 partai pertandingan!");
    }
    const updated = partaiList.filter((_, i) => i !== index).map((p, idx) => ({
      ...p,
      nomor: idx + 1,
      namaPartai: p.namaPartai.replace(/Partai \d+/, `Partai ${idx + 1}`)
    }));
    setPartaiList(updated);
  };

  const handleUpdatePartai = (index, field, value) => {
    const updated = [...partaiList];
    updated[index] = { ...updated[index], [field]: value };
    setPartaiList(updated);
  };

  const handleTipePartaiChange = (index, newTipe) => {
    const updated = [...partaiList];
    const current = updated[index];
    updated[index] = {
      ...current,
      tipe: newTipe,
      namaPartai: `Partai ${current.nomor} (${newTipe === 'Single' ? 'Tunggal' : 'Ganda'})`,
      pemainA: newTipe === 'Single' ? { nama: '', id: '' } : { nama: '', id: '', pemain1: { nama: '', id: '' }, pemain2: { nama: '', id: '' } },
      pemainB: newTipe === 'Single' ? { nama: '', id: '' } : { nama: '', id: '', pemain1: { nama: '', id: '' }, pemain2: { nama: '', id: '' } }
    };
    setPartaiList(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ptmANama.trim()) return alert("Nama PTM Tuan Rumah (Tim A) wajib diisi!");
    if (!ptmBNama.trim()) return alert("Nama PTM Tamu (Tim B) wajib diisi!");
    if (partaiList.length === 0) return alert("Minimal harus ada 1 partai pertandingan!");

    const matchTitle = judul.trim() || `Laga Persahabatan ${ptmANama} vs ${ptmBNama}`;

    setSubmitting(true);
    try {
      const matchId = generateId();
      const payload = {
        id: matchId,
        judul: matchTitle,
        tanggal: tanggal,
        jam: jam,
        lokasi: lokasi.trim(),
        jumlahMeja: parseInt(jumlahMeja) || 1,
        formatSet: formatSet,
        catatan: catatan.trim(),
        status: 'terjadwal',
        pemenangPtm: null,
        skorA: 0,
        skorB: 0,
        ptmA: {
          nama: ptmANama.trim(),
          kapten: ptmAKapten.trim()
        },
        ptmB: {
          nama: ptmBNama.trim(),
          kapten: ptmBKapten.trim()
        },
        partai: partaiList.map(p => {
          let namaDisplayA = '';
          let namaDisplayB = '';

          if (p.tipe === 'Single') {
            namaDisplayA = p.pemainA?.nama || 'Pemain Tim A';
            namaDisplayB = p.pemainB?.nama || 'Pemain Tim B';
          } else {
            const a1 = p.pemainA?.pemain1?.nama || '';
            const a2 = p.pemainA?.pemain2?.nama || '';
            namaDisplayA = a1 && a2 ? `${a1} / ${a2}` : (p.pemainA?.nama || 'Ganda Tim A');

            const b1 = p.pemainB?.pemain1?.nama || '';
            const b2 = p.pemainB?.pemain2?.nama || '';
            namaDisplayB = b1 && b2 ? `${b1} / ${b2}` : (p.pemainB?.nama || 'Ganda Tim B');
          }

          return {
            id: p.id,
            nomor: p.nomor,
            tipe: p.tipe,
            namaPartai: p.namaPartai,
            meja: p.meja || 'Meja 1',
            pemainA: {
              ...p.pemainA,
              nama: namaDisplayA
            },
            pemainB: {
              ...p.pemainB,
              nama: namaDisplayB
            },
            skor: [],
            pemenang: null,
            selesai: false
          };
        }),
        createdBy: currentUser?.uid || '',
        createdByName: currentUser?.displayName || currentUser?.email || 'Admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Auto-register new players to Member list (without duplicates)
      const playersToRegister = [];
      partaiList.forEach(p => {
        if (p.tipe === 'Single') {
          if (p.pemainA?.nama) playersToRegister.push({ nama: p.pemainA.nama, namaPTM: ptmANama.trim() });
          if (p.pemainB?.nama) playersToRegister.push({ nama: p.pemainB.nama, namaPTM: ptmBNama.trim() });
        } else {
          if (p.pemainA?.pemain1?.nama) playersToRegister.push({ nama: p.pemainA.pemain1.nama, namaPTM: ptmANama.trim() });
          if (p.pemainA?.pemain2?.nama) playersToRegister.push({ nama: p.pemainA.pemain2.nama, namaPTM: ptmANama.trim() });
          if (p.pemainA?.nama) playersToRegister.push({ nama: p.pemainA.nama, namaPTM: ptmANama.trim() });

          if (p.pemainB?.pemain1?.nama) playersToRegister.push({ nama: p.pemainB.pemain1.nama, namaPTM: ptmBNama.trim() });
          if (p.pemainB?.pemain2?.nama) playersToRegister.push({ nama: p.pemainB.pemain2.nama, namaPTM: ptmBNama.trim() });
          if (p.pemainB?.nama) playersToRegister.push({ nama: p.pemainB.nama, namaPTM: ptmBNama.trim() });
        }
      });
      await ensurePemainRegistered(playersToRegister, currentUser);

      await addPersahabatan(payload);
      navigate(`/persahabatan/${matchId}`);
    } catch (err) {
      console.error("Error creating friendly match:", err);
      alert("Gagal membuat pertandingan persahabatan: " + err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container fade-in" style={{ maxWidth: '960px' }}>
      {/* Back Button & Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '2rem' }}>
        <button
          onClick={() => navigate('/persahabatan')}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          &larr; Kembali
        </button>
        <div>
          <h1 style={{ fontSize: '1.8rem', margin: 0 }}>
            Buat Laga Persahabatan <span style={{ color: 'var(--primary-color)' }}>Antar PTM</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '4px 0 0 0' }}>
            Atur tim, venue, dan susunan partai pertandingan antar klub tenis meja.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* SECTION 1: INFORMASI LAGA & VENUE */}
        <div className="panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.3rem' }}>📋</span>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>1. Informasi Pertandingan</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Judul Pertandingan (Opsional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Contoh: Laga Silaturahmi Awal Tahun 2026"
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Tanggal Pertandingan *</label>
                <input
                  type="date"
                  className="form-input"
                  required
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Waktu / Jam Mulai</label>
                <input
                  type="time"
                  className="form-input"
                  value={jam}
                  onChange={(e) => setJam(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Jumlah Meja yang Digunakan *</label>
                <select
                  className="form-input"
                  value={jumlahMeja}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setJumlahMeja(val);
                    setPartaiList(prev => prev.map((p, idx) => ({
                      ...p,
                      meja: `Meja ${(idx % val) + 1}`
                    })));
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16].map(num => (
                    <option key={num} value={num}>{num} Meja</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Lokasi / Tempat / GOR</label>
              <input
                type="text"
                className="form-input"
                placeholder="Contoh: GOR Tenis Meja Sukamaju / Hall PTM Garuda"
                value={lokasi}
                onChange={(e) => setLokasi(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: TIM PTM A VS PTM B */}
        <div className="panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.3rem' }}>🛡️</span>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>2. Tim yang Bertanding</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {/* PTM A */}
            <div style={{
              background: 'rgba(0, 200, 255, 0.04)',
              border: '1px solid rgba(0, 200, 255, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.2rem' }}>🏠</span>
                <strong style={{ color: 'var(--primary-color)', fontSize: '1.05rem' }}>PTM Tim A (Tuan Rumah)</strong>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Nama PTM A *</label>
                <input
                  type="text"
                  list="ptm-list-a"
                  className="form-input"
                  required
                  placeholder="Ketik atau pilih PTM..."
                  value={ptmANama}
                  onChange={(e) => setPtmANama(e.target.value)}
                />
                <datalist id="ptm-list-a">
                  {ptmOptions.map(p => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nama Kapten / Official Tim A</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: Pak Bambang"
                  value={ptmAKapten}
                  onChange={(e) => setPtmAKapten(e.target.value)}
                />
              </div>
            </div>

            {/* PTM B */}
            <div style={{
              background: 'rgba(168, 85, 247, 0.04)',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.2rem' }}>✈️</span>
                <strong style={{ color: 'var(--secondary-color)', fontSize: '1.05rem' }}>PTM Tim B (Tamu)</strong>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Nama PTM B *</label>
                <input
                  type="text"
                  list="ptm-list-b"
                  className="form-input"
                  required
                  placeholder="Ketik atau pilih PTM..."
                  value={ptmBNama}
                  onChange={(e) => setPtmBNama(e.target.value)}
                />
                <datalist id="ptm-list-b">
                  {ptmOptions.map(p => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nama Kapten / Official Tim B</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: Pak Joko"
                  value={ptmBKapten}
                  onChange={(e) => setPtmBKapten(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: SUSUNAN PARTAI & PEMAIN */}
        <div className="panel" style={{ padding: '2rem' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.5rem',
            borderBottom: '1px solid var(--border-light)',
            paddingBottom: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.3rem' }}>⚔️</span>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                3. Susunan Partai Pertandingan ({partaiList.length} Partai)
              </h3>
            </div>

            {/* Quick Preset Buttons */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => applyPreset('3_partai')}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.8rem' }}
              >
                Preset 3 Partai
              </button>
              <button
                type="button"
                onClick={() => applyPreset('5_partai')}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.8rem' }}
              >
                Preset 5 Partai
              </button>
              <button
                type="button"
                onClick={() => applyPreset('7_partai')}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.8rem' }}
              >
                Preset 7 Partai
              </button>
            </div>
          </div>

          {/* List Partai */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {partaiList.map((partai, index) => {
              const isSingle = partai.tipe === 'Single';

              return (
                <div
                  key={partai.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                    position: 'relative'
                  }}
                >
                  {/* Partai Header */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    marginBottom: '1rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid var(--border-light)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        background: 'var(--bg-surface-elevated)',
                        color: 'var(--primary-color)',
                        fontWeight: 'bold',
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem'
                      }}>
                        Partai #{partai.nomor}
                      </span>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => handleTipePartaiChange(index, 'Single')}
                          className={`btn btn-sm ${isSingle ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '2px 10px', fontSize: '0.78rem' }}
                        >
                          👤 Tunggal
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTipePartaiChange(index, 'Double')}
                          className={`btn btn-sm ${!isSingle ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '2px 10px', fontSize: '0.78rem' }}
                        >
                          👥 Ganda
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <select
                        className="form-input"
                        value={partai.meja || tableOptions[0] || 'Meja 1'}
                        onChange={(e) => handleUpdatePartai(index, 'meja', e.target.value)}
                        style={{ padding: '4px 10px', fontSize: '0.8rem', width: 'auto' }}
                      >
                        {tableOptions.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => handleRemovePartai(index)}
                        className="btn btn-sm danger"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        title="Hapus Partai Ini"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Player Selectors */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr',
                    alignItems: 'center',
                    gap: '1rem'
                  }}>
                    {/* Pemain Tim A */}
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary-color)', marginBottom: '6px' }}>
                        {ptmANama || 'Tim A'} ({isSingle ? '1 Pemain' : '2 Pemain'})
                      </div>

                      {isSingle ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <input
                            type="text"
                            list={`players-a-${index}`}
                            className="form-input"
                            placeholder="Ketik / pilih pemain Tim A..."
                            value={partai.pemainA?.nama || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const matched = playersPTMA.find(p => p.nama === val);
                              handleUpdatePartai(index, 'pemainA', {
                                nama: val,
                                id: matched ? matched.id : null
                              });
                            }}
                          />
                          <datalist id={`players-a-${index}`}>
                            {playersPTMA.map(p => (
                              <option key={p.id} value={p.nama}>
                                {p.nama} ({p.divisi ? `Div ${p.divisi}` : 'Member'})
                              </option>
                            ))}
                          </datalist>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <input
                            type="text"
                            list={`players-a1-${index}`}
                            className="form-input"
                            placeholder="Pemain A1 (Ketik/Pilih)..."
                            value={partai.pemainA?.pemain1?.nama || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const p2 = partai.pemainA?.pemain2 || { nama: '', id: '' };
                              const matched = playersPTMA.find(p => p.nama === val);
                              handleUpdatePartai(index, 'pemainA', {
                                ...partai.pemainA,
                                pemain1: { nama: val, id: matched ? matched.id : null },
                                pemain2: p2,
                                nama: val && p2.nama ? `${val} / ${p2.nama}` : val
                              });
                            }}
                          />
                          <datalist id={`players-a1-${index}`}>
                            {playersPTMA.map(p => (
                              <option key={p.id} value={p.nama}>{p.nama}</option>
                            ))}
                          </datalist>

                          <input
                            type="text"
                            list={`players-a2-${index}`}
                            className="form-input"
                            placeholder="Pemain A2 (Ketik/Pilih)..."
                            value={partai.pemainA?.pemain2?.nama || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const p1 = partai.pemainA?.pemain1 || { nama: '', id: '' };
                              const matched = playersPTMA.find(p => p.nama === val);
                              handleUpdatePartai(index, 'pemainA', {
                                ...partai.pemainA,
                                pemain1: p1,
                                pemain2: { nama: val, id: matched ? matched.id : null },
                                nama: p1.nama && val ? `${p1.nama} / ${val}` : val
                              });
                            }}
                          />
                          <datalist id={`players-a2-${index}`}>
                            {playersPTMA.map(p => (
                              <option key={p.id} value={p.nama}>{p.nama}</option>
                            ))}
                          </datalist>
                        </div>
                      )}
                    </div>

                    {/* VS Divider */}
                    <div style={{
                      fontWeight: '800',
                      color: 'var(--text-muted)',
                      fontSize: '1.1rem',
                      padding: '0 4px'
                    }}>
                      VS
                    </div>

                    {/* Pemain Tim B */}
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--secondary-color)', marginBottom: '6px' }}>
                        {ptmBNama || 'Tim B'} ({isSingle ? '1 Pemain' : '2 Pemain'})
                      </div>

                      {isSingle ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <input
                            type="text"
                            list={`players-b-${index}`}
                            className="form-input"
                            placeholder="Ketik / pilih pemain Tim B..."
                            value={partai.pemainB?.nama || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const matched = playersPTMB.find(p => p.nama === val);
                              handleUpdatePartai(index, 'pemainB', {
                                nama: val,
                                id: matched ? matched.id : null
                              });
                            }}
                          />
                          <datalist id={`players-b-${index}`}>
                            {playersPTMB.map(p => (
                              <option key={p.id} value={p.nama}>
                                {p.nama} ({p.divisi ? `Div ${p.divisi}` : 'Member'})
                              </option>
                            ))}
                          </datalist>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <input
                            type="text"
                            list={`players-b1-${index}`}
                            className="form-input"
                            placeholder="Pemain B1 (Ketik/Pilih)..."
                            value={partai.pemainB?.pemain1?.nama || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const p2 = partai.pemainB?.pemain2 || { nama: '', id: '' };
                              const matched = playersPTMB.find(p => p.nama === val);
                              handleUpdatePartai(index, 'pemainB', {
                                ...partai.pemainB,
                                pemain1: { nama: val, id: matched ? matched.id : null },
                                pemain2: p2,
                                nama: val && p2.nama ? `${val} / ${p2.nama}` : val
                              });
                            }}
                          />
                          <datalist id={`players-b1-${index}`}>
                            {playersPTMB.map(p => (
                              <option key={p.id} value={p.nama}>{p.nama}</option>
                            ))}
                          </datalist>

                          <input
                            type="text"
                            list={`players-b2-${index}`}
                            className="form-input"
                            placeholder="Pemain B2 (Ketik/Pilih)..."
                            value={partai.pemainB?.pemain2?.nama || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const p1 = partai.pemainB?.pemain1 || { nama: '', id: '' };
                              const matched = playersPTMB.find(p => p.nama === val);
                              handleUpdatePartai(index, 'pemainB', {
                                ...partai.pemainB,
                                pemain1: p1,
                                pemain2: { nama: val, id: matched ? matched.id : null },
                                nama: p1.nama && val ? `${p1.nama} / ${val}` : val
                              });
                            }}
                          />
                          <datalist id={`players-b2-${index}`}>
                            {playersPTMB.map(p => (
                              <option key={p.id} value={p.nama}>{p.nama}</option>
                            ))}
                          </datalist>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Partai Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '1.25rem', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => handleAddPartai('Single')}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>+</span> Tambah Partai Tunggal
            </button>
            <button
              type="button"
              onClick={() => handleAddPartai('Double')}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>+</span> Tambah Partai Ganda
            </button>
          </div>
        </div>

        {/* SECTION 4: CATATAN & SUBMIT */}
        <div className="panel" style={{ padding: '2rem' }}>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Catatan Tambahan / Regulasi Khusus (Opsional)</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Contoh: Setiap pemain maksimal bermain di 2 partai. Menggunakan bola Double Fish V40+..."
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button
              type="button"
              onClick={() => navigate('/persahabatan')}
              className="btn btn-secondary"
              disabled={submitting}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ minWidth: '180px', fontWeight: 'bold' }}
            >
              {submitting ? 'Menyimpan...' : '🚀 Buat & Buka Laga'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreateFriendlyMatch;

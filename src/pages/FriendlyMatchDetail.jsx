import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPersahabatanById, updatePersahabatan, deletePersahabatan, getPemain, ensurePemainRegistered } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import { formatTanggal, generateId } from '../utils/helpers';
import { tentukanPemenang } from '../utils/tournament';

const FriendlyMatchDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, isSuperAdmin, userPTM } = useAuth();

  const [matchData, setMatchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pemainList, setPemainList] = useState([]);

  // Modal states
  const [activeScoreMatch, setActiveScoreMatch] = useState(null);
  const [editMatchModal, setEditMatchModal] = useState(null); // for editing player names in a partai
  const [showAddPartaiModal, setShowAddPartaiModal] = useState(false);
  const [showBigScoreboard, setShowBigScoreboard] = useState(false);

  // Score modal state
  const [scores, setScores] = useState(Array.from({ length: 5 }, () => ['', '']));
  const [modalMeja, setModalMeja] = useState('Meja 1');
  const [modalJam, setModalJam] = useState('');

  // Add partai modal state
  const [newPartaiTipe, setNewPartaiTipe] = useState('Single');
  const [newPartaiNama, setNewPartaiNama] = useState('');
  const [newPartaiMeja, setNewPartaiMeja] = useState('Meja 1');
  const [newPemainANama, setNewPemainANama] = useState('');
  const [newPemainBNama, setNewPemainBNama] = useState('');

  const loadMatch = async () => {
    try {
      const data = await getPersahabatanById(id);
      if (data) {
        setMatchData(data);
      } else {
        alert("Pertandingan persahabatan tidak ditemukan!");
        navigate('/persahabatan');
      }
    } catch (e) {
      console.error("Error loading friendly match:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMatch();
    getPemain().then(res => setPemainList(res || [])).catch(() => {});
  }, [id]);

  const canManage = isSuperAdmin || (currentUser && matchData?.createdBy === currentUser.uid);

  // Handle opening score modal
  const handleOpenScoreModal = (partai) => {
    setActiveScoreMatch(partai);
    setModalMeja(partai.meja || 'Meja 1');
    setModalJam(partai.jam || '');

    const requiredSets = matchData.formatSet === 'best_of_3' ? 3 : 5;
    if (partai.skor && partai.skor.length > 0) {
      const initial = Array.from({ length: requiredSets }, (_, i) =>
        partai.skor[i] ? [String(partai.skor[i][0]), String(partai.skor[i][1])] : ['', '']
      );
      setScores(initial);
    } else {
      setScores(Array.from({ length: requiredSets }, () => ['', '']));
    }
  };

  const handleScoreChange = (setIndex, playerIndex, value) => {
    const newScores = scores.map((s, i) =>
      i === setIndex ? s.map((v, j) => (j === playerIndex ? value : v)) : [...s]
    );
    setScores(newScores);
  };

  const handleSaveScore = async () => {
    if (!activeScoreMatch || !matchData) return;

    const requiredWins = matchData.formatSet === 'best_of_3' ? 2 : 3;
    const currentValidScores = scores
      .filter(s => s[0] !== '' && s[1] !== '')
      .map(s => [parseInt(s[0]) || 0, parseInt(s[1]) || 0]);

    const winnerNumber = tentukanPemenang(currentValidScores, requiredWins);
    const pemenang = winnerNumber === 1 ? 'ptmA' : winnerNumber === 2 ? 'ptmB' : null;
    const selesai = pemenang !== null;

    const updatedPartaiList = matchData.partai.map(p => {
      if (p.id === activeScoreMatch.id) {
        return {
          ...p,
          skor: currentValidScores,
          pemenang: pemenang,
          selesai: selesai,
          meja: modalMeja,
          jam: modalJam
        };
      }
      return p;
    });

    // Calculate total won partai
    let totalWonA = 0;
    let totalWonB = 0;
    let allFinished = true;
    let hasStarted = false;

    updatedPartaiList.forEach(p => {
      if (p.pemenang === 'ptmA') totalWonA++;
      if (p.pemenang === 'ptmB') totalWonB++;
      if (!p.selesai) allFinished = false;
      if (p.selesai || (p.skor && p.skor.length > 0)) hasStarted = true;
    });

    let matchStatus = matchData.status;
    if (allFinished && updatedPartaiList.length > 0) {
      matchStatus = 'selesai';
    } else if (hasStarted) {
      matchStatus = 'berlangsung';
    }

    let pemenangPtm = null;
    if (totalWonA > totalWonB) pemenangPtm = 'ptmA';
    else if (totalWonB > totalWonA) pemenangPtm = 'ptmB';
    else if (allFinished && totalWonA === totalWonB) pemenangPtm = 'draw';

    const updatedData = {
      ...matchData,
      partai: updatedPartaiList,
      skorA: totalWonA,
      skorB: totalWonB,
      status: matchStatus,
      pemenangPtm: pemenangPtm,
      updatedAt: new Date().toISOString()
    };

    try {
      await updatePersahabatan(matchData.id, updatedData);
      setMatchData(updatedData);
      setActiveScoreMatch(null);
    } catch (err) {
      alert("Gagal menyimpan skor: " + err.message);
    }
  };

  const handleAddPartai = async (e) => {
    e.preventDefault();
    if (!newPemainANama.trim() || !newPemainBNama.trim()) {
      return alert("Nama pemain Tim A dan Tim B wajib diisi!");
    }

    const nextNomor = matchData.partai.length + 1;
    const defaultNama = `Partai ${nextNomor} (${newPartaiTipe === 'Single' ? 'Tunggal' : 'Ganda'})`;

    const newPartaiObj = {
      id: generateId(),
      nomor: nextNomor,
      tipe: newPartaiTipe,
      namaPartai: newPartaiNama.trim() || defaultNama,
      meja: newPartaiMeja,
      jam: '',
      pemainA: {
        nama: newPemainANama.trim(),
        id: null
      },
      pemainB: {
        nama: newPemainBNama.trim(),
        id: null
      },
      skor: [],
      pemenang: null,
      selesai: false
    };

    const updatedPartaiList = [...matchData.partai, newPartaiObj];
    const updatedData = {
      ...matchData,
      partai: updatedPartaiList,
      updatedAt: new Date().toISOString()
    };

    try {
      // Auto-register new players to Member list
      await ensurePemainRegistered([
        { nama: newPemainANama, namaPTM: matchData.ptmA?.nama || '' },
        { nama: newPemainBNama, namaPTM: matchData.ptmB?.nama || '' }
      ], currentUser);

      await updatePersahabatan(matchData.id, updatedData);
      setMatchData(updatedData);
      setShowAddPartaiModal(false);
      setNewPemainANama('');
      setNewPemainBNama('');
      setNewPartaiNama('');
    } catch (err) {
      alert("Gagal menambah partai: " + err.message);
    }
  };

  const handleDeletePartai = async (partaiId) => {
    if (!window.confirm("Hapus partai pertandingan ini?")) return;

    const filtered = matchData.partai.filter(p => p.id !== partaiId).map((p, idx) => ({
      ...p,
      nomor: idx + 1
    }));

    let totalWonA = 0;
    let totalWonB = 0;
    filtered.forEach(p => {
      if (p.pemenang === 'ptmA') totalWonA++;
      if (p.pemenang === 'ptmB') totalWonB++;
    });

    const updatedData = {
      ...matchData,
      partai: filtered,
      skorA: totalWonA,
      skorB: totalWonB,
      updatedAt: new Date().toISOString()
    };

    try {
      await updatePersahabatan(matchData.id, updatedData);
      setMatchData(updatedData);
    } catch (err) {
      alert("Gagal menghapus partai: " + err.message);
    }
  };

  const handleSaveEditPartai = async () => {
    if (!editMatchModal) return;

    const updatedPartaiList = matchData.partai.map(p => {
      if (p.id === editMatchModal.id) {
        return editMatchModal;
      }
      return p;
    });

    const updatedData = {
      ...matchData,
      partai: updatedPartaiList,
      updatedAt: new Date().toISOString()
    };

    try {
      // Auto-register any new players to Member list
      await ensurePemainRegistered([
        { nama: editMatchModal.pemainA?.nama, namaPTM: matchData.ptmA?.nama || '' },
        { nama: editMatchModal.pemainB?.nama, namaPTM: matchData.ptmB?.nama || '' }
      ], currentUser);

      await updatePersahabatan(matchData.id, updatedData);
      setMatchData(updatedData);
      setEditMatchModal(null);
    } catch (err) {
      alert("Gagal memperbarui susunan partai: " + err.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="page-container" style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>;
  }

  if (!matchData) return null;

  const ptmAName = matchData.ptmA?.nama || 'PTM Tim A';
  const ptmBName = matchData.ptmB?.nama || 'PTM Tim B';
  const skorA = matchData.skorA ?? 0;
  const skorB = matchData.skorB ?? 0;
  const isFinished = matchData.status === 'selesai';
  const isLive = matchData.status === 'berlangsung';
  const requiredWins = matchData.formatSet === 'best_of_3' ? 2 : 3;

  // Table options based on matchData.jumlahMeja
  const totalTables = matchData.jumlahMeja || 2;
  const tableOptions = Array.from(
    { length: Math.max(1, parseInt(totalTables) || 1) },
    (_, i) => `Meja ${i + 1}`
  );

  // Helper to lookup rubber info from pemainList
  const getPlayerRubberInfo = (nama) => {
    if (!nama || !pemainList || pemainList.length === 0) return [];
    const rawNames = typeof nama === 'string' && nama.includes('/') ? nama.split('/') : [nama];
    
    return rawNames.map(rn => {
      const clean = (rn || '').trim();
      if (!clean) return null;
      const found = pemainList.find(p => (p.nama || p.name || '').trim().toLowerCase() === clean.toLowerCase());
      if (found) {
        return {
          nama: clean,
          fh: found.karetForehand || 'Normal',
          bh: found.karetBackhand || 'Normal'
        };
      }
      return {
        nama: clean,
        fh: 'Normal',
        bh: 'Normal'
      };
    }).filter(Boolean);
  };

  // Live modal winner calculation
  const currentValidScoresModal = scores
    .filter(s => s[0] !== '' && s[1] !== '')
    .map(s => [parseInt(s[0]) || 0, parseInt(s[1]) || 0]);
  const liveWinnerModal = tentukanPemenang(currentValidScoresModal, requiredWins);
  let setsWon1Modal = 0, setsWon2Modal = 0;
  currentValidScoresModal.forEach(s => {
    if (s[0] >= 11 && s[0] - s[1] >= 2) setsWon1Modal++;
    else if (s[1] >= 11 && s[1] - s[0] >= 2) setsWon2Modal++;
  });

  return (
    <div className="page-container fade-in">
      {/* Action Bar (Not shown during print) */}
      <div className="no-print" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <button
          onClick={() => navigate('/persahabatan')}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          &larr; Kembali ke Daftar Laga
        </button>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowBigScoreboard(true)}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            📺 Layar Papan Skor (TV View)
          </button>
          <button
            onClick={handlePrint}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            🖨️ Cetak Lembar Rekap
          </button>
          {canManage && (
            <button
              onClick={() => setShowAddPartaiModal(true)}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              + Tambah Partai Dadakan
            </button>
          )}
        </div>
      </div>

      {/* Printable Official Header (Only in Print) */}
      <div className="print-only" style={{ display: 'none', textAlign: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.4rem', textTransform: 'uppercase', margin: 0 }}>LEMBAR REKAPITULASI PERTANDINGAN PERSAHABATAN</h2>
        <h3 style={{ fontSize: '1.1rem', margin: '4px 0 10px 0' }}>{matchData.judul || `${ptmAName} VS ${ptmBName}`}</h3>
        <p style={{ fontSize: '0.85rem', color: '#555', margin: 0 }}>
          Tanggal: {formatTanggal(matchData.tanggal)} {matchData.jam ? `| Pukul ${matchData.jam}` : ''} | Tempat: {matchData.lokasi || '-'} | {totalTables} Meja Digunakan
        </p>
        <hr style={{ margin: '12px 0', borderColor: '#ccc' }} />
      </div>

      {/* TEAM SCOREBOARD BANNER HERO */}
      <div className="panel" style={{
        padding: '2rem 1.5rem',
        marginBottom: '2rem',
        position: 'relative',
        overflow: 'hidden',
        border: isLive 
          ? '1px solid var(--warning-color)' 
          : isFinished 
          ? '1px solid rgba(16, 185, 129, 0.4)' 
          : '1px solid var(--border-color)',
        boxShadow: isLive ? '0 0 30px rgba(245, 158, 11, 0.15)' : '0 0 30px rgba(0, 200, 255, 0.1)'
      }}>
        {/* Match Info Sub-header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 14px',
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
            fontSize: '0.8rem',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '8px'
          }}>
            {isLive && <span className="animate-pulse" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--warning-color)' }}></span>}
            {isLive ? '🔴 LIVE SPARRING' : isFinished ? '🏆 PERTANDINGAN SELESAI' : '📅 TERJADWAL'}
          </div>

          <h2 style={{ fontSize: '1.6rem', color: 'var(--text-primary)', margin: '4px 0' }}>
            {matchData.judul || `${ptmAName} vs ${ptmBName}`}
          </h2>

          <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <span>📅 {formatTanggal(matchData.tanggal)} {matchData.jam && `• ${matchData.jam} WIB`}</span>
            {matchData.lokasi && <span>📍 {matchData.lokasi}</span>}
            <span>🏓 {totalTables} Meja Digunakan</span>
            <span>⚙️ {matchData.formatSet === 'best_of_3' ? 'Best of 3 Sets' : 'Best of 5 Sets'}</span>
          </div>
        </div>

        {/* Big Teams Duel Scoreboard */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: '1rem',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          border: '1px solid var(--border-light)'
        }}>
          {/* Team A */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '1.8rem',
              fontWeight: '800',
              fontFamily: 'var(--font-display)',
              color: skorA > skorB ? 'var(--primary-color)' : 'var(--text-primary)',
              letterSpacing: '0.02em',
              lineHeight: 1.2
            }}>
              {ptmAName}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              🏠 Tuan Rumah {matchData.ptmA?.kapten ? `• Kapten: ${matchData.ptmA.kapten}` : ''}
            </div>
            {isFinished && matchData.pemenangPtm === 'ptmA' && (
              <div style={{ marginTop: '8px', color: 'var(--success-color)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                🎉 PEMENANG LAGA
              </div>
            )}
          </div>

          {/* Central Aggregate Score */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 24px',
            background: 'var(--bg-surface-elevated)',
            borderRadius: 'var(--radius-md)',
            border: '2px solid var(--border-color)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.6)'
          }}>
            <span style={{
              fontSize: '3rem',
              fontWeight: '900',
              fontFamily: 'var(--font-display)',
              color: skorA > skorB ? 'var(--primary-color)' : 'var(--text-primary)',
              minWidth: '40px',
              textAlign: 'center'
            }}>
              {skorA}
            </span>
            <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>:</span>
            <span style={{
              fontSize: '3rem',
              fontWeight: '900',
              fontFamily: 'var(--font-display)',
              color: skorB > skorA ? 'var(--primary-color)' : 'var(--text-primary)',
              minWidth: '40px',
              textAlign: 'center'
            }}>
              {skorB}
            </span>
          </div>

          {/* Team B */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '1.8rem',
              fontWeight: '800',
              fontFamily: 'var(--font-display)',
              color: skorB > skorA ? 'var(--primary-color)' : 'var(--text-primary)',
              letterSpacing: '0.02em',
              lineHeight: 1.2
            }}>
              {ptmBName}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              ✈️ Tamu {matchData.ptmB?.kapten ? `• Kapten: ${matchData.ptmB.kapten}` : ''}
            </div>
            {isFinished && matchData.pemenangPtm === 'ptmB' && (
              <div style={{ marginTop: '8px', color: 'var(--success-color)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                🎉 PEMENANG LAGA
              </div>
            )}
          </div>
        </div>

        {matchData.catatan && (
          <div style={{
            marginTop: '1.25rem',
            padding: '10px 15px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            borderLeft: '3px solid var(--primary-color)'
          }}>
            <strong>📌 Catatan:</strong> {matchData.catatan}
          </div>
        )}
      </div>

      {/* SEKSI STATUS & PERTANDINGAN DI MASING-MASING MEJA */}
      <div className="panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.2rem',
          borderBottom: '1px solid var(--border-light)',
          paddingBottom: '0.75rem',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🏓</span> Status Pertandingan di Masing-Masing Meja ({tableOptions.length} Meja)
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Menampilkan partai yang sedang berlangsung & antrean per meja
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(${tableOptions.length > 2 ? '300px' : '360px'}, 1fr))`,
          gap: '1.2rem'
        }}>
          {tableOptions.map(tableName => {
            const tablePartai = (matchData.partai || []).filter(p => (p.meja || 'Meja 1') === tableName);
            const currentActive = tablePartai.find(p => !p.selesai) || tablePartai[tablePartai.length - 1];
            const finishedCount = tablePartai.filter(p => p.selesai).length;

            return (
              <div
                key={tableName}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
                  padding: '1.2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.8rem'
                }}
              >
                {/* Header Meja */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--border-light)',
                  paddingBottom: '0.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🏓</span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--primary-color)' }}>{tableName}</strong>
                  </div>
                  <span style={{
                    fontSize: '0.75rem',
                    background: 'rgba(255,255,255,0.06)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    color: 'var(--text-secondary)'
                  }}>
                    {finishedCount}/{tablePartai.length} Selesai
                  </span>
                </div>

                {/* Partai Aktif / Berlangsung di Meja ini */}
                {currentActive ? (
                  <div style={{
                    background: currentActive.selesai ? 'rgba(16, 185, 129, 0.06)' : 'rgba(0, 200, 255, 0.06)',
                    border: currentActive.selesai ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(0, 200, 255, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.9rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                        Partai #{currentActive.nomor} ({currentActive.tipe === 'Single' ? 'Tunggal' : 'Ganda'})
                      </span>
                      <span style={{
                        fontWeight: 'bold',
                        color: currentActive.selesai ? 'var(--success-color)' : 'var(--warning-color)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {currentActive.selesai ? '✓ SELESAI' : '🔴 SEDANG MAIN'}
                        {currentActive.jam && ` • 🕒 ${currentActive.jam}`}
                      </span>
                    </div>

                    {/* Matchup Pemain */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '8px' }}>
                      <div>
                        <strong style={{ fontSize: '0.95rem', color: currentActive.pemenang === 'ptmA' ? 'var(--primary-color)' : 'var(--text-primary)' }}>
                          {currentActive.pemainA?.nama || 'Tim A'}
                        </strong>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{ptmAName}</div>
                        {/* Rubber info */}
                        <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', marginTop: '2px' }}>
                          {getPlayerRubberInfo(currentActive.pemainA?.nama).map((r, i) => (
                            <span key={i} style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', padding: '0 4px', borderRadius: '3px', color: 'var(--text-secondary)' }}>
                              FH:{r.fh} BH:{r.bh}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div style={{ textAlign: 'center', padding: '0 6px' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: '800', fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                          {(() => {
                            let p1 = 0, p2 = 0;
                            (currentActive.skor || []).forEach(s => {
                              if (s[0] > s[1]) p1++;
                              else if (s[1] > s[0]) p2++;
                            });
                            return currentActive.skor?.length > 0 ? `${p1} - ${p2}` : 'VS';
                          })()}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '0.95rem', color: currentActive.pemenang === 'ptmB' ? 'var(--secondary-color)' : 'var(--text-primary)' }}>
                          {currentActive.pemainB?.nama || 'Tim B'}
                        </strong>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{ptmBName}</div>
                        {/* Rubber info */}
                        <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: '2px' }}>
                          {getPlayerRubberInfo(currentActive.pemainB?.nama).map((r, i) => (
                            <span key={i} style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', padding: '0 4px', borderRadius: '3px', color: 'var(--text-secondary)' }}>
                              FH:{r.fh} BH:{r.bh}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>
                    Belum ada partai di meja ini
                  </div>
                )}

                {/* Antrean / Riwayat Partai Lain di Meja Ini */}
                {tablePartai.length > 1 && (
                  <div style={{ marginTop: '2px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 'bold' }}>
                      Jadwal / Antrean Partai ({tablePartai.length} partai):
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '130px', overflowY: 'auto' }}>
                      {tablePartai.map(p => {
                        let p1 = 0, p2 = 0;
                        (p.skor || []).forEach(s => {
                          if (s[0] > s[1]) p1++;
                          else if (s[1] > s[0]) p2++;
                        });
                        const isCurrent = currentActive && currentActive.id === p.id;
                        return (
                          <div
                            key={p.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '0.75rem',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              background: isCurrent ? 'rgba(0, 200, 255, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                              border: isCurrent ? '1px solid rgba(0, 200, 255, 0.3)' : '1px solid transparent'
                            }}
                          >
                            <span style={{ color: p.selesai ? 'var(--success-color)' : isCurrent ? 'var(--primary-color)' : 'var(--text-secondary)' }}>
                              #{p.nomor} {p.pemainA?.nama} vs {p.pemainB?.nama}
                            </span>
                            <span style={{ fontWeight: 'bold', color: p.selesai ? 'var(--success-color)' : 'var(--warning-color)' }}>
                              {p.selesai ? `${p1}-${p2} ✓` : (p.jam ? `🕒 ${p.jam}` : 'Antre')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SUSUNAN & HASIL PARTAI */}
      <div className="panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          borderBottom: '1px solid var(--border-light)',
          paddingBottom: '0.75rem',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-primary)' }}>
            ⚔️ Susunan & Hasil Partai Pertandingan ({matchData.partai?.length || 0} Partai)
          </h3>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Klik <strong>"Input Skor"</strong> untuk mengisi hasil set tiap partai
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {matchData.partai?.map((partai, index) => {
            const isFinishedPartai = partai.selesai;
            const winnerA = partai.pemenang === 'ptmA';
            const winnerB = partai.pemenang === 'ptmB';

            // Calculate set score summary (e.g., "3 - 1")
            let p1Sets = 0, p2Sets = 0;
            if (partai.skor && partai.skor.length > 0) {
              partai.skor.forEach(s => {
                if (s[0] > s[1]) p1Sets++;
                else if (s[1] > s[0]) p2Sets++;
              });
            }

            return (
              <div
                key={partai.id}
                style={{
                  background: isFinishedPartai ? 'rgba(0, 200, 255, 0.02)' : 'rgba(255, 255, 255, 0.02)',
                  border: isFinishedPartai 
                    ? (winnerA ? '1px solid rgba(0, 200, 255, 0.3)' : '1px solid rgba(168, 85, 247, 0.3)')
                    : '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                {/* Partai Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  borderBottom: '1px solid var(--border-light)',
                  paddingBottom: '0.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontWeight: 'bold',
                      color: 'var(--text-primary)',
                      background: 'var(--bg-surface-elevated)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)'
                    }}>
                      Partai #{partai.nomor}
                    </span>
                    <span>• {partai.tipe === 'Single' ? '👤 Tunggal' : '👥 Ganda'}</span>
                    <span>• {partai.meja || 'Meja 1'}</span>
                    {partai.jam && <span>• 🕒 {partai.jam}</span>}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontWeight: 'bold',
                      color: isFinishedPartai ? 'var(--success-color)' : 'var(--warning-color)',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase'
                    }}>
                      {isFinishedPartai ? '✓ SELESAI' : '⏳ BELUM TANDING'}
                    </span>

                    {canManage && (
                      <div className="no-print" style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => setEditMatchModal(partai)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                          title="Ganti Pemain"
                        >
                          ✏️ Ganti Pemain
                        </button>
                        <button
                          onClick={() => handleDeletePartai(partai.id)}
                          className="btn btn-sm danger"
                          style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                          title="Hapus Partai"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Matchup & Score Display */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  alignItems: 'center',
                  gap: '1rem'
                }}>
                  {/* Player A */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: winnerA ? 'rgba(0, 200, 255, 0.1)' : 'transparent',
                    border: winnerA ? '1px solid rgba(0, 200, 255, 0.3)' : '1px solid transparent'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>{winnerA ? '🏆' : '🏓'}</span>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{
                        fontWeight: 'bold',
                        fontSize: '1.05rem',
                        color: winnerA ? 'var(--primary-color)' : 'var(--text-primary)'
                      }}>
                        {partai.pemainA?.nama || 'Pemain Tim A'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ptmAName}</div>
                      
                      {/* Info Karet Pemain A */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                        {getPlayerRubberInfo(partai.pemainA?.nama).map((r, rIdx) => (
                          <div key={rIdx} style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                            {partai.tipe === 'Double' && (
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>{r.nama}:</span>
                            )}
                            <span style={{
                              fontSize: '0.68rem',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              background: r.fh !== 'Normal' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              color: r.fh !== 'Normal' ? 'var(--warning-color)' : 'var(--text-secondary)',
                              border: r.fh !== 'Normal' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-light)'
                            }}>
                              FH: {r.fh}
                            </span>
                            <span style={{
                              fontSize: '0.68rem',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              background: r.bh !== 'Normal' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              color: r.bh !== 'Normal' ? 'var(--secondary-color)' : 'var(--text-secondary)',
                              border: r.bh !== 'Normal' ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid var(--border-light)'
                            }}>
                              BH: {r.bh}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Score & Sets */}
                  <div style={{ textAlign: 'center', padding: '0 10px' }}>
                    {isFinishedPartai ? (
                      <div>
                        <div style={{
                          fontSize: '1.4rem',
                          fontWeight: '800',
                          fontFamily: 'var(--font-display)',
                          color: 'var(--text-primary)'
                        }}>
                          {p1Sets} - {p2Sets}
                        </div>
                        {/* Game Scores pill badges */}
                        <div style={{
                          display: 'flex',
                          gap: '4px',
                          justifyContent: 'center',
                          flexWrap: 'wrap',
                          marginTop: '4px'
                        }}>
                          {partai.skor?.map((s, sIdx) => (
                            <span
                              key={sIdx}
                              style={{
                                fontSize: '0.72rem',
                                padding: '2px 6px',
                                background: 'var(--bg-surface)',
                                borderRadius: '4px',
                                border: '1px solid var(--border-light)',
                                color: s[0] > s[1] ? 'var(--primary-color)' : s[1] > s[0] ? 'var(--secondary-color)' : 'var(--text-muted)'
                              }}
                            >
                              {s[0]}-{s[1]}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        fontSize: '0.9rem',
                        fontWeight: 'bold',
                        color: 'var(--text-muted)'
                      }}>
                        VS
                      </div>
                    )}
                  </div>

                  {/* Player B */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: winnerB ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
                    border: winnerB ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid transparent',
                    textAlign: 'right'
                  }}>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{
                        fontWeight: 'bold',
                        fontSize: '1.05rem',
                        color: winnerB ? 'var(--secondary-color)' : 'var(--text-primary)'
                      }}>
                        {partai.pemainB?.nama || 'Pemain Tim B'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ptmBName}</div>

                      {/* Info Karet Pemain B */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px', alignItems: 'flex-end' }}>
                        {getPlayerRubberInfo(partai.pemainB?.nama).map((r, rIdx) => (
                          <div key={rIdx} style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {partai.tipe === 'Double' && (
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>{r.nama}:</span>
                            )}
                            <span style={{
                              fontSize: '0.68rem',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              background: r.fh !== 'Normal' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              color: r.fh !== 'Normal' ? 'var(--warning-color)' : 'var(--text-secondary)',
                              border: r.fh !== 'Normal' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-light)'
                            }}>
                              FH: {r.fh}
                            </span>
                            <span style={{
                              fontSize: '0.68rem',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              background: r.bh !== 'Normal' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              color: r.bh !== 'Normal' ? 'var(--secondary-color)' : 'var(--text-secondary)',
                              border: r.bh !== 'Normal' ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid var(--border-light)'
                            }}>
                              BH: {r.bh}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <span style={{ fontSize: '1.2rem' }}>{winnerB ? '🏆' : '🏓'}</span>
                  </div>
                </div>

                {/* Score Button Action (No Print) */}
                {canManage && (
                  <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <button
                      onClick={() => handleOpenScoreModal(partai)}
                      className="btn btn-secondary btn-sm"
                      style={{
                        padding: '6px 14px',
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      ✏️ {isFinishedPartai ? 'Ubah Skor' : 'Input Skor Pertandingan'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* PRINTABLE FOOTER SIGNATURE SECTION */}
      <div className="print-only" style={{ display: 'none', marginTop: '40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', textAlign: 'center', gap: '20px' }}>
          <div>
            <p style={{ fontWeight: 'bold', margin: '0 0 60px 0' }}>Kapten / Official Tim A ({ptmAName})</p>
            <p style={{ textDecoration: 'underline', fontWeight: 'bold' }}>({matchData.ptmA?.kapten || '..............................'})</p>
          </div>
          <div>
            <p style={{ fontWeight: 'bold', margin: '0 0 60px 0' }}>Kapten / Official Tim B ({ptmBName})</p>
            <p style={{ textDecoration: 'underline', fontWeight: 'bold' }}>({matchData.ptmB?.kapten || '..............................'})</p>
          </div>
        </div>
      </div>

      {/* ================= MODAL INPUT SKOR PARTAI ================= */}
      {activeScoreMatch && (
        <div className="modal-overlay" onClick={() => setActiveScoreMatch(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
                🏓 Input Skor - Partai #{activeScoreMatch.nomor}
              </h3>
            </div>

            <div className="modal-body">
              {/* Head-to-Head Visual */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                marginBottom: '20px',
                background: 'rgba(0, 0, 0, 0.25)',
                padding: '12px',
                borderRadius: 'var(--radius-md)'
              }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    color: liveWinnerModal === 1 ? 'var(--color-success)' : 'var(--color-text)'
                  }}>
                    {activeScoreMatch.pemainA?.nama || 'Tim A'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ptmAName}</div>
                  
                  {/* Rubber info in modal */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px', alignItems: 'center' }}>
                    {getPlayerRubberInfo(activeScoreMatch.pemainA?.nama).map((r, rIdx) => (
                      <span key={rIdx} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {r.nama !== activeScoreMatch.pemainA?.nama && <strong style={{ color: 'var(--text-primary)' }}>{r.nama}: </strong>}
                        <span style={{ color: r.fh !== 'Normal' ? 'var(--warning-color)' : 'var(--text-secondary)' }}>FH({r.fh})</span>{' '}
                        <span style={{ color: r.bh !== 'Normal' ? 'var(--secondary-color)' : 'var(--text-secondary)' }}>BH({r.bh})</span>
                      </span>
                    ))}
                  </div>

                  <div style={{ fontSize: '1.6rem', fontWeight: 'bold', marginTop: '4px', color: 'var(--primary-color)' }}>
                    {setsWon1Modal}
                  </div>
                </div>

                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-secondary)', padding: '0 10px' }}>
                  VS
                </div>

                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    color: liveWinnerModal === 2 ? 'var(--color-success)' : 'var(--color-text)'
                  }}>
                    {activeScoreMatch.pemainB?.nama || 'Tim B'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ptmBName}</div>

                  {/* Rubber info in modal */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px', alignItems: 'center' }}>
                    {getPlayerRubberInfo(activeScoreMatch.pemainB?.nama).map((r, rIdx) => (
                      <span key={rIdx} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {r.nama !== activeScoreMatch.pemainB?.nama && <strong style={{ color: 'var(--text-primary)' }}>{r.nama}: </strong>}
                        <span style={{ color: r.fh !== 'Normal' ? 'var(--warning-color)' : 'var(--text-secondary)' }}>FH({r.fh})</span>{' '}
                        <span style={{ color: r.bh !== 'Normal' ? 'var(--secondary-color)' : 'var(--text-secondary)' }}>BH({r.bh})</span>
                      </span>
                    ))}
                  </div>

                  <div style={{ fontSize: '1.6rem', fontWeight: 'bold', marginTop: '4px', color: 'var(--secondary-color)' }}>
                    {setsWon2Modal}
                  </div>
                </div>
              </div>

              {/* Meja & Waktu Pertandingan Selector */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Meja Tanding</label>
                  <select
                    className="form-input"
                    value={modalMeja}
                    onChange={(e) => setModalMeja(e.target.value)}
                  >
                    {tableOptions.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Waktu / Jam Tanding</label>
                  <input
                    type="time"
                    className="form-input"
                    value={modalJam}
                    onChange={(e) => setModalJam(e.target.value)}
                  />
                </div>
              </div>

              {/* Score Inputs per Set */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {scores.map((set, index) => {
                  const isLocked = liveWinnerModal > 0 && set[0] === '' && set[1] === '';
                  return (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: 'rgba(255,255,255,0.02)',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        opacity: isLocked ? 0.4 : 1
                      }}
                    >
                      <label className="form-label" style={{ width: '55px', margin: 0, flexShrink: 0, fontSize: '0.85rem' }}>
                        Set {index + 1}
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        style={{ width: '70px', textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold' }}
                        value={set[0]}
                        onChange={(e) => handleScoreChange(index, 0, e.target.value)}
                        min="0"
                        placeholder="0"
                        disabled={isLocked}
                      />
                      <span style={{ fontWeight: 'bold', color: 'var(--text-secondary)' }}>-</span>
                      <input
                        type="number"
                        className="form-input"
                        style={{ width: '70px', textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold' }}
                        value={set[1]}
                        onChange={(e) => handleScoreChange(index, 1, e.target.value)}
                        min="0"
                        placeholder="0"
                        disabled={isLocked}
                      />
                    </div>
                  );
                })}
              </div>

              {liveWinnerModal > 0 && (
                <div style={{
                  marginTop: '15px',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid var(--success-color)',
                  textAlign: 'center',
                  color: 'var(--success-color)'
                }}>
                  <strong>🏆 Pemenang Partai: {liveWinnerModal === 1 ? activeScoreMatch.pemainA?.nama : activeScoreMatch.pemainB?.nama} ({liveWinnerModal === 1 ? ptmAName : ptmBName})</strong>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setActiveScoreMatch(null)}>Batal</button>
              <button className="btn btn-primary" onClick={handleSaveScore}>Simpan Skor</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL TAMBAH PARTAI DADAKAN ================= */}
      {showAddPartaiModal && (
        <div className="modal-overlay" onClick={() => setShowAddPartaiModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>+ Tambah Partai Dadakan</h3>
            </div>
            <form onSubmit={handleAddPartai}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Tipe Partai</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setNewPartaiTipe('Single')}
                      className={`btn btn-sm ${newPartaiTipe === 'Single' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1 }}
                    >
                      👤 Tunggal (Single)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPartaiTipe('Double')}
                      className={`btn btn-sm ${newPartaiTipe === 'Double' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1 }}
                    >
                      👥 Ganda (Double)
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Nama / Judul Partai (Opsional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={`Partai ${matchData.partai.length + 1} (${newPartaiTipe === 'Single' ? 'Tunggal' : 'Ganda'})`}
                    value={newPartaiNama}
                    onChange={(e) => setNewPartaiNama(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Meja Pertandingan</label>
                  <select
                    className="form-input"
                    value={newPartaiMeja}
                    onChange={(e) => setNewPartaiMeja(e.target.value)}
                  >
                    {tableOptions.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Pemain Tim A ({ptmAName}) *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder={newPartaiTipe === 'Single' ? 'Nama pemain...' : 'Nama Pemain 1 / Pemain 2...'}
                    value={newPemainANama}
                    onChange={(e) => setNewPemainANama(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Pemain Tim B ({ptmBName}) *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder={newPartaiTipe === 'Single' ? 'Nama pemain...' : 'Nama Pemain 1 / Pemain 2...'}
                    value={newPemainBNama}
                    onChange={(e) => setNewPemainBNama(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddPartaiModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary">+ Tambahkan Partai</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL GANTI PEMAIN PARTAI ================= */}
      {editMatchModal && (
        <div className="modal-overlay" onClick={() => setEditMatchModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Ganti Pemain - Partai #{editMatchModal.nomor}</h3>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Pemain Tim A ({ptmAName})</label>
                <input
                  type="text"
                  className="form-input"
                  value={editMatchModal.pemainA?.nama || ''}
                  onChange={(e) => setEditMatchModal({
                    ...editMatchModal,
                    pemainA: { ...editMatchModal.pemainA, nama: e.target.value }
                  })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Pemain Tim B ({ptmBName})</label>
                <input
                  type="text"
                  className="form-input"
                  value={editMatchModal.pemainB?.nama || ''}
                  onChange={(e) => setEditMatchModal({
                    ...editMatchModal,
                    pemainB: { ...editMatchModal.pemainB, nama: e.target.value }
                  })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditMatchModal(null)}>Batal</button>
              <button className="btn btn-primary" onClick={handleSaveEditPartai}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL FULLSCREEN BIG SCOREBOARD (TV / PROJECTOR VIEW) ================= */}
      {showBigScoreboard && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(ellipse at center, #111827 0%, #030712 100%)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          padding: '2rem',
          color: '#ffffff',
          overflowY: 'auto'
        }}>
          {/* Header Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '2rem' }}>🏓</span>
              <div>
                <h1 style={{ fontSize: '1.8rem', margin: 0, letterSpacing: '0.05em' }}>
                  {matchData.judul || 'PERTANDINGAN PERSAHABATAN TENIS MEJA'}
                </h1>
                <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.9rem' }}>
                  {matchData.lokasi ? `${matchData.lokasi} • ` : ''}{formatTanggal(matchData.tanggal)}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowBigScoreboard(false)}
              className="btn btn-secondary"
              style={{ fontSize: '1rem', padding: '8px 18px', background: 'rgba(255,255,255,0.1)' }}
            >
              ✕ Tutup Layar Penuh
            </button>
          </div>

          {/* Big Score Duel Display */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: '2rem',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '1.5rem',
            padding: '3rem 2rem',
            border: '2px solid rgba(0, 200, 255, 0.2)',
            boxShadow: '0 0 50px rgba(0, 200, 255, 0.1)',
            marginBottom: '2rem'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '3.5rem',
                fontWeight: '900',
                fontFamily: 'var(--font-display)',
                color: skorA > skorB ? '#00c8ff' : '#ffffff',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                {ptmAName}
              </div>
              <div style={{ fontSize: '1.2rem', color: '#9ca3af', marginTop: '6px' }}>TUAN RUMAH</div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              padding: '16px 40px',
              background: '#0f172a',
              borderRadius: '1rem',
              border: '3px solid #38bdf8',
              boxShadow: '0 0 40px rgba(56, 189, 248, 0.4)'
            }}>
              <span style={{ fontSize: '6rem', fontWeight: '900', fontFamily: 'var(--font-display)', color: skorA > skorB ? '#38bdf8' : '#fff' }}>
                {skorA}
              </span>
              <span style={{ fontSize: '4rem', fontWeight: '900', color: '#64748b' }}>:</span>
              <span style={{ fontSize: '6rem', fontWeight: '900', fontFamily: 'var(--font-display)', color: skorB > skorA ? '#38bdf8' : '#fff' }}>
                {skorB}
              </span>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '3.5rem',
                fontWeight: '900',
                fontFamily: 'var(--font-display)',
                color: skorB > skorA ? '#00c8ff' : '#ffffff',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                {ptmBName}
              </div>
              <div style={{ fontSize: '1.2rem', color: '#9ca3af', marginTop: '6px' }}>TIM TAMU</div>
            </div>
          </div>

          {/* Info Pertandingan di Masing-Masing Meja (TV / Projector View) */}
          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.4rem', color: '#38bdf8', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🏓</span> Info Pertandingan Tiap Meja
            </h2>

            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fit, minmax(${tableOptions.length > 2 ? '360px' : '480px'}, 1fr))`,
              gap: '1.5rem'
            }}>
              {tableOptions.map(tableName => {
                const tablePartai = (matchData.partai || []).filter(p => (p.meja || 'Meja 1') === tableName);
                const currentActive = tablePartai.find(p => !p.selesai) || tablePartai[tablePartai.length - 1];
                const finishedCount = tablePartai.filter(p => p.selesai).length;

                return (
                  <div
                    key={tableName}
                    style={{
                      background: 'rgba(15, 23, 42, 0.85)',
                      borderRadius: '1.25rem',
                      padding: '1.5rem',
                      border: '2px solid rgba(56, 189, 248, 0.4)',
                      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem'
                    }}
                  >
                    {/* Header Meja */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.6rem' }}>🏓</span>
                        <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#38bdf8' }}>{tableName}</span>
                      </div>
                      <span style={{
                        fontSize: '0.9rem',
                        background: 'rgba(255,255,255,0.1)',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        color: '#94a3b8',
                        fontWeight: 'bold'
                      }}>
                        {finishedCount}/{tablePartai.length} Selesai
                      </span>
                    </div>

                    {/* Active / Current Match */}
                    {currentActive ? (
                      <div style={{
                        background: currentActive.selesai ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.12)',
                        border: currentActive.selesai ? '2px solid rgba(16, 185, 129, 0.4)' : '2px solid rgba(56, 189, 248, 0.5)',
                        borderRadius: '1rem',
                        padding: '1.2rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '10px' }}>
                          <span style={{ fontWeight: '800', color: '#38bdf8' }}>
                            Partai #{currentActive.nomor} ({currentActive.tipe === 'Single' ? 'Tunggal' : 'Ganda'})
                          </span>
                          <span style={{
                            fontWeight: 'bold',
                            color: currentActive.selesai ? '#10b981' : '#f59e0b',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            {currentActive.selesai ? '✓ SELESAI' : '🔴 SEDANG MAIN'}
                            {currentActive.jam && ` • 🕒 ${currentActive.jam}`}
                          </span>
                        </div>

                        {/* Player Duel & Score */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '12px' }}>
                          <div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '900', color: currentActive.pemenang === 'ptmA' ? '#38bdf8' : '#fff' }}>
                              {currentActive.pemainA?.nama || 'Tim A'}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{ptmAName}</div>
                            {/* Rubbers */}
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                              {getPlayerRubberInfo(currentActive.pemainA?.nama).map((r, i) => (
                                <span key={i} style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', color: '#e2e8f0' }}>
                                  FH:{r.fh} BH:{r.bh}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div style={{ textAlign: 'center', padding: '0 10px' }}>
                            <div style={{ fontSize: '1.8rem', fontWeight: '900', fontFamily: 'var(--font-display)', color: '#fff' }}>
                              {(() => {
                                let p1 = 0, p2 = 0;
                                (currentActive.skor || []).forEach(s => {
                                  if (s[0] > s[1]) p1++;
                                  else if (s[1] > s[0]) p2++;
                                });
                                return currentActive.skor?.length > 0 ? `${p1} - ${p2}` : 'VS';
                              })()}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1.25rem', fontWeight: '900', color: currentActive.pemenang === 'ptmB' ? '#c084fc' : '#fff' }}>
                              {currentActive.pemainB?.nama || 'Tim B'}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{ptmBName}</div>
                            {/* Rubbers */}
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: '4px' }}>
                              {getPlayerRubberInfo(currentActive.pemainB?.nama).map((r, i) => (
                                <span key={i} style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', color: '#e2e8f0' }}>
                                  FH:{r.fh} BH:{r.bh}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.9rem', color: '#94a3b8', textAlign: 'center', padding: '15px' }}>
                        Tidak ada partai di meja ini
                      </div>
                    )}

                    {/* Antrean Partai di Meja Ini */}
                    {tablePartai.length > 1 && (
                      <div>
                        <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 'bold' }}>
                          Daftar & Antrean Partai di {tableName}:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '160px', overflowY: 'auto' }}>
                          {tablePartai.map(p => {
                            let p1 = 0, p2 = 0;
                            (p.skor || []).forEach(s => {
                              if (s[0] > s[1]) p1++;
                              else if (s[1] > s[0]) p2++;
                            });
                            const isCurrent = currentActive && currentActive.id === p.id;
                            return (
                              <div
                                key={p.id}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  fontSize: '0.82rem',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  background: isCurrent ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                                  border: isCurrent ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent'
                                }}
                              >
                                <span style={{ color: p.selesai ? '#10b981' : isCurrent ? '#38bdf8' : '#cbd5e1' }}>
                                  #{p.nomor} {p.pemainA?.nama} vs {p.pemainB?.nama}
                                </span>
                                <span style={{ fontWeight: 'bold', color: p.selesai ? '#10b981' : '#f59e0b' }}>
                                  {p.selesai ? `${p1} - ${p2} ✓` : (p.jam ? `🕒 ${p.jam}` : 'Antre')}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FriendlyMatchDetail;

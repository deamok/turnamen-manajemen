import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTurnamenById, updateTurnamen, getTurnamen, deleteTurnamen, getPemainByScope } from '../utils/storage';
import { buatPools, updateKlasemen, isPoolSelesai, getJuaraPool, buatBracket, advancePemenang, tentukanPemenang, getNamaPeserta } from '../utils/tournament';
import { useAuth } from '../contexts/AuthContext';
import PoolGroup from '../components/PoolGroup';
import EliminationBracket from '../components/EliminationBracket';
import ScoreModal from '../components/ScoreModal';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const TournamentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [turnamen, setTurnamen] = useState(null);
  const [activeTab, setActiveTab] = useState('pool');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedPool, setSelectedPool] = useState(null);
  const [matchPhase, setMatchPhase] = useState(null);
  const [selectedPoolIndex, setSelectedPoolIndex] = useState(0);
  const { currentUser, isAdmin, canEditTournament, isSuperAdmin, userPTM } = useAuth();
  const hasEditPermission = canEditTournament(turnamen);
  
  const [showRegForm, setShowRegForm] = useState(false);
  const [regData, setRegData] = useState({ nama: '', divisi: '', namaPTM: '', partnerName: '', partnerDivisi: '' });
  
  // States for Admin Manual Addition
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [allPemain, setAllPemain] = useState([]);
  const [selectedPemainIds, setSelectedPemainIds] = useState([]);

  const [editingParticipant, setEditingParticipant] = useState(null);
  const [targetPoolIndex, setTargetPoolIndex] = useState(0);

  useEffect(() => {
    if (editingParticipant) {
      if (turnamen?.tipe === 'Double') {
        setRegData({
          nama: editingParticipant.pemain1?.nama || '',
          divisi: editingParticipant.pemain1?.divisi || '',
          namaPTM: editingParticipant.namaPTM || '',
          partnerName: editingParticipant.pemain2?.nama || '',
          partnerDivisi: editingParticipant.pemain2?.divisi || ''
        });
      } else {
        setRegData({
          nama: editingParticipant.nama || '',
          divisi: editingParticipant.divisi || '',
          namaPTM: editingParticipant.namaPTM || '',
          partnerName: '',
          partnerDivisi: ''
        });
      }
    }
  }, [editingParticipant, turnamen]);

  const handleDeleteParticipant = async (participantId) => {
    if (!window.confirm("Hapus peserta ini dari turnamen? Semua riwayat pertandingan peserta ini akan dihapus.")) return;

    let updated = JSON.parse(JSON.stringify(turnamen));
    
    // Hapus dari list utama
    updated.peserta = updated.peserta.filter(p => p.id !== participantId);

    // Hapus dari pool stage jika ada
    if (updated.pools) {
      updated.pools.forEach((pool, poolIdx) => {
        const exists = pool.peserta.some(x => x.id === participantId);
        if (exists) {
          pool.peserta = pool.peserta.filter(x => x.id !== participantId);
          pool.pertandingan = pool.pertandingan.filter(m => m.peserta1?.id !== participantId && m.peserta2?.id !== participantId);
          updated.pools[poolIdx] = updateKlasemen(pool);
        }
      });
    }

    await saveTournamentUpdate(updated);
    alert("Peserta berhasil dihapus.");
  };

  const handleEditParticipantSubmit = async (e) => {
    e.preventDefault();
    if (!editingParticipant) return;

    let updated = JSON.parse(JSON.stringify(turnamen));
    const pId = editingParticipant.id;

    const updatePlayerObject = (oldObj) => {
      if (oldObj.id === pId) {
        if (updated.tipe === 'Double') {
          return {
            ...oldObj,
            pemain1: {
              ...oldObj.pemain1,
              nama: regData.nama.trim(),
              namaPTM: regData.namaPTM.trim() || 'Umum'
            },
            pemain2: {
              ...oldObj.pemain2,
              nama: regData.partnerName.trim(),
              namaPTM: regData.namaPTM.trim() || 'Umum'
            },
            namaPTM: regData.namaPTM.trim() || 'Umum'
          };
        } else {
          return {
            ...oldObj,
            nama: regData.nama.trim(),
            namaPTM: regData.namaPTM.trim() || 'Umum'
          };
        }
      }
      return oldObj;
    };

    updated.peserta = updated.peserta.map(p => updatePlayerObject(p));

    if (updated.pools) {
      updated.pools.forEach((pool, poolIdx) => {
        pool.peserta = pool.peserta.map(p => updatePlayerObject(p));
        pool.pertandingan = pool.pertandingan.map(m => {
          if (m.peserta1?.id === pId) m.peserta1 = updatePlayerObject(m.peserta1);
          if (m.peserta2?.id === pId) m.peserta2 = updatePlayerObject(m.peserta2);
          return m;
        });
        updated.pools[poolIdx] = updateKlasemen(pool);
      });
    }

    if (updated.bracket) {
      updated.bracket.rounds.forEach((round, rIdx) => {
        round.pertandingan = round.pertandingan.map(m => {
          if (m.peserta1?.id === pId) m.peserta1 = updatePlayerObject(m.peserta1);
          if (m.peserta2?.id === pId) m.peserta2 = updatePlayerObject(m.peserta2);
          return m;
        });
      });
    }

    await saveTournamentUpdate(updated);
    setEditingParticipant(null);
    alert("Data peserta berhasil diperbarui.");
  };

  const loadTurnamen = useCallback(async () => {
    try {
      const data = await getTurnamenById(id);
      if (data) {
        setTurnamen(data);
        if (data.status === 'eliminasi' || data.status === 'selesai') {
          setActiveTab('eliminasi');
        } else if (data.status === 'pendaftaran') {
          setActiveTab('pendaftaran');
        }
      }
    } catch (e) {
      console.error("Error loading tournament details:", e);
    }
  }, [id]);

  useEffect(() => {
    loadTurnamen();
  }, [loadTurnamen]);

  const saveTournamentUpdate = async (updated) => {
    try {
      await updateTurnamen(updated.id, updated);
      setTurnamen({ ...updated });
    } catch (e) {
      console.error('Error updating tournament:', e);
      alert('Gagal menyimpan: ' + e.message);
    }
  };

  const handlePoolMatchClick = (match, pool) => {
    setSelectedMatch(match);
    setSelectedPool(pool);
    setMatchPhase('pool');
  };

  const handleEliminasiMatchClick = (match) => {
    setSelectedMatch(match);
    setMatchPhase('eliminasi');
  };

  const handleScoreSave = async ({ matchId, skor, pemenang, selesai, jam, meja, tanggal }, phase, pool) => {
    if (!turnamen) return;
    let updated = JSON.parse(JSON.stringify(turnamen));
    
    const currentPhase = phase || matchPhase;
    const currentPool = pool || selectedPool;

    if (currentPhase === 'pool' && currentPool) {
      const poolIdx = updated.pools.findIndex(p => p.id === currentPool.id);
      if (poolIdx === -1) return;
      const matchIdx = updated.pools[poolIdx].pertandingan.findIndex(m => m.id === matchId);
      if (matchIdx === -1) return;

      updated.pools[poolIdx].pertandingan[matchIdx].skor = skor;
      updated.pools[poolIdx].pertandingan[matchIdx].pemenang = pemenang;
      updated.pools[poolIdx].pertandingan[matchIdx].selesai = selesai;
      updated.pools[poolIdx].pertandingan[matchIdx].jam = jam || '';
      updated.pools[poolIdx].pertandingan[matchIdx].meja = meja || '';
      updated.pools[poolIdx].pertandingan[matchIdx].tanggal = tanggal || '';
      updated.pools[poolIdx] = updateKlasemen(updated.pools[poolIdx]);

    } else if (currentPhase === 'eliminasi' && updated.bracket) {
      for (let r = 0; r < updated.bracket.rounds.length; r++) {
        const matchIdx = updated.bracket.rounds[r].pertandingan.findIndex(m => m.id === matchId);
        if (matchIdx !== -1) {
          updated.bracket.rounds[r].pertandingan[matchIdx].skor = skor;
          updated.bracket.rounds[r].pertandingan[matchIdx].pemenang = pemenang;
          updated.bracket.rounds[r].pertandingan[matchIdx].selesai = selesai;
          updated.bracket.rounds[r].pertandingan[matchIdx].jam = jam || '';
          updated.bracket.rounds[r].pertandingan[matchIdx].meja = meja || '';
          updated.bracket.rounds[r].pertandingan[matchIdx].tanggal = tanggal || '';

          if (pemenang && r < updated.bracket.rounds.length - 1) {
            updated.bracket = advancePemenang(updated.bracket, matchId, pemenang);
          }
          if (r === updated.bracket.rounds.length - 1 && selesai) {
            updated.status = 'selesai';
            const finalMatch = updated.bracket.rounds[r].pertandingan[matchIdx];
            const winner = finalMatch.peserta1?.id === pemenang ? finalMatch.peserta1 : finalMatch.peserta2;
            updated.juara = winner;
          }
          break;
        }
      }
    }

    await saveTournamentUpdate(updated);
    setSelectedMatch(null);
    setSelectedPool(null);
    setMatchPhase(null);
  };

  const handleLanjutEliminasi = async () => {
    if (!turnamen) return;
    const allDone = turnamen.pools.every(p => isPoolSelesai(p));
    if (!allDone) {
      alert('Semua pertandingan di babak Pool harus diselesaikan terlebih dahulu!');
      return;
    }

    if (window.confirm('Apakah Anda yakin ingin melanjutkan ke babak eliminasi? Skor pool tidak bisa diubah lagi.')) {
      let updated = JSON.parse(JSON.stringify(turnamen));
      const juaraList = getJuaraPool(updated.pools);
      updated.bracket = buatBracket(juaraList);
      updated.status = 'eliminasi';

      await saveTournamentUpdate(updated);
      setActiveTab('eliminasi');
    }
  };

  const handleDaftar = async () => {
    if (!currentUser) {
      alert('Silakan login terlebih dahulu untuk mendaftar.');
      return;
    }
    if (!turnamen) return;

    let updated = JSON.parse(JSON.stringify(turnamen));
    const isRegistered = updated.peserta.some(p => p.id === currentUser.uid);

    if (isRegistered) {
      if (window.confirm('Batalkan pendaftaran Anda dari turnamen ini?')) {
        updated.peserta = updated.peserta.filter(p => p.id !== currentUser.uid);
        await saveTournamentUpdate(updated);
      }
    } else {
      // Fetch user profile from Firestore to prefill
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setRegData({
            nama: userData.name || currentUser.displayName || '',
            divisi: userData.divisi || '',
            namaPTM: userData.namaPTM || '',
            partnerName: '',
            partnerDivisi: ''
          });
        } else {
          setRegData({ nama: currentUser.displayName || '', divisi: '', namaPTM: '', partnerName: '', partnerDivisi: '' });
        }
      } catch (error) {
        console.error("Gagal mengambil profil untuk prefill:", error);
        setRegData({ nama: currentUser.displayName || '', divisi: '', namaPTM: '', partnerName: '', partnerDivisi: '' });
      }
      setShowRegForm(true);
    }
  };

  const submitRegistration = async (e) => {
    e.preventDefault();
    if (!regData.nama.trim()) {
      alert('Nama wajib diisi!');
      return;
    }
    
    if (turnamen.tipe === 'Double' && !regData.partnerName.trim()) {
      alert('Nama Pasangan wajib diisi untuk turnamen Ganda (Double)!');
      return;
    }

    let updated = JSON.parse(JSON.stringify(turnamen));
    
    if (turnamen.tipe === 'Double') {
      const sumDivisi = (parseInt(regData.divisi) || 0) + (parseInt(regData.partnerDivisi) || 0);
      updated.peserta.push({
        id: currentUser.uid, // id unik untuk pasangan ini, berbasis pemain 1
        divisi: sumDivisi > 0 ? sumDivisi.toString() : '',
        pemain1: {
          id: currentUser.uid,
          nama: regData.nama.trim(),
          divisi: regData.divisi,
          namaPTM: regData.namaPTM.trim() || 'Umum'
        },
        pemain2: {
          id: 'partner-' + Date.now(),
          nama: regData.partnerName.trim(),
          divisi: regData.partnerDivisi,
          namaPTM: regData.namaPTM.trim() || 'Umum'
        }
      });
    } else {
      updated.peserta.push({
        id: currentUser.uid,
        nama: regData.nama.trim(),
        divisi: regData.divisi,
        namaPTM: regData.namaPTM.trim() || 'Umum'
      });
    }

    await saveTournamentUpdate(updated);
    setShowRegForm(false);
    alert('Pendaftaran berhasil!');
  };

  const handleOpenManualAdd = async () => {
    if (allPemain.length === 0) {
      try {
        const data = await getPemainByScope({
          isSuperAdmin,
          uid: currentUser?.uid,
          ptm: userPTM,
        });
        setAllPemain(data || []);
      } catch (e) {
        console.error('Gagal load pemain', e);
      }
    }
    setShowManualAdd(true);
  };

  const handleAddManualSubmit = async () => {
    if (selectedPemainIds.length === 0) return;
    
    const playersToAdd = allPemain.filter(p => selectedPemainIds.includes(p.id));
    let updated = JSON.parse(JSON.stringify(turnamen));
    
    const newParticipants = [];
    if (updated.tipe === 'Double') {
      if (playersToAdd.length % 2 !== 0) {
        return alert("Pilih jumlah pemain yang genap untuk dipasangkan (Double)!");
      }
      for (let i = 0; i < playersToAdd.length; i += 2) {
        const doubleParticipant = {
          id: playersToAdd[i].id + '-' + playersToAdd[i+1].id,
          divisi: (parseInt(playersToAdd[i].divisi) || 0) + (parseInt(playersToAdd[i+1].divisi) || 0),
          pemain1: playersToAdd[i],
          pemain2: playersToAdd[i+1],
          namaPTM: playersToAdd[i].namaPTM || 'Umum'
        };
        newParticipants.push(doubleParticipant);
        if (!updated.peserta.some(existing => existing.id === doubleParticipant.id)) {
          updated.peserta.push(doubleParticipant);
        }
      }
    } else {
      // Single
      for (const p of playersToAdd) {
        if (!updated.peserta.some(existing => existing.id === p.id)) {
          newParticipants.push(p);
          updated.peserta.push(p);
        }
      }
    }

    // Jika turnamen sedang berjalan di tahap pool
    if (updated.status === 'pool' && updated.pools && newParticipants.length > 0) {
      newParticipants.forEach(newP => {
        const incompletePoolIdx = updated.pools.findIndex(p => p.peserta.length < 3);

        if (incompletePoolIdx !== -1) {
          const pool = updated.pools[incompletePoolIdx];
          const meja = incompletePoolIdx % 2 === 0 ? 'Meja 1' : 'Meja 2';

          let latestTime = new Date(`${updated.jadwalMulai || new Date().toISOString().split('T')[0]}T${updated.jamMulai || '09:00'}:00`);
          updated.pools.forEach(p => {
            (p.pertandingan || []).forEach(m => {
              if (m.meja === meja && m.jam) {
                const mTime = new Date(`${m.tanggal || updated.jadwalMulai}T${m.jam}:00`);
                if (mTime > latestTime) {
                  latestTime = mTime;
                }
              }
            });
          });

          let currentMatchTime = new Date(latestTime);
          if (latestTime.getTime() > new Date(`${updated.jadwalMulai || new Date().toISOString().split('T')[0]}T${updated.jamMulai || '09:00'}:00`).getTime()) {
            currentMatchTime.setMinutes(currentMatchTime.getMinutes() + 30);
          }

          const oldPeserta = [...pool.peserta];
          pool.peserta.push(newP);
          
          pool.klasemen.push({
            pesertaId: newP.id,
            menang: 0,
            kalah: 0,
            poin: 0,
            setMenang: 0,
            setKalah: 0,
            poinMenang: 0,
            poinKalah: 0
          });

          oldPeserta.forEach(oldP => {
            const h = currentMatchTime.getHours();
            const m = currentMatchTime.getMinutes();
            const totalMins = h * 60 + m;
            if (totalMins >= 720 && totalMins < 780) {
              currentMatchTime.setHours(13, 0, 0);
            }

            const hours = String(currentMatchTime.getHours()).padStart(2, '0');
            const minutes = String(currentMatchTime.getMinutes()).padStart(2, '0');

            pool.pertandingan.push({
              id: 'match-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
              peserta1: oldP,
              peserta2: newP,
              skor: [],
              selesai: false,
              pemenang: null,
              tanggal: updated.jadwalMulai || '',
              jam: `${hours}:${minutes}`,
              meja: meja
            });

            currentMatchTime.setMinutes(currentMatchTime.getMinutes() + 30);
          });

          updated.pools[incompletePoolIdx] = updateKlasemen(pool);
        } else {
          const poolIndex = updated.pools.length;
          const newPoolName = 'Pool ' + String.fromCharCode(65 + poolIndex);
          const meja = poolIndex % 2 === 0 ? 'Meja 1' : 'Meja 2';

          const np = {
            id: 'pool-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            nama: newPoolName,
            peserta: [newP],
            pertandingan: [],
            klasemen: [{
              pesertaId: newP.id,
              menang: 0,
              kalah: 0,
              poin: 0,
              setMenang: 0,
              setKalah: 0,
              poinMenang: 0,
              poinKalah: 0
            }]
          };
          updated.pools.push(np);
        }
      });
    }
    
    await saveTournamentUpdate(updated);
    setShowManualAdd(false);
    setSelectedPemainIds([]);
  };

  const handleGeneratePools = async () => {
    if (turnamen.peserta.length < 3) {
      return alert('Minimal 3 pemain untuk membuat turnamen!');
    }
    if (window.confirm('Tutup pendaftaran dan generate Pool sekarang?')) {
      let updated = JSON.parse(JSON.stringify(turnamen));
      
      const shuffled = [...updated.peserta].sort(() => Math.random() - 0.5);
      updated.pools = buatPools(shuffled);
      
      // Auto scheduling
      const tStartDate = updated.jadwalMulai || new Date().toISOString().split('T')[0];
      const startHourMin = updated.jamMulai || '09:00';
      let tableTimes = {
        'Meja 1': new Date(`${tStartDate}T${startHourMin}:00`),
        'Meja 2': new Date(`${tStartDate}T${startHourMin}:00`)
      };

      updated.pools.forEach((pool, poolIdx) => {
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
      
      updated.status = 'pool';
      await saveTournamentUpdate(updated);
      setActiveTab('pool');
    }
  };

  const getTournamentMatches = () => {
    if (!turnamen) return [];
    const allMatches = [];
    const tStartDate = turnamen.jadwalMulai || 'Belum Ditentukan';

    // 1. Pool matches
    if (turnamen.pools) {
      turnamen.pools.forEach(pool => {
        const matchesList = pool.pertandingan || [];
        matchesList.forEach(m => {
          allMatches.push({
            ...m,
            phase: 'pool',
            poolObj: pool,
            stageName: `Pool ${pool.nama.split(' ').pop()}`,
            resolvedDate: m.tanggal || tStartDate
          });
        });
      });
    }

    // 2. Elimination matches
    if (turnamen.bracket && turnamen.bracket.rounds) {
      turnamen.bracket.rounds.forEach(round => {
        const matchesList = round.pertandingan || [];
        matchesList.forEach(m => {
          if (!m.peserta1 && !m.peserta2) return;
          allMatches.push({
            ...m,
            phase: 'eliminasi',
            stageName: round.nama,
            resolvedDate: m.tanggal || tStartDate
          });
        });
      });
    }

    return allMatches;
  };

  const formatIndonesianDate = (dateStr) => {
    if (!dateStr || dateStr === 'Belum Ditentukan') return 'Tanggal Belum Ditentukan';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  const getBracketPreview = () => {
    if (!turnamen || !turnamen.pools || turnamen.pools.length === 0) return null;
    
    const poolCount = turnamen.pools.length;
    let size = 1;
    while (size < poolCount) size *= 2;
    // Minimal bracket size adalah 2 (untuk 2 juara pool)
    if (size < 2) size = 2;
    
    const dummyParticipants = [];
    const getPoolLetter = (idx) => String.fromCharCode(65 + idx);

    for (let i = 0; i < poolCount; i++) {
      dummyParticipants.push({
        id: `preview-juara-${i}`,
        nama: `🏆 Juara Pool ${getPoolLetter(i)}`,
        namaPTM: 'Belum Ditentukan'
      });
    }

    while (dummyParticipants.length < size) {
      dummyParticipants.push(null);
    }

    const round1Matches = [];
    for (let i = 0; i < size; i += 2) {
      round1Matches.push({
        id: `preview-match-r1-${i}`,
        peserta1: dummyParticipants[i],
        peserta2: dummyParticipants[i+1],
        skor: [],
        pemenang: null,
        selesai: false
      });
    }

    const rounds = [];
    let currentMatches = round1Matches;
    let roundSize = currentMatches.length;

    while (roundSize >= 1) {
      let namaRound = '';
      if (roundSize === 1) namaRound = 'Final';
      else if (roundSize === 2) namaRound = 'Semi Final';
      else if (roundSize === 4) namaRound = 'Perempat Final';
      else namaRound = `Babak ${roundSize * 2} Besar`;

      rounds.push({
        nama: namaRound,
        pertandingan: currentMatches
      });

      if (roundSize === 1) break;

      const nextMatches = [];
      for (let i = 0; i < roundSize; i += 2) {
        nextMatches.push({
          id: `preview-match-next-${rounds.length}-${i}`,
          peserta1: null,
          peserta2: null,
          skor: [],
          pemenang: null,
          selesai: false
        });
      }
      currentMatches = nextMatches;
      roundSize = currentMatches.length;
    }

    return { rounds };
  };

  const handleDeleteTurnamen = async () => {
    if (window.confirm('Hapus turnamen ini? Data tidak bisa dikembalikan.')) {
      try {
        await deleteTurnamen(id);
        navigate('/');
      } catch (e) {
        console.error("Error deleting tournament:", e);
      }
    }
  };

  if (!turnamen) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '50px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '15px' }}>⏳</div>
        <h2>Memuat turnamen...</h2>
      </div>
    );
  }

  const allPoolsComplete = turnamen.pools?.every(p => isPoolSelesai(p));

  const statusColors = {
    pendaftaran: 'badge-primary',
    pool: 'badge-primary',
    eliminasi: 'badge-warning',
    selesai: 'badge-success'
  };

  const statusLabels = {
    pendaftaran: 'Pendaftaran Dibuka',
    pool: 'Babak Pool',
    eliminasi: 'Babak Eliminasi',
    selesai: 'Selesai'
  };

  const formatDateWithDay = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  const formatDateRangeWithDay = (mulai, selesai) => {
    if (!mulai && !selesai) return '';
    if (mulai && selesai && mulai !== selesai) {
      return `${formatDateWithDay(mulai)} s/d ${formatDateWithDay(selesai)}`;
    }
    return formatDateWithDay(mulai || selesai);
  };

  const getActiveEliminasiRoundName = () => {
    if (!turnamen || !turnamen.bracket || !turnamen.bracket.rounds || turnamen.bracket.rounds.length === 0) {
      return 'Babak Eliminasi';
    }
    const activeRound = turnamen.bracket.rounds.find(round => {
      const matches = round.pertandingan || [];
      return matches.some(m => !m.selesai && (m.peserta1 || m.peserta2));
    });
    if (activeRound) return activeRound.nama;
    
    const lastRound = turnamen.bracket.rounds[turnamen.bracket.rounds.length - 1];
    return lastRound ? lastRound.nama : 'Babak Eliminasi';
  };

  return (
    <div className="page-container fade-in">
      <div className="card" style={{ marginBottom: '25px', padding: '25px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <h1 style={{ 
              margin: '0 0 12px 0', 
              fontFamily: "'Barlow', 'Inter', sans-serif", 
              fontWeight: '900', 
              textTransform: 'uppercase', 
              letterSpacing: '-0.02em',
              fontSize: '2.1rem',
              color: 'var(--text-primary)',
              lineHeight: '1.1'
            }}>
              {turnamen.nama}
            </h1>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '15px' }}>
              <span className={`badge ${statusColors[turnamen.status]}`}>
                {turnamen.status === 'eliminasi' ? getActiveEliminasiRoundName() : statusLabels[turnamen.status]}
              </span>
              <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: 'white' }}>
                {turnamen.tipe} {turnamen.divisi && `• Divisi ${turnamen.divisi}`}
              </span>
              {(turnamen.jadwalMulai || turnamen.jadwalSelesai) && (
                <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: 'white' }}>
                  📅 {formatDateRangeWithDay(turnamen.jadwalMulai, turnamen.jadwalSelesai)}
                  {turnamen.jamMulai && ` (${turnamen.jamMulai}${turnamen.jamSelesai ? ` - ${turnamen.jamSelesai}` : ''})`}
                </span>
              )}
              {turnamen.tanggalRegistrasi && turnamen.status === 'pendaftaran' && (
                <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--color-warning)' }}>
                  ⏳ Pendaftaran s/d: {formatDateWithDay(turnamen.tanggalRegistrasi)}
                </span>
              )}
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '25px', 
              paddingTop: '15px', 
              borderTop: '1px solid rgba(255,255,255,0.05)',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Jumlah Peserta</span>
                <strong style={{ fontSize: '1.05rem', color: 'var(--color-primary)', fontWeight: '700' }}>
                  👥 {turnamen.peserta?.length || 0} {turnamen.tipe === 'Double' ? 'Pasang' : 'Pemain'}
                </strong>
              </div>

              {(() => {
                const matches = getTournamentMatches();
                const totalMatches = matches.length;
                const playedMatches = matches.filter(m => m.selesai).length;
                const remainingMatches = totalMatches - playedMatches;

                return (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Total Game</span>
                      <strong style={{ fontSize: '1.05rem', color: '#fff', fontWeight: '700' }}>
                        📊 {totalMatches} Game
                      </strong>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Sudah Dimainkan</span>
                      <strong style={{ fontSize: '1.05rem', color: 'var(--color-success)', fontWeight: '700' }}>
                        ✅ {playedMatches} Game
                      </strong>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Sisa Game</span>
                      <strong style={{ fontSize: '1.05rem', color: 'var(--color-warning)', fontWeight: '700' }}>
                        ⏳ {remainingMatches} Game
                      </strong>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
          {hasEditPermission && <button className="btn btn-sm btn-danger" onClick={handleDeleteTurnamen} style={{ alignSelf: 'flex-start' }}>🗑️ Hapus</button>}
        </div>

        {turnamen.status === 'selesai' && turnamen.juara && (
          <div style={{
            marginTop: '20px',
            padding: '20px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.15))',
            textAlign: 'center',
            border: '1px solid rgba(16,185,129,0.3)'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '5px' }}>🏆</div>
            <h2 style={{ color: 'var(--color-success)', margin: '0 0 5px' }}>JUARA TURNAMEN</h2>
            <h3 style={{ margin: 0, fontSize: '1.3rem' }}>{getNamaPeserta(turnamen.juara)}</h3>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', overflowX: 'auto' }}>
        <button 
          className={`btn ${activeTab === 'pendaftaran' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('pendaftaran')}
          style={{ borderRadius: '0', background: 'transparent', color: activeTab === 'pendaftaran' ? 'var(--color-primary)' : 'var(--color-text)', borderBottom: activeTab === 'pendaftaran' ? '2px solid var(--color-primary)' : 'none', padding: '10px 15px', whiteSpace: 'nowrap' }}
        >
          👥 Peserta
        </button>
        <button 
          className={`btn ${activeTab === 'pool' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('pool')}
          style={{ borderRadius: '0', background: 'transparent', color: activeTab === 'pool' ? 'var(--color-primary)' : 'var(--color-text)', borderBottom: activeTab === 'pool' ? '2px solid var(--color-primary)' : 'none', padding: '10px 15px', whiteSpace: 'nowrap' }}
          disabled={turnamen.status === 'pendaftaran'}
        >
          📊 Pool
        </button>
        <button 
          className={`btn ${activeTab === 'jadwal_turnamen' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('jadwal_turnamen')}
          style={{ borderRadius: '0', background: 'transparent', color: activeTab === 'jadwal_turnamen' ? 'var(--color-primary)' : 'var(--color-text)', borderBottom: activeTab === 'jadwal_turnamen' ? '2px solid var(--color-primary)' : 'none', padding: '10px 15px', whiteSpace: 'nowrap' }}
          disabled={turnamen.status === 'pendaftaran'}
        >
          📅 Jadwal
        </button>
        <button 
          className={`btn ${activeTab === 'live' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('live')}
          style={{ borderRadius: '0', background: 'transparent', color: activeTab === 'live' ? 'var(--color-primary)' : 'var(--color-text)', borderBottom: activeTab === 'live' ? '2px solid var(--color-primary)' : 'none', padding: '10px 15px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          disabled={turnamen.status === 'pendaftaran'}
        >
          <svg 
            viewBox="0 0 100 100" 
            width="16" 
            height="16" 
            fill="currentColor"
          >
            <path d="M10 90a5 5 0 0 1 5-5h38a5 5 0 0 1 5 5z" />
            <path d="M22 85l18-28 8 3-18 25z" />
            <path d="M15 10c-5 30 10 65 80 65-35 0-70-25-80-65z" />
            <line x1="35" y1="32" x2="78" y2="10" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
            <line x1="50" y1="47" x2="78" y2="10" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
            <line x1="70" y1="62" x2="78" y2="10" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
            <circle cx="78" cy="10" r="9" />
          </svg>
          Live
        </button>
        <button
          className={`btn ${activeTab === 'eliminasi' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('eliminasi')}
          style={{ borderRadius: '0', background: 'transparent', color: activeTab === 'eliminasi' ? 'var(--color-primary)' : 'var(--color-text)', borderBottom: activeTab === 'eliminasi' ? '2px solid var(--color-primary)' : 'none', padding: '10px 15px', whiteSpace: 'nowrap' }}
          disabled={turnamen.status === 'pendaftaran'}
        >
          ⚔️ Skema Pertandingan
        </button>
      </div>

      <div className="tab-content">
      {activeTab === 'pendaftaran' && (
        <div className="card fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px', paddingLeft: '10px' }}>
            <h2>Daftar Peserta ({turnamen.peserta?.length || 0})</h2>
            
            {turnamen.status === 'eliminasi' || turnamen.status === 'selesai' ? (
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '5px' }}>
                🔒 Daftar peserta dikunci (Babak Gugur / Selesai)
              </span>
            ) : hasEditPermission ? (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={handleOpenManualAdd}>
                  + Tambah Manual
                </button>
                {turnamen.status === 'pendaftaran' && (
                  <button className="btn btn-primary" onClick={handleGeneratePools}>
                    Tutup Pendaftaran & Generate Pools
                  </button>
                )}
              </div>
            ) : (
              turnamen.status === 'pendaftaran' && (
                <button 
                  className={`btn ${turnamen.peserta?.some(p => p.id === currentUser?.uid) ? 'btn-danger' : 'btn-primary'}`} 
                  onClick={handleDaftar}
                >
                  {turnamen.peserta?.some(p => p.id === currentUser?.uid) ? 'Batalkan Pendaftaran' : 'Daftar Sekarang'}
                </button>
              )
            )}
          </div>
          
          {showRegForm && (
            <div className="card fade-in" style={{ marginBottom: '20px', border: '1px solid var(--color-primary)' }}>
              <h3 style={{ marginBottom: '15px' }}>Formulir Pendaftaran</h3>
              <form onSubmit={submitRegistration}>
                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label className="form-label">{turnamen.tipe === 'Double' ? 'Nama Anda (Pemain 1)' : 'Nama Lengkap'}</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={regData.nama} 
                    onChange={e => setRegData({...regData, nama: e.target.value})} 
                    required 
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label className="form-label">{turnamen.tipe === 'Double' ? 'Divisi Anda (Pemain 1)' : 'Divisi'}</label>
                  <select 
                    className="form-input" 
                    value={regData.divisi} 
                    onChange={e => setRegData({...regData, divisi: e.target.value})} 
                  >
                    <option value="">-- Pilih Divisi --</option>
                    <option value="1">Divisi 1</option>
                    <option value="2">Divisi 2</option>
                    <option value="3">Divisi 3</option>
                    <option value="4">Divisi 4</option>
                    <option value="5">Divisi 5</option>
                  </select>
                </div>
                {turnamen.tipe === 'Double' && (
                  <>
                    <div className="form-group" style={{ marginBottom: '15px' }}>
                      <label className="form-label">Nama Pasangan (Pemain 2)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={regData.partnerName} 
                        onChange={e => setRegData({...regData, partnerName: e.target.value})} 
                        required 
                        placeholder="Masukkan nama partner Anda"
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: '15px' }}>
                      <label className="form-label">Divisi Pasangan (Pemain 2)</label>
                      <select 
                        className="form-input" 
                        value={regData.partnerDivisi} 
                        onChange={e => setRegData({...regData, partnerDivisi: e.target.value})} 
                      >
                        <option value="">-- Pilih Divisi --</option>
                        <option value="1">Divisi 1</option>
                        <option value="2">Divisi 2</option>
                        <option value="3">Divisi 3</option>
                        <option value="4">Divisi 4</option>
                        <option value="5">Divisi 5</option>
                      </select>
                    </div>
                  </>
                )}
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label">Nama PTM / Klub (Opsional)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={regData.namaPTM} 
                    onChange={e => setRegData({...regData, namaPTM: e.target.value})} 
                    placeholder="Contoh: PTM Bintang"
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary">Konfirmasi Pendaftaran</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowRegForm(false)}>Batal</button>
                </div>
              </form>
            </div>
          )}

          {showManualAdd && hasEditPermission && (
            <div className="card fade-in" style={{ marginBottom: '20px', border: '1px solid var(--color-primary)' }}>
              <h3 style={{ marginBottom: '15px' }}>Tambah Peserta Manual</h3>
              
              {turnamen.status === 'pool' && turnamen.pools && (
                <div style={{ marginBottom: '15px', padding: '10px 12px', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                  ℹ️ Pemain baru yang ditambahkan akan otomatis dimasukkan ke pool baru (maksimal 3 pemain per pool).
                </div>
              )}

              <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '15px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                {allPemain.map(p => {
                  const isAlreadyIn = turnamen.tipe === 'Single' 
                    ? turnamen.peserta.some(ex => ex.id === p.id)
                    : false; // Untuk double biarkan dipilih, nanti dipasangkan

                  return (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', padding: '8px', background: 'var(--color-bg)', borderRadius: '6px', opacity: isAlreadyIn ? 0.5 : 1 }}>
                      <input 
                        type="checkbox" 
                        disabled={isAlreadyIn}
                        checked={selectedPemainIds.includes(p.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedPemainIds([...selectedPemainIds, p.id]);
                          else setSelectedPemainIds(selectedPemainIds.filter(id => id !== p.id));
                        }}
                        style={{ marginRight: '10px' }}
                      />
                      {p.nama} {isAlreadyIn && '(Sudah)'}
                    </label>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn btn-primary" onClick={handleAddManualSubmit}>
                  Tambahkan {selectedPemainIds.length} Pemain
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowManualAdd(false)}>Tutup</button>
              </div>
            </div>
          )}
          
          {turnamen.peserta?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-secondary)' }}>
              Belum ada peserta yang mendaftar.
            </div>
          ) : (
            <div className="participants-table-wrapper">
              <table className="participants-table">
                <thead>
                  <tr>
                    <th style={{ width: '60px', paddingLeft: '20px' }}>No</th>
                    <th style={{ width: '35%' }}>Nama Peserta</th>
                    <th style={{ width: '25%' }}>Divisi</th>
                    <th style={{ width: '25%' }}>PTM</th>
                    {hasEditPermission && turnamen.status !== 'eliminasi' && turnamen.status !== 'selesai' && <th style={{ width: '15%', textAlign: 'right' }}>Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {turnamen.peserta?.map((p, i) => (
                    <tr key={p.id}>
                      <td style={{ paddingLeft: '20px', paddingRight: '0' }}>{i + 1}.</td>
                      <td style={{ paddingLeft: '0' }}>
                        <div className="participant-name-cell">
                          <span className="participant-name-main">
                            {turnamen.tipe === 'Double' ? `${p.pemain1?.nama} & ${p.pemain2?.nama}` : p.nama}
                          </span>
                        </div>
                      </td>
                      <td>{p.divisi ? `Divisi ${p.divisi}` : '—'}</td>
                      <td>
                        <span className="badge">{turnamen.tipe === 'Double' ? p.pemain1?.namaPTM : p.namaPTM}</span>
                      </td>
                      {hasEditPermission && turnamen.status !== 'eliminasi' && turnamen.status !== 'selesai' && (
                        <td>
                          <div className="participant-actions">
                            <button 
                              className="btn btn-secondary btn-sm" 
                              onClick={() => setEditingParticipant(p)}
                            >
                              ✏️ Edit
                            </button>
                            <button 
                              className="btn btn-danger btn-sm" 
                              onClick={() => handleDeleteParticipant(p.id)}
                              style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger-color)' }}
                            >
                              🗑️ Hapus
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit Participant Modal Overlay */}
      {editingParticipant && (
        <div className="modal-overlay" onClick={() => setEditingParticipant(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>✏️ Edit Data Peserta</h3>
            </div>
            <form onSubmit={handleEditParticipantSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label">{turnamen.tipe === 'Double' ? 'Nama Pemain 1' : 'Nama Lengkap'}</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={regData.nama} 
                    onChange={e => setRegData({...regData, nama: e.target.value})} 
                    required 
                  />
                </div>
                {turnamen.tipe === 'Double' && (
                  <div className="form-group">
                    <label className="form-label">Nama Pemain 2</label>
                    <input 
                      type="text" 
                      className="form-input"
                      value={regData.partnerName} 
                      onChange={e => setRegData({...regData, partnerName: e.target.value})} 
                      required 
                    />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Nama PTM / Klub</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={regData.namaPTM} 
                    onChange={e => setRegData({...regData, namaPTM: e.target.value})} 
                    placeholder="Contoh: PTM Bintang"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingParticipant(null)}>Batal</button>
                <button type="submit" className="btn btn-primary">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'live' && (
        <div className="fade-in">
          {(() => {
            const matches = getTournamentMatches();
            const unfinished = matches.filter(m => !m.selesai && m.peserta1 && m.peserta2);
            
            const mejaGroups = {
              'Meja 1': [],
              'Meja 2': []
            };
            
            unfinished.forEach(m => {
              const mejaKey = m.meja === 'Meja 2' ? 'Meja 2' : 'Meja 1';
              mejaGroups[mejaKey].push(m);
            });

            Object.keys(mejaGroups).forEach(meja => {
              mejaGroups[meja].sort((a, b) => {
                if (!a.jam) return -1;
                if (!b.jam) return 1;
                return a.jam.localeCompare(b.jam);
              });
            });

            const liveMatches = [];
            const queueMatches = [];

            Object.keys(mejaGroups).forEach(meja => {
              const group = mejaGroups[meja];
              if (group.length > 0) {
                liveMatches.push({
                  ...group[0],
                  mejaName: meja
                });
                for (let i = 1; i < group.length; i++) {
                  queueMatches.push({
                    ...group[i],
                    mejaName: meja
                  });
                }
              }
            });

            if (liveMatches.length === 0 && queueMatches.length === 0) {
              return (
                <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🎉</div>
                  <h3>Tidak ada pertandingan aktif</h3>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                    Semua pertandingan telah selesai atau belum dimulai.
                  </p>
                </div>
              );
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                <div>
                  <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="pulse-dot" style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></span>
                    Sedang Bertanding (LIVE)
                  </h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                    {['Meja 1', 'Meja 2'].map(mejaName => {
                      const match = liveMatches.find(m => m.mejaName === mejaName);
                      
                      if (!match) {
                        return (
                          <div 
                            key={mejaName} 
                            className="card" 
                            style={{ 
                              padding: '30px', 
                              textAlign: 'center', 
                              color: 'var(--color-text-secondary)',
                              background: 'rgba(255,255,255,0.01)',
                              border: '1px dashed var(--border-light)',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              minHeight: '200px'
                            }}
                          >
                            <h4 style={{ color: 'var(--color-primary)', margin: '0 0 10px 0' }}>{mejaName}</h4>
                            <p style={{ fontSize: '0.9rem', margin: 0 }}>Meja Kosong / Istirahat</p>
                          </div>
                        );
                      }

                      const p1Name = getNamaPeserta(match.peserta1);
                      const p2Name = getNamaPeserta(match.peserta2);
                      const currentSetIdx = match.skor ? match.skor.length : 0;

                      return (
                        <div 
                          key={mejaName} 
                          className="card" 
                          style={{ 
                            padding: '20px', 
                            background: 'linear-gradient(145deg, rgba(23, 80, 11, 0.17), rgba(0, 0, 0, 0.43))',
                            border: '1px solid rgba(6,182,212,0.2)',
                            boxShadow: '0 8px 32px 0 rgba(6,182,212,0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            minHeight: '220px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <span className="badge badge-warning" style={{ fontWeight: 'bold', fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                              ⚡ {mejaName}
                            </span>
                            <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                              {match.stageName} • {match.jam || '-'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', margin: '10px 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '1.05rem', fontWeight: '600', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                👤 {p1Name}
                              </span>
                              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                                {match.skor && match.skor[currentSetIdx - 1] ? match.skor[currentSetIdx - 1][0] : '0'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '1.05rem', fontWeight: '600', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                👤 {p2Name}
                              </span>
                              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                                {match.skor && match.skor[currentSetIdx - 1] ? match.skor[currentSetIdx - 1][1] : '0'}
                              </span>
                            </div>
                          </div>

                          {match.skor && match.skor.length > 0 && (
                            <div style={{ 
                              fontSize: '0.8rem', 
                              color: 'var(--color-text-secondary)', 
                              borderTop: '1px solid rgba(255,255,255,0.05)', 
                              paddingTop: '10px', 
                              marginTop: '10px',
                              display: 'flex',
                              gap: '10px'
                            }}>
                              <span>Set sebelumnya:</span>
                              {match.skor.map((s, idx) => (
                                <span key={idx} style={{ fontWeight: '500', background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: '3px' }}>
                                  {s[0]}-{s[1]}
                                </span>
                              ))}
                            </div>
                          )}

                          {hasEditPermission && (
                            <div style={{ marginTop: '15px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                              <button 
                                className="btn btn-sm btn-primary"
                                onClick={() => {
                                  if (match.phase === 'pool') {
                                    handlePoolMatchClick(match, match.poolObj);
                                  } else {
                                    handleEliminasiMatchClick(match);
                                  }
                                }}
                              >
                                ✍️ Input Skor / Selesaikan
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {queueMatches.length > 0 && (
                  <div>
                    <h3 style={{ marginBottom: '15px' }}>Antrean Pertandingan Berikutnya</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {queueMatches.map((match, idx) => {
                        const p1Name = getNamaPeserta(match.peserta1);
                        const p2Name = getNamaPeserta(match.peserta2);
                        return (
                          <div 
                            key={match.id}
                            className="card"
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between', 
                              padding: '10px 15px',
                              background: 'rgba(255,255,255,0.01)',
                              border: '1px solid var(--border-light)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--warning-color)', minWidth: '60px' }}>
                                ⏰ {match.jam || '-'}
                              </span>
                              <span className="badge" style={{ minWidth: '65px', textAlign: 'center' }}>{match.mejaName}</span>
                              <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>
                                {p1Name} <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', margin: '0 8px' }}>vs</span> {p2Name}
                              </span>
                            </div>
                            <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>{match.stageName}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {activeTab === 'jadwal_turnamen' && (
        <div className="fade-in">
          {(() => {
            const matches = getTournamentMatches();
            
            const grouped = {};
            matches.forEach(m => {
              if (!grouped[m.resolvedDate]) grouped[m.resolvedDate] = [];
              grouped[m.resolvedDate].push(m);
            });

            const sortedDates = Object.keys(grouped).sort((a, b) => {
              if (a === 'Belum Ditentukan') return 1;
              if (b === 'Belum Ditentukan') return -1;
              return new Date(b) - new Date(a);
            });

            if (matches.length === 0) {
              return (
                <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📅</div>
                  <h3>Jadwal belum tersedia</h3>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                    Jadwal akan terbuat otomatis setelah pendaftaran ditutup dan Pool di-generate.
                  </p>
                </div>
              );
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                {sortedDates.map(date => {
                  const dayMatches = grouped[date].sort((a, b) => {
                    if (!a.jam) return -1;
                    if (!b.jam) return 1;
                    return a.jam.localeCompare(b.jam);
                  });

                  return (
                    <div key={date}>
                      <h3 style={{ 
                        fontSize: '1.2rem', 
                        marginBottom: '15px', 
                        color: 'var(--primary-color)',
                        borderBottom: '1px solid rgba(0,200,255,0.2)',
                        paddingBottom: '5px'
                      }}>
                        📅 {formatIndonesianDate(date)}
                      </h3>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {dayMatches.map(match => {
                          const isFinished = match.selesai;
                          const p1Name = match.peserta1 ? getNamaPeserta(match.peserta1) : (match.peserta2 ? 'BYE' : 'Menunggu...');
                          const p2Name = match.peserta2 ? getNamaPeserta(match.peserta2) : (match.peserta1 ? 'BYE' : 'Menunggu...');
                          const p1Winner = isFinished && match.pemenang === match.peserta1?.id;
                          const p2Winner = isFinished && match.pemenang === match.peserta2?.id;

                          let setsWon1 = 0, setsWon2 = 0;
                          if (isFinished && match.skor) {
                            match.skor.forEach(s => {
                              if (s[0] > s[1]) setsWon1++;
                              else if (s[1] > s[0]) setsWon2++;
                            });
                          }

                          return (
                            <div 
                              key={match.id}
                              className="card"
                              style={{ 
                                display: 'flex', 
                                flexWrap: 'wrap', 
                                alignItems: 'center', 
                                padding: '12px 20px', 
                                gap: '15px',
                                background: 'rgba(255,255,255,0.01)',
                                border: '1px solid var(--border-light)'
                              }}
                            >
                              <div style={{ minWidth: '100px' }}>
                                {(match.jam || match.meja) ? (
                                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--warning-color)' }}>
                                    ⏰ {match.jam || '-'} <br/> 🏓 {match.meja || '-'}
                                  </div>
                                ) : (
                                  <span className="badge">Belum Diatur</span>
                                )}
                              </div>

                              <div style={{ flex: 1, minWidth: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                <div style={{ flex: 1, textAlign: 'right' }}>
                                  <span style={{ fontWeight: p1Winner ? 'bold' : 'normal', color: p1Winner ? 'var(--color-success)' : 'inherit', fontSize: '0.9rem' }}>
                                    {p1Name}
                                  </span>
                                </div>
                                <div style={{ 
                                  fontFamily: 'var(--font-mono)', 
                                  fontWeight: 'bold', 
                                  fontSize: isFinished && (!match.peserta1 || !match.peserta2) ? '0.75rem' : '0.95rem',
                                  padding: '4px 10px',
                                  background: 'rgba(0,0,0,0.2)',
                                  borderRadius: '4px',
                                  minWidth: isFinished && (!match.peserta1 || !match.peserta2) ? '90px' : '55px',
                                  textAlign: 'center'
                                }}>
                                  {isFinished ? (
                                    (!match.peserta1 || !match.peserta2) ? (
                                      <span style={{ color: 'var(--color-success)', fontStyle: 'italic' }}>MENANG BYE</span>
                                    ) : (
                                      `${setsWon1} - ${setsWon2}`
                                    )
                                  ) : 'VS'}
                                </div>
                                <div style={{ flex: 1, textAlign: 'left' }}>
                                  <span style={{ fontWeight: p2Winner ? 'bold' : 'normal', color: p2Winner ? 'var(--color-success)' : 'inherit', fontSize: '0.9rem' }}>
                                    {p2Name}
                                  </span>
                                </div>
                              </div>

                              <div style={{ minWidth: '180px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                                <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>{match.stageName}</span>
                                {hasEditPermission && (
                                  <button 
                                    className="btn btn-sm btn-primary"
                                    onClick={() => {
                                      if (match.phase === 'pool') {
                                        handlePoolMatchClick(match, match.poolObj);
                                      } else {
                                        handleEliminasiMatchClick(match);
                                      }
                                    }}
                                  >
                                    ✏️ Skor
                                  </button>
                                )}
                              </div>

                              {isFinished && match.skor && match.skor.length > 0 && (
                                <div style={{ width: '100%', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '6px', marginTop: '2px' }}>
                                  Skor Set: {match.skor.map((s, idx) => `Set ${idx+1}: ${s[0]}-${s[1]}`).join(' | ')}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {activeTab === 'pool' && (
            <div className="fade-in">
              {turnamen.pools && turnamen.pools.length > 0 && (
                <>
                  <div className="card" style={{ marginBottom: '20px', padding: '15px' }}>
                    <h3 style={{ marginBottom: '15px' }}>Pilih Pool</h3>
                    <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
                      {turnamen.pools.map((pool, idx) => (
                        <button
                          key={pool.id}
                          className={`btn ${selectedPoolIndex === idx ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setSelectedPoolIndex(idx)}
                          style={{ minWidth: '120px', display: 'flex', flexDirection: 'column', padding: '10px' }}
                        >
                          <span>{pool.nama}</span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>({pool.peserta.length} pemain)</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <PoolGroup
                    pool={turnamen.pools[selectedPoolIndex]}
                    onInputSkor={handlePoolMatchClick}
                    tipe={turnamen.tipe}
                    isAdmin={hasEditPermission}
                  />
                </>
              )}

              {hasEditPermission && turnamen.status === 'pool' && allPoolsComplete && (
                <div style={{ textAlign: 'center', marginTop: '25px', padding: '20px' }}>
                  <p style={{ marginBottom: '15px', fontSize: '1.1rem', color: 'var(--color-success)' }}>
                    ✅ Semua pertandingan pool telah selesai!
                  </p>
                  <button className="btn btn-success" onClick={handleLanjutEliminasi} style={{ fontSize: '1.1rem', padding: '12px 30px' }}>
                    ⚔️ Lanjut ke Babak Eliminasi
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Eliminasi Tab */}
          {activeTab === 'eliminasi' && (
            <div className="fade-in">
              {turnamen.bracket ? (
                <EliminationBracket
                  bracket={turnamen.bracket}
                  onInputSkor={handleEliminasiMatchClick}
                  tipe={turnamen.tipe}
                  isAdmin={hasEditPermission}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{
                    padding: '12px 20px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.1), rgba(249, 115, 22, 0.1))',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    color: 'var(--color-warning)',
                    fontSize: '0.9rem',
                    textAlign: 'center'
                  }}>
                    💡 <strong>Preview Bagan Pertandingan:</strong> Bagan ini adalah draf bagan babak gugur. Nama peserta akan terisi otomatis setelah seluruh pertandingan babak Pool selesai.
                  </div>
                  <EliminationBracket
                    bracket={getBracketPreview()}
                    onInputSkor={null}
                    tipe={turnamen.tipe}
                    isAdmin={false}
                  />
                </div>
              )}
            </div>
          )}
        </div>

      {/* Score Modal */}
      {hasEditPermission && selectedMatch && (
        <ScoreModal
          match={selectedMatch}
          isOpen={selectedMatch !== null}
          onClose={() => { setSelectedMatch(null); setSelectedPool(null); setMatchPhase(null); }}
          onSave={(payload) => handleScoreSave(payload, matchPhase, selectedPool)}
          tipe={turnamen.tipe}
          format="bo5"
        />
      )}
    </div>
  );
};

export default TournamentDetail;

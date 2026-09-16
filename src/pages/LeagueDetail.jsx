import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getLigaById, updateLiga, deleteLiga, getPemain, syncLeaguePlayerToMember } from '../utils/storage';
import { hitungKlasemenLiga, calculateLeagueStats } from '../utils/league';
import { tentukanPemenang } from '../utils/tournament';
import { useAuth } from '../contexts/AuthContext';
import { formatTanggal, formatRentangTanggal, generateId, compressImage, parseMatchScore } from '../utils/helpers';

const badgeColors = {
  '1': 'badge-danger',
  '2': 'badge-warning',
  '3': 'badge-primary',
  '4': 'badge-success',
  '5': 'badge-secondary',
  '6': ''
};

const KARET_OPTIONS = [
  'Normal',
  'Anti Spin',
  'Bintik',
  'Bintik Serang'
];

const LeagueDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, isSuperAdmin } = useAuth();

  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('klasemen'); // 'klasemen' | 'peserta' | 'jadwal' | 'statistik' | 'pengaturan'
  const [selectedPekan, setSelectedPekan] = useState('semua');

  // Score Modal State (Hasil Set)
  const [activeMatch, setActiveMatch] = useState(null);
  const [activePekan, setActivePekan] = useState(null);
  const [modalSet1, setModalSet1] = useState('');
  const [modalSet2, setModalSet2] = useState('');
  const [modalMeja, setModalMeja] = useState('Meja 1');
  const [modalJam, setModalJam] = useState('09:00');
  const [modalTanggal, setModalTanggal] = useState('');
  const [modalWasitId, setModalWasitId] = useState('');
  const [modalPeserta1Id, setModalPeserta1Id] = useState('');
  const [modalPeserta2Id, setModalPeserta2Id] = useState('');
  const [modalFotoBukti, setModalFotoBukti] = useState('');
  const [isCompressingFoto, setIsCompressingFoto] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [showScoreModal, setShowScoreModal] = useState(false);

  // Quick Match Input Card State (Admin)
  const [inputPekanId, setInputPekanId] = useState('');
  const [inputTanggal, setInputTanggal] = useState(() => new Date().toISOString().split('T')[0]);
  const [inputJam, setInputJam] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [inputMeja, setInputMeja] = useState('Meja 1');
  const [inputPeserta1Id, setInputPeserta1Id] = useState('');
  const [inputPeserta2Id, setInputPeserta2Id] = useState('');
  const [inputWasitId, setInputWasitId] = useState('');
  const [inputSet1, setInputSet1] = useState('');
  const [inputSet2, setInputSet2] = useState('');
  const [inputFotoBukti, setInputFotoBukti] = useState('');
  const [isCompressingInputFoto, setIsCompressingInputFoto] = useState(false);

  // Filter display for draft matches (only active + 1 new card by default)
  const [showAllDraftMatches, setShowAllDraftMatches] = useState({});
  const [extraSlotsCount, setExtraSlotsCount] = useState({});

  // Peserta Management State (matching Member management)
  const [filterPesertaDivisi, setFilterPesertaDivisi] = useState('Semua');
  const [filterPesertaPTM, setFilterPesertaPTM] = useState('Semua');
  const [searchPeserta, setSearchPeserta] = useState('');
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [showEditPlayerModal, setShowEditPlayerModal] = useState(false);
  const [playerToEdit, setPlayerToEdit] = useState(null);
  const [masterPemainList, setMasterPemainList] = useState([]);
  const [addMode, setAddMode] = useState('master'); // 'master' | 'custom'
  const [selectedMasterPlayerId, setSelectedMasterPlayerId] = useState('');
  const [formPlayerNama, setFormPlayerNama] = useState('');
  const [formPlayerNoHP, setFormPlayerNoHP] = useState('');
  const [formPlayerDivisi, setFormPlayerDivisi] = useState('1');
  const [formPlayerPTM, setFormPlayerPTM] = useState('');
  const [formPlayerKaretFH, setFormPlayerKaretFH] = useState('');
  const [formPlayerKaretBH, setFormPlayerKaretBH] = useState('');

  // Digital Scoreboard Fullscreen
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [liveP1Score, setLiveP1Score] = useState(0);
  const [liveP2Score, setLiveP2Score] = useState(0);
  const [liveP1Sets, setLiveP1Sets] = useState(0);
  const [liveP2Sets, setLiveP2Sets] = useState(0);
  const [liveHistory, setLiveHistory] = useState([]);
  const [servingPlayer, setServingPlayer] = useState(1); // 1 or 2

  const loadLeague = async () => {
    try {
      const data = await getLigaById(id);
      if (data) {
        // Auto-sync members with member database
        const allMembers = await getPemain();
        setMasterPemainList(allMembers || []);

        let leaguePeserta = [...(data.peserta || [])];
        let needUpdate = false;

        // Sync existing participant details from members database if updated in member
        leaguePeserta = leaguePeserta.map(p => {
          const m = allMembers.find(mem => 
            (mem.id && p.id && mem.id === p.id) || 
            (mem.nama && p.nama && mem.nama.trim().toLowerCase() === p.nama.trim().toLowerCase())
          );
          if (m) {
            const mergedP = {
              ...p,
              id: p.id || m.id,
              nama: m.nama || p.nama,
              noHP: m.noHP || p.noHP || '',
              divisi: String(m.divisi || p.divisi || '1'),
              namaPTM: m.namaPTM || p.namaPTM || 'Klub',
              karetForehand: m.karetForehand || p.karetForehand || '',
              karetBackhand: m.karetBackhand || p.karetBackhand || '',
              pts: m.pts || p.pts || 0,
              ptsTotal: m.ptsTotal !== undefined ? m.ptsTotal : (m.pts || 0),
              ptsLiga: m.ptsLiga || 0,
              ptsTurnamen: m.ptsTurnamen || 0,
              ikutLiga: true
            };
            if (
              p.noHP !== mergedP.noHP ||
              p.divisi !== mergedP.divisi ||
              p.namaPTM !== mergedP.namaPTM ||
              p.karetForehand !== mergedP.karetForehand ||
              p.karetBackhand !== mergedP.karetBackhand ||
              p.nama !== mergedP.nama
            ) {
              needUpdate = true;
            }
            return mergedP;
          }
          return p;
        });

        // Add any member with ikutLiga = true not yet in league
        allMembers.filter(m => m.ikutLiga).forEach(m => {
          const exists = leaguePeserta.some(p => 
            (p.id && m.id && p.id === m.id) || 
            (p.nama && m.nama && p.nama.trim().toLowerCase() === m.nama.trim().toLowerCase())
          );
          if (!exists) {
            leaguePeserta.push({
              id: m.id,
              nama: m.nama,
              noHP: m.noHP || '',
              divisi: String(m.divisi || '1'),
              namaPTM: m.namaPTM || 'Klub',
              karetForehand: m.karetForehand || '',
              karetBackhand: m.karetBackhand || '',
              pts: m.pts || 0,
              ptsTotal: m.ptsTotal !== undefined ? m.ptsTotal : (m.pts || 0),
              ptsLiga: m.ptsLiga || 0,
              ptsTurnamen: m.ptsTurnamen || 0,
              ikutLiga: true
            });
            needUpdate = true;
          }
        });

        data.peserta = leaguePeserta;
        const updatedKlasemen = hitungKlasemenLiga(leaguePeserta, data.jadwal || [], {
          poinMenang: Number(data.poinMenang || 3),
          poinKalah: Number(data.poinKalah || 0)
        });
        data.klasemen = updatedKlasemen;

        if (needUpdate) {
          await updateLiga(data.id, data);
        }

        setLeague(data);
      } else {
        alert("Liga tidak ditemukan!");
        navigate('/liga');
      }
    } catch (err) {
      console.error("Error loading league:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLeague();
  }, [id]);

  const canManage = isSuperAdmin || (currentUser && league?.createdBy === currentUser.uid);

  // Open Score Modal
  const handleOpenScoreModal = (pekan, match) => {
    if (!canManage) return;
    setActivePekan(pekan);
    setActiveMatch(match);
    setModalMeja(match.meja || 'Meja 1');
    setModalWasitId(match.wasit?.id || '');
    setModalTanggal(match.tanggal || pekan.tanggalMulai || pekan.tanggal || '');
    setModalPeserta1Id(match.peserta1?.id || '');
    setModalPeserta2Id(match.peserta2?.id || '');
    setModalFotoBukti(match.fotoBukti || '');
    const now = new Date();
    const currentFormattedTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setModalJam(match.jam && match.jam !== 'Bebas' ? match.jam : currentFormattedTime);

    if (match.skor && (Array.isArray(match.skor) ? match.skor.length > 0 : true)) {
      const [s1, s2] = parseMatchScore(match.skor);
      setModalSet1(match.selesai || s1 > 0 || s2 > 0 ? String(s1) : '');
      setModalSet2(match.selesai || s1 > 0 || s2 > 0 ? String(s2) : '');
    } else {
      setModalSet1('');
      setModalSet2('');
    }
    setShowScoreModal(true);
  };

  const handleFotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsCompressingFoto(true);
      // Auto compress and resize to max 130KB
      const compressedDataUrl = await compressImage(file, 130 * 1024);
      setModalFotoBukti(compressedDataUrl);
    } catch (err) {
      console.error("Error compressing match photo:", err);
      alert("Gagal memproses foto: " + err.message);
    } finally {
      setIsCompressingFoto(false);
      e.target.value = '';
    }
  };

  const handleInputFotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsCompressingInputFoto(true);
      const compressedDataUrl = await compressImage(file, 130 * 1024);
      setInputFotoBukti(compressedDataUrl);
    } catch (err) {
      console.error("Error compressing match photo:", err);
      alert("Gagal memproses foto: " + err.message);
    } finally {
      setIsCompressingInputFoto(false);
      e.target.value = '';
    }
  };

  const handleQuickSubmitMatch = async (e) => {
    if (e) e.preventDefault();
    if (!canManage || !league) return;

    const targetPekanId = inputPekanId || (selectedPekan !== 'semua' ? selectedPekan : league.jadwal?.[0]?.id);
    if (!targetPekanId) {
      alert("Silakan pilih Pekan pertandingan!");
      return;
    }

    if (!inputPeserta1Id || !inputPeserta2Id) {
      alert("Silakan pilih Pemain 1 dan Pemain 2!");
      return;
    }

    if (inputPeserta1Id === inputPeserta2Id) {
      alert("Pemain 1 dan Pemain 2 tidak boleh orang yang sama!");
      return;
    }

    const s1 = inputSet1 === '' ? null : parseInt(inputSet1);
    const s2 = inputSet2 === '' ? null : parseInt(inputSet2);

    if (s1 === null || s2 === null || isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
      alert("Silakan masukkan jumlah set yang dimenangkan masing-masing pemain!");
      return;
    }

    if (s1 === s2) {
      alert("Pertandingan tenis meja tidak boleh berakhir seri pada jumlah set!");
      return;
    }

    const p1 = league.peserta.find(p => p.id === inputPeserta1Id);
    const p2 = league.peserta.find(p => p.id === inputPeserta2Id);
    const wasitObj = league.peserta.find(p => p.id === inputWasitId) || null;

    const pemenangId = s1 > s2 ? p1.id : p2.id;
    const targetPekan = (league.jadwal || []).find(p => p.id === targetPekanId);
    const pekanNumber = targetPekan?.pekan || 1;

    const newMatch = {
      id: generateId(),
      isBye: false,
      pekan: pekanNumber,
      peserta1: p1,
      peserta2: p2,
      wasit: wasitObj ? { id: wasitObj.id, nama: wasitObj.nama, namaPTM: wasitObj.namaPTM } : null,
      meja: inputMeja || 'Meja 1',
      tanggal: inputTanggal,
      jam: inputJam || 'Bebas',
      skor: [s1, s2],
      pemenang: pemenangId,
      selesai: true,
      fotoBukti: inputFotoBukti || '',
      catatan: ''
    };

    const updatedJadwal = (league.jadwal || []).map(p => {
      if (p.id === targetPekanId) {
        return {
          ...p,
          pertandingan: [newMatch, ...(p.pertandingan || []).filter(m => !(!m.selesai && (!m.skor || m.skor.length === 0) && m.peserta1?.id === p1.id && m.peserta2?.id === p2.id))]
        };
      }
      return p;
    });

    const updatedKlasemen = hitungKlasemenLiga(league.peserta, updatedJadwal, {
      poinMenang: Number(league.poinMenang || 3),
      poinKalah: Number(league.poinKalah || 0)
    });

    const updatedLeague = {
      ...league,
      jadwal: updatedJadwal,
      klasemen: updatedKlasemen
    };

    try {
      await updateLiga(league.id, updatedLeague);
      setLeague(updatedLeague);
      
      // Reset form: date & time keep current, players & referee reset to empty
      const now = new Date();
      setInputTanggal(now.toISOString().split('T')[0]);
      setInputJam(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      setInputPeserta1Id('');
      setInputPeserta2Id('');
      setInputWasitId('');
      setInputSet1('');
      setInputSet2('');
      setInputFotoBukti('');
      alert("Hasil pertandingan berhasil disimpan dan klasemen telah diperbarui!");
    } catch (err) {
      alert("Gagal menyimpan hasil pertandingan: " + err.message);
    }
  };

  const handleDeleteMatch = async (pekanId, matchId) => {
    if (!canManage || !league) return;
    if (!window.confirm("Apakah Anda yakin ingin menghapus hasil pertandingan ini?")) return;

    const updatedJadwal = (league.jadwal || []).map(p => {
      if (p.id === pekanId) {
        return {
          ...p,
          pertandingan: (p.pertandingan || []).filter(m => m.id !== matchId)
        };
      }
      return p;
    });

    const updatedKlasemen = hitungKlasemenLiga(league.peserta, updatedJadwal, {
      poinMenang: Number(league.poinMenang || 3),
      poinKalah: Number(league.poinKalah || 0)
    });

    const updatedLeague = {
      ...league,
      jadwal: updatedJadwal,
      klasemen: updatedKlasemen
    };

    try {
      await updateLiga(league.id, updatedLeague);
      setLeague(updatedLeague);
      alert("Hasil pertandingan telah dihapus.");
    } catch (err) {
      alert("Gagal menghapus hasil pertandingan: " + err.message);
    }
  };

  const handleUpdateMatchPlayer = async (pekanId, matchId, playerNum, newPlayerId) => {
    if (!canManage || !league) return;
    const selectedPlayer = league.peserta.find(p => p.id === newPlayerId);
    if (!selectedPlayer) return;

    const updatedJadwal = league.jadwal.map(pekan => {
      if (pekan.id === pekanId) {
        return {
          ...pekan,
          pertandingan: pekan.pertandingan.map(m => {
            if (m.id === matchId) {
              const updated = {
                ...m,
                [playerNum === 1 ? 'peserta1' : 'peserta2']: selectedPlayer
              };
              if (m.selesai && m.pemenang) {
                updated.pemenang = m.pemenang === m.peserta1?.id ? (playerNum === 1 ? selectedPlayer.id : m.peserta1?.id) : (playerNum === 2 ? selectedPlayer.id : m.peserta2?.id);
              }
              return updated;
            }
            return m;
          })
        };
      }
      return pekan;
    });

    const updatedKlasemen = hitungKlasemenLiga(league.peserta, updatedJadwal, {
      poinMenang: Number(league.poinMenang || 3),
      poinKalah: Number(league.poinKalah || 0)
    });

    const updatedLeague = {
      ...league,
      jadwal: updatedJadwal,
      klasemen: updatedKlasemen
    };

    try {
      await updateLiga(league.id, updatedLeague);
      setLeague(updatedLeague);
    } catch (err) {
      alert("Gagal memperbarui pemain: " + err.message);
    }
  };

  const handleUpdateMatchWasit = async (pekanId, matchId, wasitId) => {
    if (!canManage || !league) return;
    const selectedWasit = league.peserta.find(p => p.id === wasitId) || null;

    const updatedJadwal = league.jadwal.map(pekan => {
      if (pekan.id === pekanId) {
        return {
          ...pekan,
          pertandingan: pekan.pertandingan.map(m => {
            if (m.id === matchId) {
              return {
                ...m,
                wasit: selectedWasit ? { id: selectedWasit.id, nama: selectedWasit.nama, namaPTM: selectedWasit.namaPTM } : null
              };
            }
            return m;
          })
        };
      }
      return pekan;
    });

    const updatedLeague = {
      ...league,
      jadwal: updatedJadwal
    };

    try {
      await updateLiga(league.id, updatedLeague);
      setLeague(updatedLeague);
    } catch (err) {
      alert("Gagal memperbarui wasit: " + err.message);
    }
  };

  const handleUpdateMatchField = async (pekanId, matchId, fieldName, value) => {
    if (!canManage || !league) return;

    const updatedJadwal = league.jadwal.map(pekan => {
      if (pekan.id === pekanId) {
        return {
          ...pekan,
          pertandingan: pekan.pertandingan.map(m => {
            if (m.id === matchId) {
              return {
                ...m,
                [fieldName]: value
              };
            }
            return m;
          })
        };
      }
      return pekan;
    });

    const updatedLeague = {
      ...league,
      jadwal: updatedJadwal
    };

    try {
      await updateLiga(league.id, updatedLeague);
      setLeague(updatedLeague);
    } catch (err) {
      alert("Gagal memperbarui data pertandingan: " + err.message);
    }
  };

  const getPekanInfo = (pekan, idx) => {
    const pNum = pekan.pekan || (idx !== undefined ? idx + 1 : 1);
    const cleanName = `Pekan ${pNum}`;
    const baseStart = new Date('2026-09-13');
    const startWeek = new Date(baseStart);
    startWeek.setDate(baseStart.getDate() + (pNum - 1) * 7);
    const startStr = startWeek.toISOString().split('T')[0];

    const endWeek = new Date(startWeek);
    endWeek.setDate(startWeek.getDate() + 6);
    const endStr = endWeek.toISOString().split('T')[0];

    const rentang = formatRentangTanggal(startStr, endStr);
    return {
      cleanName,
      rentang,
      fullTitle: `${cleanName} (${rentang})`,
      startStr,
      endStr
    };
  };

  const handleOpenAddPlayerModal = async () => {
    try {
      const data = await getPemain();
      setMasterPemainList(data || []);
      if (data && data.length > 0) {
        setSelectedMasterPlayerId(data[0].id);
      }
    } catch (e) {
      console.error("Error fetching master players:", e);
    }
    setFormPlayerNama('');
    setFormPlayerNoHP('');
    setFormPlayerDivisi('1');
    setFormPlayerPTM('');
    setFormPlayerKaretFH('');
    setFormPlayerKaretBH('');
    setAddMode('master');
    setShowAddPlayerModal(true);
  };

  const handleAddPlayerSubmit = async (e) => {
    e.preventDefault();
    if (!canManage || !league) return;

    let newPlayer = null;

    if (addMode === 'master') {
      const master = masterPemainList.find(p => p.id === selectedMasterPlayerId);
      if (!master) {
        alert("Pilih pemain terlebih dahulu!");
        return;
      }
      const isAlreadyAdded = (league.peserta || []).some(
        p => p.id === master.id || p.nama?.toLowerCase() === (master.nama || master.name)?.toLowerCase()
      );
      if (isAlreadyAdded) {
        alert(`Pemain "${master.nama || master.name}" sudah ada dalam daftar peserta liga!`);
        return;
      }
      newPlayer = {
        id: master.id || generateId(),
        nama: master.nama || master.name,
        noHP: master.noHP || master.kontak || '',
        divisi: String(master.divisi || '1'),
        namaPTM: master.namaPTM || master.ownerPTM || 'Klub Tamu',
        karetForehand: master.karetForehand || '',
        karetBackhand: master.karetBackhand || '',
        pts: master.pts || 0
      };
    } else {
      if (!formPlayerNama.trim()) {
        alert("Nama pemain wajib diisi!");
        return;
      }
      newPlayer = {
        id: 'peserta_' + generateId(),
        nama: formPlayerNama.trim(),
        noHP: formPlayerNoHP.trim(),
        divisi: String(formPlayerDivisi || '1'),
        namaPTM: formPlayerPTM.trim() || 'Klub Tamu',
        karetForehand: formPlayerKaretFH || '',
        karetBackhand: formPlayerKaretBH || '',
        pts: 0
      };
    }

    const updatedPeserta = [...(league.peserta || []), newPlayer];
    const updatedKlasemen = hitungKlasemenLiga(updatedPeserta, league.jadwal || [], {
      poinMenang: Number(league.poinMenang || 3),
      poinKalah: Number(league.poinKalah || 0)
    });

    const updatedLeague = {
      ...league,
      peserta: updatedPeserta,
      klasemen: updatedKlasemen
    };

    try {
      await updateLiga(league.id, updatedLeague);
      setLeague(updatedLeague);
      await syncLeaguePlayerToMember(newPlayer, false, currentUser);
      setShowAddPlayerModal(false);
      alert(`Pemain "${newPlayer.nama}" berhasil ditambahkan ke peserta liga dan database Member!`);
    } catch (err) {
      alert("Gagal menambahkan pemain: " + err.message);
    }
  };

  const handleOpenEditPlayerModal = (player) => {
    setPlayerToEdit(player);
    setFormPlayerNama(player.nama || '');
    setFormPlayerNoHP(player.noHP || player.kontak || '');
    setFormPlayerDivisi(String(player.divisi || '1'));
    setFormPlayerPTM(player.namaPTM || '');
    setFormPlayerKaretFH(player.karetForehand || '');
    setFormPlayerKaretBH(player.karetBackhand || '');
    setShowEditPlayerModal(true);
  };

  const handleSaveEditPlayer = async (e) => {
    e.preventDefault();
    if (!canManage || !league || !playerToEdit) return;
    if (!formPlayerNama.trim()) {
      alert("Nama pemain tidak boleh kosong!");
      return;
    }

    const updatedPeserta = (league.peserta || []).map(p => {
      if (p.id === playerToEdit.id) {
        return {
          ...p,
          nama: formPlayerNama.trim(),
          noHP: formPlayerNoHP.trim(),
          divisi: String(formPlayerDivisi || '1'),
          namaPTM: formPlayerPTM.trim() || p.namaPTM || 'Klub',
          karetForehand: formPlayerKaretFH || '',
          karetBackhand: formPlayerKaretBH || ''
        };
      }
      return p;
    });

    // Update in matches (jadwal)
    const updatedJadwal = (league.jadwal || []).map(pekan => ({
      ...pekan,
      pertandingan: (pekan.pertandingan || []).map(m => {
        let newM = { ...m };
        if (m.peserta1?.id === playerToEdit.id) {
          newM.peserta1 = { ...m.peserta1, nama: formPlayerNama.trim(), namaPTM: formPlayerPTM.trim() || m.peserta1?.namaPTM };
        }
        if (m.peserta2?.id === playerToEdit.id) {
          newM.peserta2 = { ...m.peserta2, nama: formPlayerNama.trim(), namaPTM: formPlayerPTM.trim() || m.peserta2?.namaPTM };
        }
        if (m.wasit?.id === playerToEdit.id) {
          newM.wasit = { ...m.wasit, nama: formPlayerNama.trim(), namaPTM: formPlayerPTM.trim() || m.wasit?.namaPTM };
        }
        return newM;
      })
    }));

    const updatedKlasemen = hitungKlasemenLiga(updatedPeserta, updatedJadwal, {
      poinMenang: Number(league.poinMenang || 3),
      poinKalah: Number(league.poinKalah || 0)
    });

    const updatedLeague = {
      ...league,
      peserta: updatedPeserta,
      jadwal: updatedJadwal,
      klasemen: updatedKlasemen
    };

    try {
      await updateLiga(league.id, updatedLeague);
      setLeague(updatedLeague);
      const editedP = updatedPeserta.find(p => p.id === playerToEdit.id);
      if (editedP) {
        await syncLeaguePlayerToMember(editedP, false, currentUser);
      }
      setShowEditPlayerModal(false);
      setPlayerToEdit(null);
      alert("Data peserta liga dan database Member berhasil diperbarui!");
    } catch (err) {
      alert("Gagal memperbarui peserta: " + err.message);
    }
  };

  const handleDeletePlayer = async (player) => {
    if (!canManage || !league) return;
    if (!window.confirm(`Apakah Anda yakin ingin menghapus peserta "${player.nama}" (${player.namaPTM}) dari Liga?`)) {
      return;
    }

    const updatedPeserta = (league.peserta || []).filter(p => p.id !== player.id);
    const updatedKlasemen = hitungKlasemenLiga(updatedPeserta, league.jadwal || [], {
      poinMenang: Number(league.poinMenang || 3),
      poinKalah: Number(league.poinKalah || 0)
    });

    const updatedLeague = {
      ...league,
      peserta: updatedPeserta,
      klasemen: updatedKlasemen
    };

    try {
      await updateLiga(league.id, updatedLeague);
      setLeague(updatedLeague);
      await syncLeaguePlayerToMember(player, true, currentUser);
      alert(`Peserta "${player.nama}" telah dihapus dari liga dan status ikutLiga diupdate.`);
    } catch (err) {
      alert("Gagal menghapus peserta: " + err.message);
    }
  };

  const handleAddNewMatchToPekan = async (pekanId) => {
    if (!canManage || !league) return;
    const defaultP1 = league.peserta[0] || null;
    const defaultP2 = league.peserta[1] || null;
    const currentPekan = (league.jadwal || []).find(p => p.id === pekanId);
    const pInfo = getPekanInfo(currentPekan || {}, 0);

    const newMatch = {
      id: generateId(),
      isBye: false,
      pekan: currentPekan?.pekan || 1,
      peserta1: defaultP1,
      peserta2: defaultP2,
      wasit: null,
      meja: 'Meja 1',
      tanggal: pInfo.startStr,
      jam: 'Bebas',
      skor: [],
      pemenang: null,
      selesai: false,
      catatan: ''
    };

    const updatedJadwal = (league.jadwal || []).map(p => {
      if (p.id === pekanId) {
        return {
          ...p,
          pertandingan: [...(p.pertandingan || []), newMatch]
        };
      }
      return p;
    });

    const updatedLeague = {
      ...league,
      jadwal: updatedJadwal
    };

    try {
      await updateLiga(league.id, updatedLeague);
      setLeague(updatedLeague);
    } catch (err) {
      alert("Gagal menambah partai baru: " + err.message);
    }
  };

  const handleSaveScore = async () => {
    if (!activeMatch || !activePekan || !league) return;

    const s1 = modalSet1 === '' ? null : parseInt(modalSet1);
    const s2 = modalSet2 === '' ? null : parseInt(modalSet2);

    if (s1 === null || s2 === null || isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
      alert("Silakan masukkan jumlah set yang dimenangkan masing-masing pemain!");
      return;
    }

    if (s1 === s2) {
      alert("Pertandingan tenis meja tidak boleh berakhir seri pada jumlah set!");
      return;
    }

    const currentValidScores = [s1, s2];
    const p1 = league.peserta.find(p => p.id === modalPeserta1Id) || activeMatch.peserta1;
    const p2 = league.peserta.find(p => p.id === modalPeserta2Id) || activeMatch.peserta2;
    const wasitObj = league.peserta.find(p => p.id === modalWasitId) || null;

    let pemenangId = null;
    let isFinished = false;

    if (s1 > s2) {
      pemenangId = p1?.id;
      isFinished = true;
    } else if (s2 > s1) {
      pemenangId = p2?.id;
      isFinished = true;
    }

    // Update match inside jadwal
    const updatedJadwal = league.jadwal.map(pekan => {
      if (pekan.id === activePekan.id) {
        return {
          ...pekan,
          pertandingan: pekan.pertandingan.map(m => {
            if (m.id === activeMatch.id) {
              return {
                ...m,
                peserta1: p1,
                peserta2: p2,
                wasit: wasitObj ? { id: wasitObj.id, nama: wasitObj.nama, namaPTM: wasitObj.namaPTM } : null,
                tanggal: modalTanggal,
                skor: currentValidScores,
                pemenang: pemenangId,
                selesai: isFinished,
                meja: modalMeja,
                jam: modalJam,
                fotoBukti: modalFotoBukti || ''
              };
            }
            return m;
          })
        };
      }
      return pekan;
    });

    // Recompute standings
    const updatedKlasemen = hitungKlasemenLiga(league.peserta, updatedJadwal, {
      poinMenang: Number(league.poinMenang || 3),
      poinKalah: Number(league.poinKalah || 0)
    });

    const updatedLeague = {
      ...league,
      jadwal: updatedJadwal,
      klasemen: updatedKlasemen
    };

    try {
      await updateLiga(league.id, updatedLeague);
      setLeague(updatedLeague);
      setShowScoreModal(false);
    } catch (err) {
      alert("Gagal menyimpan skor pertandingan: " + err.message);
    }
  };

  // Open Fullscreen Live Scoreboard
  const handleOpenScoreboard = (pekan, match) => {
    setActivePekan(pekan);
    setActiveMatch(match);
    setLiveP1Score(0);
    setLiveP2Score(0);
    setLiveP1Sets(0);
    setLiveP2Sets(0);
    setLiveHistory([]);
    setServingPlayer(1);

    // If there is existing score
    if (match.skor && match.skor.length > 0) {
      let p1Sets = 0;
      let p2Sets = 0;
      match.skor.forEach(s => {
        if (s[0] > s[1]) p1Sets++;
        else if (s[1] > s[0]) p2Sets++;
      });
      setLiveP1Sets(p1Sets);
      setLiveP2Sets(p2Sets);
      setLiveHistory(match.skor.map(s => [...s]));
    }
    setShowScoreboard(true);
  };

  const handleScoreboardPoint = (player) => {
    let newP1 = liveP1Score;
    let newP2 = liveP2Score;

    if (player === 1) newP1 += 1;
    else newP2 += 1;

    setLiveP1Score(newP1);
    setLiveP2Score(newP2);

    // Switch service every 2 points, or every 1 point if deuce (>= 10-10)
    const totalPoints = newP1 + newP2;
    if (newP1 >= 10 && newP2 >= 10) {
      setServingPlayer(totalPoints % 2 === 0 ? 1 : 2);
    } else {
      setServingPlayer(Math.floor(totalPoints / 2) % 2 === 0 ? 1 : 2);
    }

    // Check Set Win (11 points, win by 2)
    if ((newP1 >= 11 || newP2 >= 11) && Math.abs(newP1 - newP2) >= 2) {
      const setWinner = newP1 > newP2 ? 1 : 2;
      const finishedSetScore = [newP1, newP2];
      const newHistory = [...liveHistory, finishedSetScore];
      setLiveHistory(newHistory);

      let newP1Sets = liveP1Sets + (setWinner === 1 ? 1 : 0);
      let newP2Sets = liveP2Sets + (setWinner === 2 ? 1 : 0);
      setLiveP1Sets(newP1Sets);
      setLiveP2Sets(newP2Sets);

      // Reset points for next set
      setLiveP1Score(0);
      setLiveP2Score(0);

      const targetSets = league.formatSet === 'best_of_3' ? 2 : 3;
      if (newP1Sets === targetSets || newP2Sets === targetSets) {
        alert(`Pertandingan Selesai! Pemenang: ${setWinner === 1 ? activeMatch.peserta1?.nama : activeMatch.peserta2?.nama}`);
      }
    }
  };

  const handleSaveScoreboardResult = async () => {
    if (!activeMatch || !activePekan || !league) return;

    const finalScores = [liveP1Sets, liveP2Sets];
    let pemenangId = null;
    let isFinished = false;

    if (liveP1Sets > liveP2Sets) {
      pemenangId = activeMatch.peserta1?.id;
      isFinished = true;
    } else if (liveP2Sets > liveP1Sets) {
      pemenangId = activeMatch.peserta2?.id;
      isFinished = true;
    }

    const updatedJadwal = league.jadwal.map(pekan => {
      if (pekan.id === activePekan.id) {
        return {
          ...pekan,
          pertandingan: pekan.pertandingan.map(m => {
            if (m.id === activeMatch.id) {
              return {
                ...m,
                skor: finalScores,
                pemenang: pemenangId,
                selesai: isFinished
              };
            }
            return m;
          })
        };
      }
      return pekan;
    });

    const updatedKlasemen = hitungKlasemenLiga(league.peserta, updatedJadwal, {
      poinMenang: Number(league.poinMenang || 3),
      poinKalah: Number(league.poinKalah || 0)
    });

    const updatedLeague = {
      ...league,
      jadwal: updatedJadwal,
      klasemen: updatedKlasemen
    };

    try {
      await updateLiga(league.id, updatedLeague);
      setLeague(updatedLeague);
      setShowScoreboard(false);
    } catch (err) {
      alert("Gagal menyimpan hasil scoreboard: " + err.message);
    }
  };

  // Toggle Finish League
  const handleToggleSelesaiLiga = async () => {
    if (!canManage) return;

    if (league.status !== 'selesai') {
      const topLeader = league.klasemen && league.klasemen.length > 0 ? league.klasemen[0] : null;
      if (window.confirm(`Selesaikan Liga secara resmi? Peringkat 1 (${topLeader ? topLeader.nama : 'Peserta'}) akan dinobatkan sebagai Juara Liga.`)) {
        const updated = {
          ...league,
          status: 'selesai',
          juara: topLeader ? { id: topLeader.pesertaId, nama: topLeader.nama, namaPTM: topLeader.namaPTM } : null
        };
        await updateLiga(league.id, updated);
        setLeague(updated);
      }
    } else {
      if (window.confirm("Buka kembali Liga ke status Berlangsung?")) {
        const updated = {
          ...league,
          status: 'berlangsung',
          juara: null
        };
        await updateLiga(league.id, updated);
        setLeague(updated);
      }
    }
  };

  const handleDeleteLeague = async () => {
    if (!canManage) return;
    if (window.confirm(`Apakah Anda yakin ingin menghapus liga "${league.nama}" secara permanen?`)) {
      try {
        await deleteLiga(league.id);
        navigate('/liga');
      } catch (e) {
        alert("Gagal menghapus liga: " + e.message);
      }
    }
  };

  if (loading) {
    return <div className="page-container" style={{ textAlign: 'center', marginTop: '50px' }}>Memuat data liga...</div>;
  }

  if (!league) return null;

  const stats = calculateLeagueStats(league);

  return (
    <div className="page-container fade-in">
      {/* Top Breadcrumb & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '10px' }}>
        <button onClick={() => navigate('/liga')} className="btn btn-secondary btn-sm">
          ⬅ Kembali ke Daftar Liga
        </button>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => window.print()} className="btn btn-secondary btn-sm">
            🖨️ Cetak / Print View
          </button>
          {canManage && (
            <button
              onClick={handleToggleSelesaiLiga}
              className={`btn btn-sm ${league.status === 'selesai' ? 'btn-secondary' : 'btn-primary'}`}
            >
              {league.status === 'selesai' ? '🔄 Buka Kembali Liga' : '🏆 Selesaikan Liga & Nobatkan Juara'}
            </button>
          )}
        </div>
      </div>

      {/* Hero Header Panel */}
      <div className="card" style={{
        padding: '24px',
        marginBottom: '2rem',
        border: '1px solid var(--border-color)',
        background: 'linear-gradient(180deg, rgba(15, 19, 36, 0.8) 0%, rgba(22, 27, 51, 0.95) 100%)',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span style={{
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                background: league.status === 'selesai' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0, 200, 255, 0.15)',
                border: league.status === 'selesai' ? '1px solid var(--success-color)' : '1px solid var(--primary-color)',
                color: league.status === 'selesai' ? 'var(--success-color)' : 'var(--primary-color)',
                textTransform: 'uppercase'
              }}>
                {league.status === 'selesai' ? '🏆 LIGA SELESAI' : '⚡ LIGA BERLANGSUNG'}
              </span>
              <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.06)' }}>
                {league.tipe === 'Double' ? '👥 Kategori Ganda' : '👤 Kategori Tunggal'}
              </span>
              {league.putaran === 2 && (
                <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', background: 'rgba(168, 85, 247, 0.15)', color: 'var(--secondary-color)' }}>
                  🔄 2 Putaran (Home & Away)
                </span>
              )}
              <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.06)' }}>
                {league.formatSet === 'best_of_3' ? 'Best of 3 Sets' : 'Best of 5 Sets'}
              </span>
            </div>

            <h1 style={{ fontSize: '2.2rem', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
              {league.nama}
            </h1>

            {league.deskripsi && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0, maxWidth: '700px' }}>
                {league.deskripsi}
              </p>
            )}
          </div>

          {/* Quick Stats in Hero */}
          <div style={{
            display: 'flex',
            gap: '16px',
            background: 'var(--bg-surface)',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{league.peserta?.length || 0}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Peserta</div>
            </div>
            <div style={{ width: '1px', background: 'var(--border-light)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--secondary-color)' }}>{league.jadwal?.length || 0}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pekan</div>
            </div>
            <div style={{ width: '1px', background: 'var(--border-light)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--success-color)' }}>{stats?.progressPercent || 0}%</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Selesai</div>
            </div>
          </div>
        </div>

        {/* Winner Banner if Finished */}
        {league.status === 'selesai' && league.juara && (
          <div style={{
            marginTop: '1.5rem',
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(90deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.1) 100%)',
            border: '1px solid rgba(251, 191, 36, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <span style={{ fontSize: '2.5rem' }}>👑</span>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#fbbf24', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.1em' }}>
                JUARA RESMI LIGA TENIS MEJA
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                {league.juara.nama} <span style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>({league.juara.namaPTM})</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '10px',
        borderBottom: '1px solid var(--border-light)',
        marginBottom: '1.5rem',
        overflowX: 'auto',
        paddingBottom: '4px'
      }}>
        {[
          { key: 'klasemen', label: '🏆 Tabel Klasemen', icon: '🏆' },
          { key: 'peserta', label: '👥 Peserta Liga', icon: '👥' },
          { key: 'jadwal', label: '🏓 Hasil Pertandingan', icon: '🏓' },
          { key: 'statistik', label: '📊 Statistik & Rekap', icon: '📊' },
          ...(canManage ? [{ key: 'pengaturan', label: '⚙️ Pengaturan Liga', icon: '⚙️' }] : [])
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === tab.key ? '3px solid var(--primary-color)' : '3px solid transparent',
              color: activeTab === tab.key ? 'var(--primary-color)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.key ? 'bold' : '500',
              fontSize: '1rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: KLASEMEN */}
      {activeTab === 'klasemen' && (
        <div className="card" style={{ padding: '20px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.25rem' }}>
              Klasemen Sementara Liga
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Aturan Poin: Menang ({league.poinMenang || 3} Poin) • Kalah ({league.poinKalah || 0} Poin)
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 8px', textAlign: 'center', width: '40px' }}>Pos</th>
                <th style={{ padding: '12px 12px' }}>Peserta / Klub</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>M</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>W</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>L</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>Set (W-L)</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>Sel. Set</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>Poin (W-L)</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>Sel. Poin</th>
                <th style={{ padding: '12px 12px', textAlign: 'center', color: 'var(--primary-color)', fontWeight: 'bold' }}>PTS</th>
                <th style={{ padding: '12px 12px', textAlign: 'center' }}>Form (5 Laga)</th>
              </tr>
            </thead>
            <tbody>
              {[...(league.klasemen || [])].sort((a, b) => {
                const ptsA = Number(a.poin || 0);
                const ptsB = Number(b.poin || 0);
                if (ptsB !== ptsA) return ptsB - ptsA;

                const setDiffA = Number(a.selisihSet !== undefined ? a.selisihSet : (Number(a.setMenang || 0) - Number(a.setKalah || 0)));
                const setDiffB = Number(b.selisihSet !== undefined ? b.selisihSet : (Number(b.setMenang || 0) - Number(b.setKalah || 0)));
                if (setDiffB !== setDiffA) return setDiffB - setDiffA;

                const ptDiffA = Number(a.selisihPoin !== undefined ? a.selisihPoin : (Number(a.poinMenang || 0) - Number(a.poinKalah || 0)));
                const ptDiffB = Number(b.selisihPoin !== undefined ? b.selisihPoin : (Number(b.poinMenang || 0) - Number(b.poinKalah || 0)));
                if (ptDiffB !== ptDiffA) return ptDiffB - ptDiffA;

                const setWonA = Number(a.setMenang || 0);
                const setWonB = Number(b.setMenang || 0);
                if (setWonB !== setWonA) return setWonB - setWonA;

                return (a.nama || '').localeCompare(b.nama || '', undefined, { sensitivity: 'base' });
              }).map((row, idx) => {
                let posBadge = `${idx + 1}`;
                let rowBg = 'transparent';

                if (idx === 0) {
                  posBadge = '🥇 1';
                  rowBg = 'rgba(251, 191, 36, 0.06)';
                } else if (idx === 1) {
                  posBadge = '🥈 2';
                  rowBg = 'rgba(156, 163, 175, 0.04)';
                } else if (idx === 2) {
                  posBadge = '🥉 3';
                  rowBg = 'rgba(217, 119, 6, 0.04)';
                }

                return (
                  <tr
                    key={row.pesertaId}
                    style={{
                      borderBottom: '1px solid var(--border-light)',
                      background: rowBg,
                      transition: 'background 0.15s'
                    }}
                  >
                    <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>
                      {posBadge}
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ fontWeight: idx < 3 ? 'bold' : 'normal', color: 'var(--text-primary)' }}>
                        {row.nama}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {row.namaPTM}
                      </div>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>{row.main}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--success-color)', fontWeight: 'bold' }}>{row.menang}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--danger-color)' }}>{row.kalah}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>{row.setMenang}-{row.setKalah}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', color: row.selisihSet > 0 ? 'var(--success-color)' : row.selisihSet < 0 ? 'var(--danger-color)' : 'inherit' }}>
                      {row.selisihSet > 0 ? `+${row.selisihSet}` : row.selisihSet}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>{row.poinMenang}-{row.poinKalah}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', color: row.selisihPoin > 0 ? 'var(--success-color)' : row.selisihPoin < 0 ? 'var(--danger-color)' : 'inherit' }}>
                      {row.selisihPoin > 0 ? `+${row.selisihPoin}` : row.selisihPoin}
                    </td>
                    <td style={{ padding: '12px 12px', textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                      {row.poin}
                    </td>
                    <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        {(row.last5Form || []).length === 0 ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>
                        ) : (
                          row.last5Form.map((f, fIdx) => (
                            <span
                              key={fIdx}
                              style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '4px',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: '0.7rem',
                                fontWeight: 'bold',
                                background: f === 'W' ? 'var(--success-color)' : 'var(--danger-color)',
                                color: '#fff'
                              }}
                            >
                              {f}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Tie-breaker Legend */}
          <div style={{ marginTop: '1.5rem', padding: '12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-elevated)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <strong>💡 Urutan Penentuan Peringkat (Tie-Breaker):</strong> Poin Klasemen (PTS) ➔ Selisih Set (Set Won - Set Lost) ➔ Selisih Angka Poin ➔ Jumlah Set Menang ➔ Nama Peserta.
          </div>
        </div>
      )}

      {/* TAB PESERTA LIGA */}
      {activeTab === 'peserta' && (() => {
        const pesertaPtmOptions = Array.from(
          new Set((league?.peserta || []).map(p => (p.namaPTM || '').trim()).filter(Boolean))
        ).sort();

        const filteredPeserta = (league?.peserta || []).filter(p => {
          const matchDivisi = filterPesertaDivisi === 'Semua' || String(p.divisi) === String(filterPesertaDivisi);
          const matchPTM = filterPesertaPTM === 'Semua' || (p.namaPTM || '').trim().toLowerCase() === filterPesertaPTM.toLowerCase();
          const matchQuery = !searchPeserta ||
            (p.nama && p.nama.toLowerCase().includes(searchPeserta.toLowerCase())) ||
            (p.namaPTM && p.namaPTM.toLowerCase().includes(searchPeserta.toLowerCase())) ||
            (p.noHP && p.noHP.toLowerCase().includes(searchPeserta.toLowerCase()));
          return matchDivisi && matchPTM && matchQuery;
        }).sort((a, b) => (a.nama || '').localeCompare(b.nama || '', undefined, { sensitivity: 'base' }));

        return (
          <div>
            {/* Top Filter & Actions Bar matching Member Management */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Divisi Filter Chips */}
                <div className="divisi-filter" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['Semua', '1', '2', '3', '4', '5'].map(div => (
                    <button
                      key={div}
                      type="button"
                      className={`chip ${filterPesertaDivisi === div ? 'active' : ''}`}
                      onClick={() => setFilterPesertaDivisi(div)}
                    >
                      {div === 'Semua' ? 'Semua Divisi' : `Divisi ${div}`}
                    </button>
                  ))}
                </div>

                {/* PTM Filter Dropdown */}
                {pesertaPtmOptions.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>🏠 PTM:</span>
                    <select
                      className="form-select"
                      value={filterPesertaPTM}
                      onChange={e => setFilterPesertaPTM(e.target.value)}
                      style={{ fontSize: '0.85rem', padding: '4px 10px', width: 'auto', margin: 0 }}
                    >
                      <option value="Semua">Semua PTM ({league.peserta?.length || 0})</option>
                      {pesertaPtmOptions.map(ptmName => (
                        <option key={ptmName} value={ptmName}>{ptmName}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Search Bar */}
                <div style={{ position: 'relative', width: '260px', maxWidth: '100%' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={searchPeserta}
                    onChange={e => setSearchPeserta(e.target.value)}
                    placeholder="🔍 Cari nama pemain atau PTM..."
                    style={{
                      borderRadius: '24px',
                      fontSize: '0.85rem',
                      height: '36px',
                      margin: 0,
                      paddingLeft: '15px'
                    }}
                  />
                </div>

                {canManage && (
                  <button
                    type="button"
                    onClick={handleOpenAddPlayerModal}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.9rem', fontWeight: 'bold' }}
                  >
                    ➕ Tambah Peserta
                  </button>
                )}
              </div>
            </div>

            {/* Table Container Card matching PlayerTable */}
            <div className="card">
              {filteredPeserta.length === 0 ? (
                <div className="empty-state" style={{ textAlign: 'center', padding: '30px' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '10px' }}>👤</div>
                  <p>Belum ada pemain peserta terdaftar.</p>
                </div>
              ) : (
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
                        {canManage && <th style={{ width: '12%' }}>Aksi</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPeserta.map((pemain, index) => {
                        const memberInfo = masterPemainList.find(m => 
                          (m.id && pemain.id && m.id === pemain.id) || 
                          (m.nama && pemain.nama && m.nama.trim().toLowerCase() === pemain.nama.trim().toLowerCase())
                        );

                        const standing = (league.klasemen || []).find(k => k.pesertaId === pemain.id);
                        const noHP = pemain.noHP || memberInfo?.noHP || pemain.kontak || '-';
                        const ptm = pemain.namaPTM || memberInfo?.namaPTM || '-';
                        const div = pemain.divisi || memberInfo?.divisi || '1';
                        const fh = pemain.karetForehand || memberInfo?.karetForehand || '-';
                        const bh = pemain.karetBackhand || memberInfo?.karetBackhand || '-';

                        const ptsLigaVal = standing 
                          ? standing.poin 
                          : (memberInfo?.ptsLiga !== undefined ? memberInfo.ptsLiga : (pemain.ptsLiga || 0));

                        return (
                          <tr key={pemain.id || index}>
                            <td>{index + 1}</td>
                            <td>
                              <strong>{pemain.nama}</strong>
                            </td>
                            <td>{noHP}</td>
                            <td>
                              <span className={`badge ${badgeColors[div] || 'badge-primary'}`}>
                                Div {div}
                              </span>
                            </td>
                            <td>{ptm}</td>
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
                            <td>
                              <strong style={{ color: 'var(--primary-color)', fontSize: '1.05rem' }}>
                                {ptsLigaVal}
                              </strong>
                            </td>
                            {canManage && (
                              <td>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => handleOpenEditPlayerModal({ ...pemain, noHP, namaPTM: ptm, divisi: div, karetForehand: fh !== '-' ? fh : '', karetBackhand: bh !== '-' ? bh : '' })}
                                    title="Edit Pemain"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-danger"
                                    onClick={() => handleDeletePlayer(pemain)}
                                    title="Hapus dari Liga"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ marginTop: '15px', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
              Total: {filteredPeserta.length} pemain {filterPesertaDivisi !== 'Semua' ? `di Divisi ${filterPesertaDivisi}` : ''}
            </div>
          </div>
        );
      })()}

      {/* TAB 2: HASIL PERTANDINGAN */}
      {activeTab === 'jadwal' && (
        <div>
          {/* Sub menu: Pekan Filter Pills */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '1.5rem',
            overflowX: 'auto',
            paddingBottom: '6px'
          }}>
            <button
              onClick={() => setSelectedPekan('semua')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                border: selectedPekan === 'semua' ? '1px solid var(--primary-color)' : '1px solid var(--border-light)',
                background: selectedPekan === 'semua' ? 'rgba(0, 200, 255, 0.15)' : 'var(--bg-surface)',
                color: selectedPekan === 'semua' ? 'var(--primary-color)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: selectedPekan === 'semua' ? 'bold' : 'normal',
                whiteSpace: 'nowrap'
              }}
            >
              Semua Pekan
            </button>
            {(league.jadwal || []).map((p, idx) => {
              const pInfo = getPekanInfo(p, idx);
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPekan(p.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-full)',
                    border: selectedPekan === p.id ? '1px solid var(--primary-color)' : '1px solid var(--border-light)',
                    background: selectedPekan === p.id ? 'rgba(0, 200, 255, 0.15)' : 'var(--bg-surface)',
                    color: selectedPekan === p.id ? 'var(--primary-color)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: selectedPekan === p.id ? 'bold' : 'normal',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {pInfo.cleanName}
                </button>
              );
            })}
          </div>

          {/* ADMIN QUICK INPUT CARD AT TOP */}
          {canManage && (
            <div className="card" style={{
              padding: '20px',
              marginBottom: '1.5rem',
              background: 'linear-gradient(145deg, rgba(0, 200, 255, 0.05), rgba(168, 85, 247, 0.05))',
              border: '1px solid rgba(0, 200, 255, 0.35)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.3rem' }}>⚡</span>
                  <div>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.15rem' }}>
                      Input Hasil Pertandingan
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Catat hasil pertandingan langsung ke sistem. Tanggal dan jam otomatis waktu saat ini.
                    </span>
                  </div>
                </div>
                <span className="badge badge-primary" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                  Mode Admin
                </span>
              </div>

              <form onSubmit={handleQuickSubmitMatch}>
                {/* Row 1: Pekan, Meja, Tanggal, Jam, Wasit */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '10px',
                  marginBottom: '14px',
                  padding: '12px',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)'
                }}>
                  {/* Pekan selector */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>
                      📅 Pekan
                    </label>
                    <select
                      className="input"
                      value={inputPekanId || (selectedPekan !== 'semua' ? selectedPekan : (league.jadwal?.[0]?.id || ''))}
                      onChange={(e) => setInputPekanId(e.target.value)}
                      style={{ fontSize: '0.82rem', padding: '6px 8px', width: '100%' }}
                    >
                      {(league.jadwal || []).map((p, idx) => {
                        const pInfo = getPekanInfo(p, idx);
                        return (
                          <option key={p.id} value={p.id}>
                            {pInfo.cleanName}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Meja selector */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>
                      🏓 Meja
                    </label>
                    <select
                      className="input"
                      value={inputMeja}
                      onChange={(e) => setInputMeja(e.target.value)}
                      style={{ fontSize: '0.82rem', padding: '6px 8px', width: '100%' }}
                    >
                      <option value="Meja 1">🏓 Meja 1</option>
                      <option value="Meja 2">🏓 Meja 2</option>
                      <option value="Meja 3">🏓 Meja 3</option>
                      <option value="Meja 4">🏓 Meja 4</option>
                      <option value="Meja 5">🏓 Meja 5</option>
                      <option value="Meja 6">🏓 Meja 6</option>
                    </select>
                  </div>

                  {/* Tanggal */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>
                      📅 Tanggal
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={inputTanggal}
                      onChange={(e) => setInputTanggal(e.target.value)}
                      style={{ fontSize: '0.82rem', padding: '6px 8px', width: '100%' }}
                      required
                    />
                  </div>

                  {/* Jam */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>
                      ⏰ Jam
                    </label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input
                        type="text"
                        className="input"
                        value={inputJam}
                        onChange={(e) => setInputJam(e.target.value)}
                        placeholder="09:00"
                        style={{ fontSize: '0.82rem', padding: '6px 8px', flex: 1, textAlign: 'center' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          setInputJam(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
                        }}
                        title="Set ke Jam Sekarang"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0 8px', fontSize: '0.85rem' }}
                      >
                        ⚡
                      </button>
                    </div>
                  </div>

                  {/* Wasit */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 'bold' }}>
                      👨‍⚖️ Wasit (Pemain)
                    </label>
                    <select
                      className="input"
                      value={inputWasitId}
                      onChange={(e) => setInputWasitId(e.target.value)}
                      style={{ fontSize: '0.82rem', padding: '6px 8px', width: '100%' }}
                    >
                      <option value="">-- Kosong (Tanpa Wasit) --</option>
                      {(league.peserta || []).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nama} ({p.namaPTM})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 2: Players and Scores */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
                  gap: '12px',
                  alignItems: 'center',
                  padding: '16px',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                  marginBottom: '14px'
                }}>
                  {/* Pemain 1 Box */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: 'bold', marginBottom: '6px' }}>
                      🔵 PEMAIN 1
                    </label>
                    <select
                      className="input"
                      value={inputPeserta1Id}
                      onChange={(e) => setInputPeserta1Id(e.target.value)}
                      style={{ fontSize: '0.85rem', padding: '8px 10px', width: '100%', marginBottom: '8px', fontWeight: 'bold' }}
                      required
                    >
                      <option value="">-- Pilih Pemain 1 --</option>
                      {(league.peserta || []).map(p => (
                        <option key={p.id} value={p.id} disabled={p.id === inputPeserta2Id}>
                          {p.nama} ({p.namaPTM}) - Divisi {p.divisi}
                        </option>
                      ))}
                    </select>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Set Menang:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ width: '28px', height: '28px', padding: 0, fontSize: '0.9rem' }}
                          onClick={() => setInputSet1(String(Math.max(0, (parseInt(inputSet1) || 0) - 1)))}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          max="9"
                          className="input"
                          value={inputSet1}
                          onChange={(e) => setInputSet1(e.target.value)}
                          placeholder="0"
                          style={{ width: '45px', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', padding: '4px' }}
                          required
                        />
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ width: '28px', height: '28px', padding: 0, fontSize: '0.9rem' }}
                          onClick={() => setInputSet1(String((parseInt(inputSet1) || 0) + 1))}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* VS / Score Divider */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 12px',
                    background: 'rgba(0,0,0,0.1)',
                    borderRadius: '8px'
                  }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--warning-color)' }}>VS</span>
                    {inputSet1 !== '' && inputSet2 !== '' && (
                      <span style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '4px' }}>
                        {inputSet1} - {inputSet2}
                      </span>
                    )}
                  </div>

                  {/* Pemain 2 Box */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--secondary-color)', fontWeight: 'bold', marginBottom: '6px' }}>
                      🟣 PEMAIN 2
                    </label>
                    <select
                      className="input"
                      value={inputPeserta2Id}
                      onChange={(e) => setInputPeserta2Id(e.target.value)}
                      style={{ fontSize: '0.85rem', padding: '8px 10px', width: '100%', marginBottom: '8px', fontWeight: 'bold' }}
                      required
                    >
                      <option value="">-- Pilih Pemain 2 --</option>
                      {(league.peserta || []).map(p => (
                        <option key={p.id} value={p.id} disabled={p.id === inputPeserta1Id}>
                          {p.nama} ({p.namaPTM}) - Divisi {p.divisi}
                        </option>
                      ))}
                    </select>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Set Menang:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ width: '28px', height: '28px', padding: 0, fontSize: '0.9rem' }}
                          onClick={() => setInputSet2(String(Math.max(0, (parseInt(inputSet2) || 0) - 1)))}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          max="9"
                          className="input"
                          value={inputSet2}
                          onChange={(e) => setInputSet2(e.target.value)}
                          placeholder="0"
                          style={{ width: '45px', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', padding: '4px' }}
                          required
                        />
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ width: '28px', height: '28px', padding: 0, fontSize: '0.9rem' }}
                          onClick={() => setInputSet2(String((parseInt(inputSet2) || 0) + 1))}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 3: Preset buttons, Foto Bukti & Submit */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  {/* Preset score pills */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pilihan Cepat Skor:</span>
                    {(league.formatSet === 'best_of_3' 
                      ? [[2, 0], [2, 1], [1, 2], [0, 2]]
                      : [[3, 0], [3, 1], [3, 2], [2, 3], [1, 3], [0, 3]]
                    ).map(([p1, p2]) => (
                      <button
                        key={`${p1}-${p2}`}
                        type="button"
                        onClick={() => {
                          setInputSet1(String(p1));
                          setInputSet2(String(p2));
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{
                          fontSize: '0.75rem',
                          padding: '3px 8px',
                          background: (parseInt(inputSet1) === p1 && parseInt(inputSet2) === p2) ? 'var(--primary-color)' : undefined,
                          color: (parseInt(inputSet1) === p1 && parseInt(inputSet2) === p2) ? '#080b16' : undefined,
                          fontWeight: (parseInt(inputSet1) === p1 && parseInt(inputSet2) === p2) ? 'bold' : 'normal'
                        }}
                      >
                        {p1} - {p2}
                      </button>
                    ))}
                  </div>

                  {/* Action button & foto bukti */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {inputFotoBukti ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <img
                          src={inputFotoBukti}
                          alt="Bukti"
                          onClick={() => setPreviewImage(inputFotoBukti)}
                          style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border-light)' }}
                          title="Lihat Foto Bukti"
                        />
                        <button
                          type="button"
                          onClick={() => setInputFotoBukti('')}
                          style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '0.8rem' }}
                          title="Hapus Foto"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div>
                        <input
                          type="file"
                          id="quick-foto-input"
                          accept="image/*"
                          onChange={handleInputFotoUpload}
                          style={{ display: 'none' }}
                          disabled={isCompressingInputFoto}
                        />
                        <label
                          htmlFor="quick-foto-input"
                          className="btn btn-secondary btn-sm"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: isCompressingInputFoto ? 'wait' : 'pointer',
                            fontSize: '0.78rem',
                            padding: '6px 10px'
                          }}
                        >
                          {isCompressingInputFoto ? '⏳ Memproses...' : '📷 Foto Bukti'}
                        </label>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ fontSize: '0.88rem', padding: '8px 16px', fontWeight: 'bold' }}
                      disabled={!inputPeserta1Id || !inputPeserta2Id || inputSet1 === '' || inputSet2 === '' || parseInt(inputSet1) === parseInt(inputSet2)}
                    >
                      💾 Simpan Hasil Pertandingan
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* List of Weeks / Match Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {(league.jadwal || [])
              .filter(p => selectedPekan === 'semua' || p.id === selectedPekan)
              .map((pekan, pIdx) => {
                const pInfo = getPekanInfo(pekan, pIdx);
                const resultMatches = (pekan.pertandingan || []).filter(m => !m.isBye && (m.selesai || (m.skor && m.skor.length > 0)));
                const byeMatches = (pekan.pertandingan || []).filter(m => m.isBye);
                const weekDateRange = pInfo.rentang;

                return (
                  <div key={pekan.id} className="card" style={{ padding: '0', overflow: 'hidden' }}>
                    {/* Week Header */}
                    <div style={{
                      padding: '14px 20px',
                      background: 'rgba(0, 200, 255, 0.08)',
                      borderBottom: '1px solid var(--border-light)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.2rem' }}>📅</span>
                        <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.15rem' }}>
                          {pInfo.cleanName} <span style={{ color: 'var(--primary-color)', fontSize: '0.95rem', fontWeight: 'bold' }}>({weekDateRange})</span>
                        </h4>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          Hasil Pertandingan: <strong style={{ color: 'var(--success-color)' }}>{resultMatches.length}</strong> Partai Selesai
                        </span>
                      </div>
                    </div>

                    {/* Match Result Cards */}
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {resultMatches.length === 0 && (
                        <div style={{
                          textAlign: 'center',
                          padding: '30px 16px',
                          color: 'var(--text-muted)',
                          background: 'var(--bg-surface)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px dashed var(--border-light)'
                        }}>
                          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🏓</div>
                          <div style={{ fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            Belum ada hasil pertandingan yang dicatat untuk {pInfo.cleanName}.
                          </div>
                          {canManage && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--primary-color)' }}>
                              Gunakan kartu input di atas untuk mencatat hasil pertandingan pekan ini.
                            </div>
                          )}
                        </div>
                      )}

                      {resultMatches.map((m) => {
                        const isP1Winner = m.selesai && m.pemenang === m.peserta1?.id;
                        const isP2Winner = m.selesai && m.pemenang === m.peserta2?.id;
                        const [p1Sets, p2Sets] = parseMatchScore(m.skor);

                        return (
                          <div
                            key={m.id}
                            style={{
                              padding: '16px 18px',
                              borderRadius: 'var(--radius-md)',
                              background: 'var(--bg-surface-elevated)',
                              border: '1px solid var(--border-light)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px'
                            }}
                          >
                            {/* Top Row: Meja, Tanggal, Jam, Wasit */}
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '10px',
                              paddingBottom: '10px',
                              borderBottom: '1px solid var(--border-light)',
                              fontSize: '0.82rem'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                                  🏓 {m.meja || 'Meja 1'}
                                </span>
                                <span style={{ color: 'var(--text-secondary)' }}>
                                  📅 {m.tanggal ? formatTanggal(m.tanggal) : weekDateRange}
                                </span>
                                <span style={{ color: 'var(--text-secondary)' }}>
                                  ⏰ {m.jam && m.jam !== 'Bebas' ? `${m.jam} WIB` : 'Waktu Bebas'}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>👨‍⚖️ Wasit:</span>
                                <span style={{ fontWeight: '500', color: m.wasit ? 'var(--warning-color)' : 'var(--text-muted)' }}>
                                  {m.wasit?.nama ? `${m.wasit.nama} (${m.wasit.namaPTM})` : 'Tanpa Wasit'}
                                </span>
                              </div>
                            </div>

                            {/* Middle Row: Player 1 vs Player 2 */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '12px'
                            }}>
                              {/* Player 1 */}
                              <div style={{ flex: 1, minWidth: '160px', textAlign: 'right' }}>
                                <div style={{ fontWeight: isP1Winner ? 'bold' : '500', color: isP1Winner ? 'var(--primary-color)' : 'var(--text-primary)', fontSize: '1rem' }}>
                                  {isP1Winner && '👑 '} {m.peserta1?.nama || 'Pemain 1'}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                  {m.peserta1?.namaPTM || '-'} {m.peserta1?.divisi ? `(Div ${m.peserta1.divisi})` : ''}
                                </div>
                              </div>

                              {/* Score Box */}
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                minWidth: '100px',
                                padding: '6px 16px',
                                background: 'var(--bg-surface)',
                                borderRadius: '8px',
                                border: '1px solid var(--border-light)'
                              }}>
                                <div style={{ fontSize: '1.4rem', fontWeight: '900', letterSpacing: '2px', color: 'var(--text-primary)' }}>
                                  {p1Sets} - {p2Sets}
                                </div>
                                <span style={{ fontSize: '0.68rem', color: 'var(--success-color)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                  Selesai
                                </span>
                              </div>

                              {/* Player 2 */}
                              <div style={{ flex: 1, minWidth: '160px', textAlign: 'left' }}>
                                <div style={{ fontWeight: isP2Winner ? 'bold' : '500', color: isP2Winner ? 'var(--primary-color)' : 'var(--text-primary)', fontSize: '1rem' }}>
                                  {m.peserta2?.nama || 'Pemain 2'} {isP2Winner && ' 👑'}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                  {m.peserta2?.namaPTM || '-'} {m.peserta2?.divisi ? `(Div ${m.peserta2.divisi})` : ''}
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                {m.fotoBukti && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewImage(m.fotoBukti)}
                                    className="btn btn-sm btn-secondary"
                                    style={{
                                      fontSize: '0.8rem',
                                      padding: '6px 10px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      background: 'rgba(0, 200, 255, 0.1)',
                                      borderColor: 'rgba(0, 200, 255, 0.3)',
                                      color: 'var(--primary-color)'
                                    }}
                                    title="Lihat Foto Bukti Pertandingan"
                                  >
                                    📷 Bukti
                                  </button>
                                )}
                                {canManage && (
                                  <button
                                    onClick={() => handleOpenScoreModal(pekan, m)}
                                    className="btn btn-sm btn-secondary"
                                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                                  >
                                    ✏️ Edit Skor
                                  </button>
                                )}
                                <button
                                  onClick={() => handleOpenScoreboard(pekan, m)}
                                  className="btn btn-secondary btn-sm"
                                  title="Papan Skor Digital Langsung"
                                  style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                                >
                                  📺 Scoreboard
                                </button>
                                {canManage && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMatch(pekan.id, m.id)}
                                    className="btn btn-secondary btn-sm"
                                    title="Hapus Hasil Pertandingan"
                                    style={{ fontSize: '0.8rem', padding: '6px 8px', color: 'var(--danger-color)' }}
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* BYE Notices */}
                      {byeMatches.map(m => (
                        <div
                          key={m.id}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '6px',
                            background: 'rgba(245, 158, 11, 0.08)',
                            border: '1px solid rgba(245, 158, 11, 0.2)',
                            color: 'var(--warning-color)',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          <span>☕</span> {m.catatan}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 3: STATISTIK */}
      {activeTab === 'statistik' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1.25rem' }}>
          {/* Ringkasan Liga Card */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', fontSize: '1.2rem' }}>
              📊 Ringkasan Liga
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Pertandingan</span>
                <strong>{stats?.totalMatches || 0} Partai</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Pertandingan Selesai</span>
                <strong style={{ color: 'var(--success-color)' }}>{stats?.finishedMatches || 0} Partai</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Sisa Pertandingan</span>
                <strong style={{ color: 'var(--warning-color)' }}>{stats?.remainingMatches || 0} Partai</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Set Dimainkan</span>
                <strong>{stats?.totalSets || 0} Set</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Poin Angka Tercipta</span>
                <strong>{stats?.totalPoints || 0} Poin</strong>
              </div>
            </div>
          </div>

          {/* Top Performer Card */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', fontSize: '1.2rem' }}>
              🥇 Top Klasemen Sementara
            </h3>
            {league.klasemen && league.klasemen.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {league.klasemen.slice(0, 3).map((p, idx) => (
                  <div
                    key={p.pesertaId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-light)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.4rem' }}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                      <div>
                        <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{p.nama}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.namaPTM}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary-color)', fontSize: '1.1rem' }}>{p.poin} PTS</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.menang}M - {p.kalah}K</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>Belum ada data statistik.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: PENGATURAN (ADMIN ONLY) */}
      {activeTab === 'pengaturan' && canManage && (
        <div className="card" style={{ padding: '24px', maxWidth: '650px' }}>
          <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', fontSize: '1.3rem' }}>
            ⚙️ Pengaturan & Kelola Liga
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-light)'
            }}>
              <h4 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)' }}>Status Kompetisi</h4>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Status saat ini: <strong style={{ textTransform: 'uppercase', color: league.status === 'selesai' ? 'var(--success-color)' : 'var(--primary-color)' }}>{league.status}</strong>
              </p>
              <button
                onClick={handleToggleSelesaiLiga}
                className={`btn ${league.status === 'selesai' ? 'btn-secondary' : 'btn-primary'}`}
              >
                {league.status === 'selesai' ? '🔄 Aktifkan Kembali Liga' : '🏆 Selesaikan Liga Secara Resmi'}
              </button>
            </div>

            <div style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(244, 63, 94, 0.08)',
              border: '1px solid rgba(244, 63, 94, 0.25)'
            }}>
              <h4 style={{ margin: '0 0 6px 0', color: 'var(--danger-color)' }}>Zona Bahaya</h4>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Menghapus liga akan menghapus semua jadwal pekan, pertandingan, dan riwayat klasemen secara permanen.
              </p>
              <button onClick={handleDeleteLeague} className="btn btn-secondary" style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}>
                🗑️ Hapus Liga Ini
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INPUT SKOR PER SET */}
      {showScoreModal && activeMatch && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div className="card fade-in" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', padding: '20px', background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Input Skor Pertandingan</h3>
              <button onClick={() => setShowScoreModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}>
                ✕
              </button>
            </div>

            {/* Pemain 1 & 2 Pulldowns in Modal */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 'bold', marginBottom: '4px' }}>
                  Pemain 1
                </label>
                <select
                  className="input"
                  value={modalPeserta1Id}
                  onChange={(e) => setModalPeserta1Id(e.target.value)}
                  style={{ fontWeight: 'bold', fontSize: '0.85rem' }}
                >
                  {(league.peserta || []).map(p => (
                    <option key={p.id} value={p.id}>{p.nama} ({p.namaPTM})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--secondary-color)', fontWeight: 'bold', marginBottom: '4px' }}>
                  Pemain 2
                </label>
                <select
                  className="input"
                  value={modalPeserta2Id}
                  onChange={(e) => setModalPeserta2Id(e.target.value)}
                  style={{ fontWeight: 'bold', fontSize: '0.85rem' }}
                >
                  {(league.peserta || []).map(p => (
                    <option key={p.id} value={p.id}>{p.nama} ({p.namaPTM})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Wasit, Meja, Tanggal, Jam */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              padding: '12px',
              borderRadius: '8px',
              background: 'var(--bg-surface-elevated)',
              marginBottom: '16px'
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                  👨‍⚖️ Wasit (Pemain)
                </label>
                <select
                  className="input"
                  value={modalWasitId}
                  onChange={(e) => setModalWasitId(e.target.value)}
                  style={{ fontSize: '0.8rem' }}
                >
                  <option value="">-- Tanpa Wasit --</option>
                  {(league.peserta || []).map(p => (
                    <option key={p.id} value={p.id}>{p.nama} ({p.namaPTM})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                  🏓 Meja
                </label>
                <select
                  className="input"
                  value={modalMeja}
                  onChange={(e) => setModalMeja(e.target.value)}
                  style={{ fontSize: '0.8rem' }}
                >
                  <option value="Meja 1">Meja 1</option>
                  <option value="Meja 2">Meja 2</option>
                  <option value="Meja 3">Meja 3</option>
                  <option value="Meja 4">Meja 4</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                  📅 Tanggal Main
                </label>
                <input
                  type="date"
                  className="input"
                  value={modalTanggal}
                  onChange={(e) => setModalTanggal(e.target.value)}
                  style={{ fontSize: '0.8rem' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>⏰ Waktu</label>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      setModalJam(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    ⚡ Jam Sekarang
                  </button>
                </div>
                <input
                  type="text"
                  className="input"
                  placeholder="Bebas"
                  value={modalJam}
                  onChange={(e) => setModalJam(e.target.value)}
                  style={{ fontSize: '0.8rem' }}
                />
              </div>
            </div>

            {/* Set Score Inputs Box */}
            <div style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '18px 16px',
              marginBottom: '16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Jumlah Set yang Dimenangkan ({league.formatSet === 'best_of_3' ? 'Best of 3 Sets' : 'Best of 5 Sets'})
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                {/* Pemain 1 Set Input */}
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    fontWeight: 'bold',
                    fontSize: '0.95rem',
                    color: (parseInt(modalSet1) > parseInt(modalSet2)) ? 'var(--color-success)' : 'var(--primary-color)',
                    marginBottom: '8px',
                    minHeight: '2.4em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: '1.2'
                  }}>
                    {league.peserta?.find(p => p.id === modalPeserta1Id)?.nama || activeMatch.peserta1?.nama || 'Pemain 1'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ width: '36px', height: '36px', padding: 0, fontSize: '1.2rem', fontWeight: 'bold' }}
                      onClick={() => setModalSet1(String(Math.max(0, (parseInt(modalSet1) || 0) - 1)))}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      max="9"
                      className="input"
                      style={{
                        width: '64px',
                        height: '52px',
                        fontSize: '1.8rem',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        color: (parseInt(modalSet1) > parseInt(modalSet2)) ? 'var(--color-success)' : 'var(--primary-color)'
                      }}
                      value={modalSet1}
                      onChange={(e) => setModalSet1(e.target.value)}
                      placeholder="0"
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ width: '36px', height: '36px', padding: 0, fontSize: '1.2rem', fontWeight: 'bold' }}
                      onClick={() => setModalSet1(String((parseInt(modalSet1) || 0) + 1))}
                    >
                      +
                    </button>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Set Menang</div>
                </div>

                {/* VS Divider */}
                <div style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-muted)', padding: '0 4px', marginTop: '16px' }}>
                  :
                </div>

                {/* Pemain 2 Set Input */}
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    fontWeight: 'bold',
                    fontSize: '0.95rem',
                    color: (parseInt(modalSet2) > parseInt(modalSet1)) ? 'var(--color-success)' : 'var(--secondary-color)',
                    marginBottom: '8px',
                    minHeight: '2.4em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: '1.2'
                  }}>
                    {league.peserta?.find(p => p.id === modalPeserta2Id)?.nama || activeMatch.peserta2?.nama || 'Pemain 2'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ width: '36px', height: '36px', padding: 0, fontSize: '1.2rem', fontWeight: 'bold' }}
                      onClick={() => setModalSet2(String(Math.max(0, (parseInt(modalSet2) || 0) - 1)))}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      max="9"
                      className="input"
                      style={{
                        width: '64px',
                        height: '52px',
                        fontSize: '1.8rem',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        color: (parseInt(modalSet2) > parseInt(modalSet1)) ? 'var(--color-success)' : 'var(--secondary-color)'
                      }}
                      value={modalSet2}
                      onChange={(e) => setModalSet2(e.target.value)}
                      placeholder="0"
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ width: '36px', height: '36px', padding: 0, fontSize: '1.2rem', fontWeight: 'bold' }}
                      onClick={() => setModalSet2(String((parseInt(modalSet2) || 0) + 1))}
                    >
                      +
                    </button>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Set Menang</div>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Pilihan Cepat Skor Set:</div>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {(league.formatSet === 'best_of_3' 
                    ? [[2, 0], [2, 1], [1, 2], [0, 2]]
                    : [[3, 0], [3, 1], [3, 2], [2, 3], [1, 3], [0, 3]]
                  ).map(([p1, p2]) => (
                    <button
                      key={`${p1}-${p2}`}
                      type="button"
                      onClick={() => {
                        setModalSet1(String(p1));
                        setModalSet2(String(p2));
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{
                        fontSize: '0.8rem',
                        padding: '4px 10px',
                        background: (parseInt(modalSet1) === p1 && parseInt(modalSet2) === p2) ? 'var(--primary-color)' : undefined,
                        color: (parseInt(modalSet1) === p1 && parseInt(modalSet2) === p2) ? '#080b16' : undefined,
                        fontWeight: (parseInt(modalSet1) === p1 && parseInt(modalSet2) === p2) ? 'bold' : 'normal'
                      }}
                    >
                      {p1} - {p2}
                    </button>
                  ))}
                </div>
              </div>

              {modalSet1 !== '' && modalSet2 !== '' && parseInt(modalSet1) !== parseInt(modalSet2) && (
                <div style={{
                  marginTop: '14px',
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'rgba(16,185,129,0.12)',
                  border: '1px solid var(--color-success)',
                  textAlign: 'center',
                  color: 'var(--color-success)',
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}>
                  🏆 Pemenang: {parseInt(modalSet1) > parseInt(modalSet2) 
                    ? (league.peserta?.find(p => p.id === modalPeserta1Id)?.nama || activeMatch.peserta1?.nama || 'Pemain 1')
                    : (league.peserta?.find(p => p.id === modalPeserta2Id)?.nama || activeMatch.peserta2?.nama || 'Pemain 2')
                  } ({modalSet1} - {modalSet2})
                </div>
              )}
            </div>

            {/* Upload Foto Bukti Pertandingan */}
            <div style={{
              marginBottom: '16px',
              padding: '12px',
              borderRadius: '8px',
              background: 'var(--bg-surface-elevated)',
              border: '1px dashed var(--border-color)'
            }}>
              {modalFotoBukti && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setModalFotoBukti('')}
                    style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 'bold' }}
                  >
                    🗑️ Hapus Foto
                  </button>
                </div>
              )}

              {modalFotoBukti ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img
                    src={modalFotoBukti}
                    alt="Bukti Pertandingan"
                    onClick={() => setPreviewImage(modalFotoBukti)}
                    style={{
                      width: '72px',
                      height: '72px',
                      objectFit: 'cover',
                      borderRadius: '6px',
                      border: '1px solid var(--border-light)',
                      cursor: 'pointer'
                    }}
                    title="Klik untuk melihat foto ukuran penuh"
                  />
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <div style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>
                      ✓ Foto Siap ({Math.round((modalFotoBukti.length * 0.75) / 1024)} KB)
                    </div>
                    <div
                      style={{ marginTop: '3px', cursor: 'pointer', color: 'var(--primary-color)', textDecoration: 'underline' }}
                      onClick={() => setPreviewImage(modalFotoBukti)}
                    >
                      🔍 Klik untuk melihat ukuran penuh
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    id="foto-bukti-input"
                    accept="image/*"
                    onChange={handleFotoUpload}
                    style={{ display: 'none' }}
                    disabled={isCompressingFoto}
                  />
                  <label
                    htmlFor="foto-bukti-input"
                    className="btn btn-secondary btn-sm"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: isCompressingFoto ? 'wait' : 'pointer',
                      padding: '8px 14px',
                      fontSize: '0.82rem',
                      fontWeight: '500'
                    }}
                  >
                    {isCompressingFoto ? '⏳ Mengompres Foto (≤ 130KB)...' : '📁 Upload Foto Bukti'}
                  </label>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setShowScoreModal(false)} className="btn btn-secondary">
                Batal
              </button>
              <button 
                type="button" 
                onClick={handleSaveScore} 
                className="btn btn-primary" 
                disabled={isCompressingFoto || modalSet1 === '' || modalSet2 === '' || parseInt(modalSet1) === parseInt(modalSet2)}
              >
                💾 Simpan Skor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN DIGITAL SCOREBOARD */}
      {showScoreboard && activeMatch && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: '#040711',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '24px',
          color: '#fff'
        }}>
          {/* Top Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.8rem' }}>🏓</span>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#fff' }}>Papan Skor Live: {league.nama}</h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {activeMatch.meja || 'Meja 1'} • {league.formatSet === 'best_of_3' ? 'Best of 3 Sets' : 'Best of 5 Sets'} • 👨‍⚖️ Wasit: {activeMatch.wasit?.nama ? `${activeMatch.wasit.nama} (${activeMatch.wasit.namaPTM})` : 'Tanpa Wasit'}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowScoreboard(false)}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#fff',
                fontSize: '1.2rem',
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              ✕ Tutup
            </button>
          </div>

          {/* Main Scoring Box: Split 2 Sides */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px',
            flex: 1,
            margin: '20px 0',
            alignItems: 'center'
          }}>
            {/* Player 1 Box */}
            <div style={{
              background: 'rgba(0, 200, 255, 0.08)',
              border: servingPlayer === 1 ? '3px solid var(--primary-color)' : '1px solid rgba(0, 200, 255, 0.2)',
              borderRadius: '20px',
              padding: '30px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              position: 'relative'
            }}>
              {servingPlayer === 1 && (
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  background: 'var(--primary-color)',
                  color: '#000',
                  fontWeight: 'bold',
                  fontSize: '0.8rem'
                }}>
                  SERVICE 🎾
                </div>
              )}
              <div>
                <h3 style={{ fontSize: '2rem', margin: '0 0 6px 0', color: '#fff' }}>{activeMatch.peserta1?.nama}</h3>
                <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{activeMatch.peserta1?.namaPTM}</div>
                <div style={{ marginTop: '10px', fontSize: '1.2rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>
                  Set Dimenangkan: {liveP1Sets}
                </div>
              </div>

              {/* Huge Score Digits */}
              <div
                onClick={() => handleScoreboardPoint(1)}
                style={{
                  fontSize: 'clamp(5rem, 15vw, 10rem)',
                  fontWeight: '900',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: 'var(--primary-color)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  lineHeight: '1'
                }}
              >
                {liveP1Score}
              </div>

              {/* Point Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => setLiveP1Score(Math.max(0, liveP1Score - 1))}
                  className="btn btn-secondary"
                  style={{ fontSize: '1.5rem', width: '60px', height: '60px', borderRadius: '50%' }}
                >
                  -
                </button>
                <button
                  onClick={() => handleScoreboardPoint(1)}
                  className="btn btn-primary"
                  style={{ fontSize: '1.5rem', width: '60px', height: '60px', borderRadius: '50%' }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Player 2 Box */}
            <div style={{
              background: 'rgba(168, 85, 247, 0.08)',
              border: servingPlayer === 2 ? '3px solid var(--secondary-color)' : '1px solid rgba(168, 85, 247, 0.2)',
              borderRadius: '20px',
              padding: '30px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              position: 'relative'
            }}>
              {servingPlayer === 2 && (
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  background: 'var(--secondary-color)',
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: '0.8rem'
                }}>
                  SERVICE 🎾
                </div>
              )}
              <div>
                <h3 style={{ fontSize: '2rem', margin: '0 0 6px 0', color: '#fff' }}>{activeMatch.peserta2?.nama}</h3>
                <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{activeMatch.peserta2?.namaPTM}</div>
                <div style={{ marginTop: '10px', fontSize: '1.2rem', color: 'var(--secondary-color)', fontWeight: 'bold' }}>
                  Set Dimenangkan: {liveP2Sets}
                </div>
              </div>

              {/* Huge Score Digits */}
              <div
                onClick={() => handleScoreboardPoint(2)}
                style={{
                  fontSize: 'clamp(5rem, 15vw, 10rem)',
                  fontWeight: '900',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: 'var(--secondary-color)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  lineHeight: '1'
                }}
              >
                {liveP2Score}
              </div>

              {/* Point Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => setLiveP2Score(Math.max(0, liveP2Score - 1))}
                  className="btn btn-secondary"
                  style={{ fontSize: '1.5rem', width: '60px', height: '60px', borderRadius: '50%' }}
                >
                  -
                </button>
                <button
                  onClick={() => handleScoreboardPoint(2)}
                  className="btn btn-primary"
                  style={{ fontSize: '1.5rem', width: '60px', height: '60px', borderRadius: '50%' }}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Controls & Set History */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Riwayat Set:</span>
              {liveHistory.map((s, i) => (
                <span
                  key={i}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    fontWeight: 'bold',
                    fontSize: '0.9rem'
                  }}
                >
                  Set {i + 1}: {s[0]} - {s[1]}
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setServingPlayer(servingPlayer === 1 ? 2 : 1)}
                className="btn btn-secondary btn-sm"
              >
                🔄 Ganti Server
              </button>
              {canManage && (
                <button
                  onClick={handleSaveScoreboardResult}
                  className="btn btn-primary btn-sm"
                >
                  💾 Simpan Hasil Pertandingan
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Peserta */}
      {showAddPlayerModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div className="card fade-in" style={{
            width: '100%',
            maxWidth: '540px',
            maxHeight: '90vh',
            overflowY: 'auto',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>➕ Tambah Peserta Liga</h3>
              <button
                type="button"
                onClick={() => setShowAddPlayerModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Mode Selector */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setAddMode('master')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: addMode === 'master' ? '1px solid var(--primary-color)' : '1px solid var(--border-light)',
                  background: addMode === 'master' ? 'rgba(0, 200, 255, 0.15)' : 'transparent',
                  color: addMode === 'master' ? 'var(--primary-color)' : 'var(--text-secondary)',
                  fontWeight: addMode === 'master' ? 'bold' : 'normal',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                📋 Dari Database Member
              </button>
              <button
                type="button"
                onClick={() => setAddMode('custom')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: addMode === 'custom' ? '1px solid var(--primary-color)' : '1px solid var(--border-light)',
                  background: addMode === 'custom' ? 'rgba(0, 200, 255, 0.15)' : 'transparent',
                  color: addMode === 'custom' ? 'var(--primary-color)' : 'var(--text-secondary)',
                  fontWeight: addMode === 'custom' ? 'bold' : 'normal',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                ✍️ Input Manual Baru
              </button>
            </div>

            <form onSubmit={handleAddPlayerSubmit}>
              {addMode === 'master' ? (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>
                    Pilih Member Terdaftar:
                  </label>
                  <select
                    className="form-select"
                    value={selectedMasterPlayerId}
                    onChange={(e) => setSelectedMasterPlayerId(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {masterPemainList.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nama || p.name} ({p.namaPTM || p.ownerPTM || 'Klub'}) - Divisi {p.divisi || '1'} {p.noHP ? `[${p.noHP}]` : ''}
                      </option>
                    ))}
                  </select>
                  {masterPemainList.length === 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--warning-color)', marginTop: '4px' }}>
                      Belum ada member di database. Silakan pilih "Input Manual Baru".
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Nama Pemain <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      placeholder="Contoh: Budi Santoso"
                      value={formPlayerNama}
                      onChange={(e) => setFormPlayerNama(e.target.value)}
                    />
                  </div>

                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Nomor HP</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Contoh: 08123456789"
                        value={formPlayerNoHP}
                        onChange={(e) => setFormPlayerNoHP(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Divisi</label>
                      <select
                        className="form-select"
                        value={formPlayerDivisi}
                        onChange={(e) => setFormPlayerDivisi(e.target.value)}
                      >
                        {['1', '2', '3', '4', '5'].map(d => (
                          <option key={d} value={d}>Divisi {d}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Nama PTM / Klub</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Contoh: PTM Surya"
                      value={formPlayerPTM}
                      onChange={(e) => setFormPlayerPTM(e.target.value)}
                    />
                  </div>

                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '15px' }}>
                    <div className="form-group">
                      <label className="form-label">🏓 Karet Forehand</label>
                      <select
                        className="form-select"
                        value={formPlayerKaretFH}
                        onChange={(e) => setFormPlayerKaretFH(e.target.value)}
                      >
                        <option value="">-- Pilih Karet FH --</option>
                        {KARET_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">🏓 Karet Backhand</label>
                      <select
                        className="form-select"
                        value={formPlayerKaretBH}
                        onChange={(e) => setFormPlayerKaretBH(e.target.value)}
                      >
                        <option value="">-- Pilih Karet BH --</option>
                        {KARET_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddPlayerModal(false)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  ➕ Tambahkan Peserta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Peserta */}
      {showEditPlayerModal && playerToEdit && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div className="card fade-in" style={{
            width: '100%',
            maxWidth: '540px',
            maxHeight: '90vh',
            overflowY: 'auto',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>✏️ Edit Data Peserta</h3>
              <button
                type="button"
                onClick={() => { setShowEditPlayerModal(false); setPlayerToEdit(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditPlayer}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Nama Pemain <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={formPlayerNama}
                  onChange={(e) => setFormPlayerNama(e.target.value)}
                />
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Nomor HP</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formPlayerNoHP}
                    onChange={(e) => setFormPlayerNoHP(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Divisi</label>
                  <select
                    className="form-select"
                    value={formPlayerDivisi}
                    onChange={(e) => setFormPlayerDivisi(e.target.value)}
                  >
                    {['1', '2', '3', '4', '5'].map(d => (
                      <option key={d} value={d}>Divisi {d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Nama PTM / Klub</label>
                <input
                  type="text"
                  className="form-input"
                  value={formPlayerPTM}
                  onChange={(e) => setFormPlayerPTM(e.target.value)}
                />
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '15px' }}>
                <div className="form-group">
                  <label className="form-label">🏓 Karet Forehand</label>
                  <select
                    className="form-select"
                    value={formPlayerKaretFH}
                    onChange={(e) => setFormPlayerKaretFH(e.target.value)}
                  >
                    <option value="">-- Pilih Karet FH --</option>
                    {KARET_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">🏓 Karet Backhand</label>
                  <select
                    className="form-select"
                    value={formPlayerKaretBH}
                    onChange={(e) => setFormPlayerKaretBH(e.target.value)}
                  >
                    <option value="">-- Pilih Karet BH --</option>
                    {KARET_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => { setShowEditPlayerModal(false); setPlayerToEdit(null); }}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  💾 Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULLSCREEN IMAGE LIGHTBOX PREVIEW */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(6px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 3000,
            padding: '16px',
            cursor: 'zoom-out'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '92vh',
              background: 'var(--bg-surface)',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid var(--border-light)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                📷 Foto Bukti Pertandingan
              </span>
              <button
                onClick={() => setPreviewImage(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  padding: '4px 10px'
                }}
              >
                ✕ Tutup
              </button>
            </div>
            <img
              src={previewImage}
              alt="Foto Bukti Ukuran Penuh"
              style={{
                maxWidth: '100%',
                maxHeight: '78vh',
                objectFit: 'contain',
                borderRadius: '8px',
                border: '1px solid var(--border-light)'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default LeagueDetail;

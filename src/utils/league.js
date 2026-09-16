import { generateId, acakArray, formatRentangTanggal, parseMatchScore } from './helpers';
import { tentukanPemenang } from './tournament';

/**
 * Generate Berger / Polygon Round Robin Schedule
 * @param {Array} pesertaList - List of participants { id, nama, namaPTM, ... }
 * @param {Object} options - { putaran: 1 | 2, tanggalMulai: 'YYYY-MM-DD', intervalHari: 7, jumlahMeja: 2, jamDefault: 'Bebas' }
 * @returns {Array} List of weeks/pekan with matches
 */
export function generateLeagueSchedule(pesertaList, options = {}) {
  const { putaran = 1, tanggalMulai = '2026-09-13', intervalHari = 7, jumlahMeja = 2, jamDefault = 'Bebas' } = options;
  if (!pesertaList || pesertaList.length < 2) return [];

  const participants = [...pesertaList];
  const isOdd = participants.length % 2 !== 0;
  
  // If odd, add a dummy BYE participant
  if (isOdd) {
    participants.push({ id: '__BYE__', nama: 'BYE (Istirahat)', namaPTM: '-' });
  }

  const n = participants.length;
  const totalRoundsPerLeg = n - 1;
  const matchesPerRound = n / 2;
  const jadwal = [];

  const startDate = tanggalMulai ? new Date(tanggalMulai) : new Date('2026-09-13');

  // Berger circle method
  // Fix position 0, rotate positions 1 to n-1
  const roundPairs = [];
  for (let r = 0; r < totalRoundsPerLeg; r++) {
    const roundMatches = [];
    for (let m = 0; m < matchesPerRound; m++) {
      let p1Idx, p2Idx;
      if (m === 0) {
        p1Idx = 0;
        p2Idx = (totalRoundsPerLeg - r) % totalRoundsPerLeg + 1;
      } else {
        p1Idx = (r + m) % totalRoundsPerLeg + 1;
        p2Idx = (r + totalRoundsPerLeg - m) % totalRoundsPerLeg + 1;
      }

      // Alternate home/away for the fixed player to balance
      let home = participants[p1Idx];
      let away = participants[p2Idx];
      if (m === 0 && r % 2 === 1) {
        [home, away] = [away, home];
      }

      // Skip match if one of them is BYE
      if (home.id === '__BYE__' || away.id === '__BYE__') {
        const activePlayer = home.id === '__BYE__' ? away : home;
        roundMatches.push({
          id: generateId(),
          isBye: true,
          peserta1: activePlayer,
          peserta2: null,
          wasit: null,
          pemenang: null,
          selesai: true,
          skor: [],
          catatan: `${activePlayer.nama} mendapat BYE (Istirahat pekan ini)`
        });
      } else {
        const tableNum = (m % jumlahMeja) + 1;
        roundMatches.push({
          id: generateId(),
          isBye: false,
          peserta1: home,
          peserta2: away,
          wasit: null,
          skor: [],
          pemenang: null,
          selesai: false,
          meja: `Meja ${tableNum}`,
          jam: jamDefault || 'Bebas',
          catatan: ''
        });
      }
    }
    roundPairs.push(roundMatches);
  }

  let pekanCounter = 1;

  // Putaran 1
  for (let r = 0; r < roundPairs.length; r++) {
    const startWeekDate = new Date(startDate);
    startWeekDate.setDate(startDate.getDate() + (pekanCounter - 1) * intervalHari);
    const startStr = startWeekDate.toISOString().split('T')[0];

    const endWeekDate = new Date(startWeekDate);
    endWeekDate.setDate(startWeekDate.getDate() + 6);
    const endStr = endWeekDate.toISOString().split('T')[0];

    const rentang = formatRentangTanggal(startStr, endStr);

    jadwal.push({
      id: generateId(),
      pekan: pekanCounter,
      nama: `Pekan ${pekanCounter}`,
      putaran: 1,
      tanggal: startStr,
      tanggalMulai: startStr,
      tanggalSelesai: endStr,
      rentangTanggal: rentang,
      pertandingan: roundPairs[r].map(m => ({
        ...m,
        pekan: pekanCounter,
        tanggal: m.tanggal || startStr
      }))
    });
    pekanCounter++;
  }

  // Putaran 2 (Home & Away - Reverse Fixture)
  if (putaran === 2) {
    for (let r = 0; r < roundPairs.length; r++) {
      const startWeekDate = new Date(startDate);
      startWeekDate.setDate(startDate.getDate() + (pekanCounter - 1) * intervalHari);
      const startStr = startWeekDate.toISOString().split('T')[0];

      const endWeekDate = new Date(startWeekDate);
      endWeekDate.setDate(startWeekDate.getDate() + 6);
      const endStr = endWeekDate.toISOString().split('T')[0];

      const rentang = formatRentangTanggal(startStr, endStr);

      const reversedMatches = roundPairs[r].map(m => {
        if (m.isBye) {
          return {
            ...m,
            id: generateId(),
            pekan: pekanCounter,
            tanggal: startStr
          };
        }
        return {
          id: generateId(),
          isBye: false,
          pekan: pekanCounter,
          peserta1: m.peserta2, // Swap Home/Away
          peserta2: m.peserta1,
          wasit: null,
          skor: [],
          pemenang: null,
          selesai: false,
          meja: m.meja,
          tanggal: startStr,
          jam: m.jam,
          catatan: ''
        };
      });

      jadwal.push({
        id: generateId(),
        pekan: pekanCounter,
        nama: `Pekan ${pekanCounter}`,
        putaran: 2,
        tanggal: startStr,
        tanggalMulai: startStr,
        tanggalSelesai: endStr,
        rentangTanggal: rentang,
        pertandingan: reversedMatches
      });
      pekanCounter++;
    }
  }

  return jadwal;
}

/**
 * Initialize / calculate Standings (Klasemen) for League
 * @param {Array} pesertaList - List of real participants (without BYE)
 * @param {Array} jadwal - List of weeks with matches
 * @param {Object} options - { poinMenang: 3 | 2, poinKalah: 0 | 1 }
 * @returns {Array} Sorted standings
 */
export function hitungKlasemenLiga(pesertaList, jadwal = [], options = {}) {
  const { poinMenang = 3, poinKalah = 0 } = options;
  if (!pesertaList) return [];

  const realPeserta = pesertaList.filter(p => p.id !== '__BYE__');

  const standingsMap = {};
  realPeserta.forEach(p => {
    standingsMap[p.id] = {
      pesertaId: p.id,
      nama: p.nama,
      namaPTM: p.namaPTM || p.ownerPTM || '-',
      tipe: p.pemain1 ? 'Double' : 'Single',
      pemain1: p.pemain1 || null,
      pemain2: p.pemain2 || null,
      main: 0,
      menang: 0,
      kalah: 0,
      poin: 0,
      setMenang: 0,
      setKalah: 0,
      selisihSet: 0,
      poinMenang: 0,
      poinKalah: 0,
      selisihPoin: 0,
      form: [] // 'W' or 'L' for matches in chronological order
    };
  });

  // Traverse matches in chronological order (by pekan)
  (jadwal || []).forEach(pekan => {
    (pekan.pertandingan || []).forEach(match => {
      if (match.selesai && match.pemenang && !match.isBye) {
        const p1Id = match.peserta1?.id;
        const p2Id = match.peserta2?.id;

        if (!standingsMap[p1Id] || !standingsMap[p2Id]) return;

        standingsMap[p1Id].main += 1;
        standingsMap[p2Id].main += 1;

        const [p1Set, p2Set] = parseMatchScore(match.skor);

        standingsMap[p1Id].setMenang += p1Set;
        standingsMap[p1Id].setKalah += p2Set;

        standingsMap[p2Id].setMenang += p2Set;
        standingsMap[p2Id].setKalah += p1Set;

        if (match.pemenang === p1Id) {
          standingsMap[p1Id].menang += 1;
          standingsMap[p1Id].poin += Number(poinMenang);
          standingsMap[p1Id].form.push('W');

          standingsMap[p2Id].kalah += 1;
          standingsMap[p2Id].poin += Number(poinKalah);
          standingsMap[p2Id].form.push('L');
        } else if (match.pemenang === p2Id) {
          standingsMap[p2Id].menang += 1;
          standingsMap[p2Id].poin += Number(poinMenang);
          standingsMap[p2Id].form.push('W');

          standingsMap[p1Id].kalah += 1;
          standingsMap[p1Id].poin += Number(poinKalah);
          standingsMap[p1Id].form.push('L');
        }
      }
    });
  });

  // Calculate differences
  const standingsArray = Object.values(standingsMap).map(s => {
    s.selisihSet = s.setMenang - s.setKalah;
    s.selisihPoin = s.poinMenang - s.poinKalah;
    // Keep last 5 form items
    s.last5Form = s.form.slice(-5);
    return s;
  });

  // Sort Standings:
  // 1. Poin Liga (PTS) (desc)
  // 2. Selisih Set (desc)
  // 3. Selisih Poin (desc)
  // 4. Set Menang (desc)
  // 5. Nama (asc)
  standingsArray.sort((a, b) => {
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
  });

  return standingsArray.map((item, index) => ({
    ...item,
    posisi: index + 1
  }));
}

/**
 * Calculate statistical summary of a league
 */
export function calculateLeagueStats(liga) {
  if (!liga) return null;

  let totalMatches = 0;
  let finishedMatches = 0;
  let totalSets = 0;
  let totalPoints = 0;

  (liga.jadwal || []).forEach(pekan => {
    (pekan.pertandingan || []).forEach(m => {
      if (!m.isBye) {
        totalMatches++;
        if (m.selesai) {
          finishedMatches++;
          const [s1, s2] = parseMatchScore(m.skor);
          totalSets += (s1 + s2);
        }
      }
    });
  });

  const progressPercent = totalMatches > 0 ? Math.round((finishedMatches / totalMatches) * 100) : 0;
  const standings = liga.klasemen || [];
  const topLeader = standings.length > 0 ? standings[0] : null;

  return {
    totalMatches,
    finishedMatches,
    remainingMatches: totalMatches - finishedMatches,
    progressPercent,
    totalSets,
    totalPoints,
    topLeader,
    totalPeserta: (liga.peserta || []).length,
    totalPekan: (liga.jadwal || []).length
  };
}

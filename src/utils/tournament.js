import { generateId, acakArray } from './helpers';

export function buatPools(pesertaList) {
  const shuffled = acakArray(pesertaList);
  const pools = [];
  let poolIndex = 0;
  
  for (let i = 0; i < shuffled.length; i += 3) {
    let poolParticipants = shuffled.slice(i, i + 3);
    
    const namaPool = 'Pool ' + String.fromCharCode(65 + poolIndex); // Pool A, B, dll
    const pertandingan = generateRoundRobin(poolParticipants);
    const klasemen = poolParticipants.map(p => ({
      pesertaId: p.id,
      menang: 0,
      kalah: 0,
      poin: 0,
      setMenang: 0,
      setKalah: 0,
      poinMenang: 0,
      poinKalah: 0
    }));

    pools.push({
      id: generateId(),
      nama: namaPool,
      peserta: poolParticipants,
      pertandingan,
      klasemen
    });
    poolIndex++;
  }
  return pools;
}

export function generateRoundRobin(pesertaList) {
  const matches = [];
  for (let i = 0; i < pesertaList.length; i++) {
    for (let j = i + 1; j < pesertaList.length; j++) {
      matches.push({
        id: generateId(),
        peserta1: pesertaList[i],
        peserta2: pesertaList[j],
        skor: [],
        pemenang: null,
        selesai: false
      });
    }
  }
  return matches;
}

export function updateKlasemen(pool) {
  pool.klasemen.forEach(k => {
    k.menang = 0;
    k.kalah = 0;
    k.poin = 0;
    k.setMenang = 0;
    k.setKalah = 0;
    k.poinMenang = 0;
    k.poinKalah = 0;
  });

  const klasemenMap = {};
  pool.klasemen.forEach(k => {
    klasemenMap[k.pesertaId] = k;
  });

  pool.pertandingan.forEach(match => {
    if (match.selesai && match.pemenang) {
      const winnerId = match.pemenang;
      const loserId = winnerId === match.peserta1?.id ? match.peserta2?.id : match.peserta1?.id;
      
      let winnerSets = 0;
      let loserSets = 0;
      let winnerPoints = 0;
      let loserPoints = 0;
      
      match.skor.forEach(set => {
        const p1Score = parseInt(set[0]) || 0;
        const p2Score = parseInt(set[1]) || 0;
        
        if (winnerId === match.peserta1?.id) {
          winnerPoints += p1Score;
          loserPoints += p2Score;
          if (p1Score > p2Score) winnerSets++;
          else if (p2Score > p1Score) loserSets++;
        } else {
          winnerPoints += p2Score;
          loserPoints += p1Score;
          if (p2Score > p1Score) winnerSets++;
          else if (p1Score > p2Score) loserSets++;
        }
      });
      
      if (klasemenMap[winnerId]) {
        klasemenMap[winnerId].menang += 1;
        klasemenMap[winnerId].poin += 2; // Menang 2 poin
        klasemenMap[winnerId].setMenang += winnerSets;
        klasemenMap[winnerId].setKalah += loserSets;
        klasemenMap[winnerId].poinMenang += winnerPoints;
        klasemenMap[winnerId].poinKalah += loserPoints;
      }
      if (loserId && klasemenMap[loserId]) {
        klasemenMap[loserId].kalah += 1;
        klasemenMap[loserId].poin += 1; // Kalah 1 poin
        klasemenMap[loserId].setMenang += loserSets;
        klasemenMap[loserId].setKalah += winnerSets;
        klasemenMap[loserId].poinMenang += loserPoints;
        klasemenMap[loserId].poinKalah += winnerPoints;
      }
    }
  });

  // ITTF Tie-Breaker: Poin -> (H2H jika 2 pemain) -> Rasio Set -> Rasio Poin -> Random
  pool.klasemen.sort((a, b) => {
    if (b.poin !== a.poin) return b.poin - a.poin;
    
    // Head-to-Head for 2-way tie
    const tied = pool.klasemen.filter(k => k.poin === a.poin);
    if (tied.length === 2) {
       const h2h = pool.pertandingan.find(m => 
         m.selesai && 
         ((m.peserta1?.id === a.pesertaId && m.peserta2?.id === b.pesertaId) || 
          (m.peserta1?.id === b.pesertaId && m.peserta2?.id === a.pesertaId))
       );
       if (h2h && h2h.pemenang) {
         return h2h.pemenang === a.pesertaId ? -1 : 1;
       }
    }

    const setRatioA = a.setMenang - a.setKalah;
    const setRatioB = b.setMenang - b.setKalah;
    if (setRatioB !== setRatioA) return setRatioB - setRatioA;

    const pointRatioA = a.poinMenang - a.poinKalah;
    const pointRatioB = b.poinMenang - b.poinKalah;
    if (pointRatioB !== pointRatioA) return pointRatioB - pointRatioA;

    return Math.random() - 0.5;
  });
  
  return pool;
}

export function isPoolSelesai(pool) {
  if (!pool.pertandingan || pool.pertandingan.length === 0) return false;
  return pool.pertandingan.every(m => m.selesai);
}

export function getJuaraPool(pools) {
  return pools.map(pool => {
    if (pool.klasemen.length > 0) {
      const juaraId = pool.klasemen[0].pesertaId;
      return pool.peserta.find(p => p.id === juaraId);
    }
    return null;
  }).filter(Boolean);
}

export function buatBracket(juaraList) {
  let size = 1;
  while (size < juaraList.length) size *= 2;
  if (size < 2) size = 2;

  const M = size / 2;
  const round1Matches = [];
  for (let i = 0; i < M; i++) {
    round1Matches.push({
      id: generateId(),
      peserta1: null,
      peserta2: null,
      skor: [],
      pemenang: null,
      selesai: false
    });
  }

  const isOdd = juaraList.length % 2 !== 0 && juaraList.length > 1;

  if (isOdd) {
    const lastPlayer = juaraList[juaraList.length - 1];
    const others = juaraList.slice(0, juaraList.length - 1);
    const shuffledOthers = acakArray(others);

    round1Matches[M - 1].peserta1 = lastPlayer;
    round1Matches[M - 1].peserta2 = null;
    round1Matches[M - 1].pemenang = lastPlayer.id;
    round1Matches[M - 1].selesai = true;

    for (let i = 0; i < shuffledOthers.length; i++) {
      const matchIdx = i % (M - 1);
      if (i < M - 1) {
        round1Matches[matchIdx].peserta1 = shuffledOthers[i];
      } else {
        round1Matches[matchIdx].peserta2 = shuffledOthers[i];
      }
    }

    for (let i = 0; i < M - 1; i++) {
      const match = round1Matches[i];
      if (match.peserta1 && !match.peserta2) {
        match.pemenang = match.peserta1.id;
        match.selesai = true;
      } else if (!match.peserta1 && match.peserta2) {
        match.pemenang = match.peserta2.id;
        match.selesai = true;
      }
    }
  } else {
    const shuffled = acakArray(juaraList);
    for (let i = 0; i < shuffled.length; i++) {
      const matchIdx = i % M;
      if (i < M) {
        round1Matches[matchIdx].peserta1 = shuffled[i];
      } else {
        round1Matches[matchIdx].peserta2 = shuffled[i];
      }
    }

    for (let i = 0; i < M; i++) {
      const match = round1Matches[i];
      if (match.peserta1 && !match.peserta2) {
        match.pemenang = match.peserta1.id;
        match.selesai = true;
      } else if (!match.peserta1 && match.peserta2) {
        match.pemenang = match.peserta2.id;
        match.selesai = true;
      }
    }
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
        id: generateId(),
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

  for (let r = 0; r < rounds.length - 1; r++) {
    const currentRound = rounds[r].pertandingan;
    const nextRound = rounds[r + 1].pertandingan;
    
    for (let i = 0; i < currentRound.length; i++) {
      const match = currentRound[i];
      if (match.selesai && match.pemenang) {
        const nextMatchIdx = Math.floor(i / 2);
        const isPeserta1 = i % 2 === 0;
        const winner = match.pemenang === match.peserta1?.id ? match.peserta1 : match.peserta2;
        
        if (isPeserta1) {
          nextRound[nextMatchIdx].peserta1 = winner;
        } else {
          nextRound[nextMatchIdx].peserta2 = winner;
        }
      }
    }
  }

  return { rounds };
}

export function advancePemenang(bracket, matchId, pemenangId) {
  const newBracket = JSON.parse(JSON.stringify(bracket));
  
  for (let r = 0; r < newBracket.rounds.length; r++) {
    const round = newBracket.rounds[r].pertandingan;
    const matchIndex = round.findIndex(m => m.id === matchId);
    
    if (matchIndex !== -1) {
      const match = round[matchIndex];
      match.pemenang = pemenangId;
      match.selesai = true;
      
      const winner = match.peserta1?.id === pemenangId ? match.peserta1 : match.peserta2;
      
      if (r < newBracket.rounds.length - 1) {
        const nextRound = newBracket.rounds[r + 1].pertandingan;
        const nextMatchIdx = Math.floor(matchIndex / 2);
        const isPeserta1 = matchIndex % 2 === 0;
        
        if (isPeserta1) {
          nextRound[nextMatchIdx].peserta1 = winner;
        } else {
          nextRound[nextMatchIdx].peserta2 = winner;
        }
      }
      break;
    }
  }
  
  return newBracket;
}

export function tentukanPemenang(skor, requiredWins = 3) {
  if (!skor || skor.length === 0) return 0;
  
  let win1 = 0;
  let win2 = 0;
  
  skor.forEach(set => {
    const s1 = parseInt(set[0]) || 0;
    const s2 = parseInt(set[1]) || 0;
    
    if (s1 >= 11 && s1 - s2 >= 2) {
      win1++;
    } else if (s2 >= 11 && s2 - s1 >= 2) {
      win2++;
    }
  });

  if (win1 >= requiredWins) return 1;
  if (win2 >= requiredWins) return 2;
  
  return 0;
}

export function getNamaPeserta(peserta) {
  if (!peserta) return 'Belum Diketahui';
  if (peserta.pemain1 && peserta.pemain2) {
    return `${peserta.pemain1.nama} / ${peserta.pemain2.nama}`;
  } else if (peserta.pemain1) {
    return peserta.pemain1.nama;
  }
  return peserta.nama || 'Belum Diketahui';
}

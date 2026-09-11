import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { hitungKlasemenLiga } from './league';

const PEMAIN_COLLECTION = 'users';
const TURNAMEN_COLLECTION = 'turnamen';

// Firestore does not support nested arrays (e.g. skor: [[11,5],[11,6]])
// We convert: [[11,5],[11,6]] <-> [{a:11,b:5},{a:11,b:6}]
function convertMatchSkor(match, direction) {
  if (!match.skor || match.skor.length === 0) return match;
  if (direction === 'toFirestore') {
    // Convert array of arrays -> array of objects
    if (Array.isArray(match.skor[0])) {
      match.skor = match.skor.map(s => ({ a: s[0], b: s[1] }));
    }
  } else {
    // Convert array of objects -> array of arrays
    if (match.skor[0] && typeof match.skor[0] === 'object' && !Array.isArray(match.skor[0])) {
      match.skor = match.skor.map(s => [s.a ?? 0, s.b ?? 0]);
    }
  }
  return match;
}

function toFirestore(tournament) {
  const t = JSON.parse(JSON.stringify(tournament));
  if (t.pools) {
    t.pools.forEach(pool => {
      pool.pertandingan?.forEach(match => convertMatchSkor(match, 'toFirestore'));
    });
  }
  if (t.bracket?.rounds) {
    t.bracket.rounds.forEach(round => {
      round.pertandingan?.forEach(match => convertMatchSkor(match, 'toFirestore'));
    });
  }
  return t;
}

function fromFirestore(tournament) {
  if (!tournament) return null;
  const t = JSON.parse(JSON.stringify(tournament));
  if (t.pools) {
    t.pools.forEach(pool => {
      pool.pertandingan?.forEach(match => convertMatchSkor(match, 'fromFirestore'));
    });
  }
  if (t.bracket?.rounds) {
    t.bracket.rounds.forEach(round => {
      round.pertandingan?.forEach(match => convertMatchSkor(match, 'fromFirestore'));
    });
  }
  return t;
}

export async function getPemain() {
  const querySnapshot = await getDocs(collection(db, PEMAIN_COLLECTION));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Ambil daftar pemain sesuai scope user:
 *  - superadmin → semua pemain
 *  - admin      → pemain miliknya (ownerUid) ATAU PTM yang sama (ownerPTM)
 *  - player     → semua (read-only, hanya tampilan)
 */
export async function getPemainByScope({ isSuperAdmin, uid, ptm }) {
  const all = await getPemain();
  if (isSuperAdmin) return all;

  // admin & player: tampilkan pemain yang dibuat user (ownerUid), atau PTM yang sama, atau akun user sendiri
  return all.filter(p => {
    const memberPTM = (p.namaPTM || p.ownerPTM || '').trim().toLowerCase();
    const myPTM = (ptm || '').trim().toLowerCase();
    
    // Pemain yang dibuat oleh user ini atau akun miliknya sendiri
    if (p.ownerUid === uid || p.id === uid) return true;

    // Pemain dari PTM yang sama
    if (myPTM && memberPTM === myPTM) return true;

    return false;
  });
}

export async function addPemain(pemain) {
  const id = pemain.id;
  await setDoc(doc(db, PEMAIN_COLLECTION, id), pemain);
  return await getPemain();
}

export async function updatePemain(id, data) {
  await setDoc(doc(db, PEMAIN_COLLECTION, id), data, { merge: true });
  return await getPemain();
}

export async function deletePemain(id) {
  await deleteDoc(doc(db, PEMAIN_COLLECTION, id));
  return await getPemain();
}

/**
 * Otomatis mendaftarkan pemain baru ke koleksi Member (users) jika belum ada (mencegah duplikasi)
 */
export async function ensurePemainRegistered(playerList, currentUser) {
  if (!playerList || playerList.length === 0) return [];
  try {
    const existingPlayers = await getPemain();

    // Map existing normalized player names
    const existingMap = new Map();
    existingPlayers.forEach(p => {
      const name = (p.nama || p.name || '').trim().toLowerCase();
      if (name) {
        existingMap.set(name, p);
      }
    });

    const toAdd = [];
    const addedInBatch = new Set();

    playerList.forEach(item => {
      if (!item || !item.nama) return;

      // Handle split if composite name, e.g. "Budi / Joko"
      const rawNames = typeof item.nama === 'string' && item.nama.includes('/')
        ? item.nama.split('/')
        : [item.nama];

      rawNames.forEach(rawName => {
        const cleanName = (rawName || '').trim();
        if (!cleanName) return;

        // Skip generic placeholder names
        if (/^pemain tim [ab]$/i.test(cleanName) || /^ganda tim [ab]$/i.test(cleanName)) {
          return;
        }

        const normalized = cleanName.toLowerCase();
        if (!existingMap.has(normalized) && !addedInBatch.has(normalized)) {
          addedInBatch.add(normalized);
          const cleanPTM = (item.namaPTM || '').trim();
          const newPlayer = {
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
            nama: cleanName,
            namaPTM: cleanPTM,
            ownerPTM: cleanPTM,
            ownerUid: currentUser?.uid || '',
            role: 'player',
            noHP: '',
            divisi: '5',
            karetForehand: '',
            karetBackhand: '',
            pts: 0,
            statsPTS: {
              ikutSingle: 0,
              ikutDouble: 0,
              setMenang: 0,
              lolosPool: 0,
              juara: 0,
              finalist: 0,
              semifinalist: 0,
              quarterfinalist: 0
            },
            createdAt: new Date().toISOString()
          };
          toAdd.push(newPlayer);
          existingMap.set(normalized, newPlayer);
        }
      });
    });

    if (toAdd.length > 0) {
      const promises = toAdd.map(p => setDoc(doc(db, PEMAIN_COLLECTION, p.id), p));
      await Promise.all(promises);
      console.log(`[Auto-Register Member] Menambahkan ${toAdd.length} pemain baru ke daftar Member:`, toAdd.map(p => `${p.nama} (${p.namaPTM})`));
    }
    return toAdd;
  } catch (err) {
    console.error("Error auto-registering players:", err);
    return [];
  }
}

/**
 * Sinkronisasi seluruh pemain dari seluruh laga persahabatan ke daftar Member
 */
export async function syncFriendlyMatchPlayersToMembers(currentUser) {
  try {
    const matches = await getPersahabatan();
    const playersToRegister = [];

    matches.forEach(match => {
      const ptmAName = (match.ptmA?.nama || '').trim();
      const ptmBName = (match.ptmB?.nama || '').trim();

      (match.partai || []).forEach(p => {
        if (p.tipe === 'Single') {
          if (p.pemainA?.nama) playersToRegister.push({ nama: p.pemainA.nama, namaPTM: ptmAName });
          if (p.pemainB?.nama) playersToRegister.push({ nama: p.pemainB.nama, namaPTM: ptmBName });
        } else {
          if (p.pemainA?.pemain1?.nama) playersToRegister.push({ nama: p.pemainA.pemain1.nama, namaPTM: ptmAName });
          if (p.pemainA?.pemain2?.nama) playersToRegister.push({ nama: p.pemainA.pemain2.nama, namaPTM: ptmAName });
          if (p.pemainA?.nama) playersToRegister.push({ nama: p.pemainA.nama, namaPTM: ptmAName });

          if (p.pemainB?.pemain1?.nama) playersToRegister.push({ nama: p.pemainB.pemain1.nama, namaPTM: ptmBName });
          if (p.pemainB?.pemain2?.nama) playersToRegister.push({ nama: p.pemainB.pemain2.nama, namaPTM: ptmBName });
          if (p.pemainB?.nama) playersToRegister.push({ nama: p.pemainB.nama, namaPTM: ptmBName });
        }
      });
    });

    if (playersToRegister.length > 0) {
      await ensurePemainRegistered(playersToRegister, currentUser);
    }
  } catch (err) {
    console.error("Error syncing friendly match players to members:", err);
  }
}


export async function getTurnamen() {
  const querySnapshot = await getDocs(collection(db, TURNAMEN_COLLECTION));
  return querySnapshot.docs.map(d => fromFirestore({ id: d.id, ...d.data() }));
}

export async function addTurnamen(turnamen) {
  const id = turnamen.id;
  await setDoc(doc(db, TURNAMEN_COLLECTION, id), toFirestore(turnamen));
  await recalculatePTS();
  return await getTurnamen();
}

export async function updateTurnamen(id, data) {
  await setDoc(doc(db, TURNAMEN_COLLECTION, id), toFirestore(data));
  await recalculatePTS();
  return await getTurnamen();
}

export async function deleteTurnamen(id) {
  await deleteDoc(doc(db, TURNAMEN_COLLECTION, id));
  await recalculatePTS();
  return await getTurnamen();
}

// Automatically recalculate PTS for all users based on all tournament and league history
export async function recalculatePTS() {
  try {
    const pemainSnapshot = await getDocs(collection(db, PEMAIN_COLLECTION));
    const pemainList = pemainSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const tournamentsSnapshot = await getDocs(collection(db, TURNAMEN_COLLECTION));
    const tournaments = tournamentsSnapshot.docs.map(doc => fromFirestore({ id: doc.id, ...doc.data() }));

    let leagues = [];
    try {
      const leaguesSnapshot = await getDocs(collection(db, LIGA_COLLECTION));
      leagues = leaguesSnapshot.docs.map(doc => ligaFromFirestore({ id: doc.id, ...doc.data() }));
    } catch (lErr) {
      console.warn("[PTS] Warning reading leagues:", lErr);
    }

    const userPts = {};
    pemainList.forEach(u => {
      userPts[u.id] = {
        pts: 0,
        ptsTotal: 0,
        ptsTurnamen: 0,
        ptsLiga: 0,
        ikutSingle: 0,
        ikutDouble: 0,
        setMenang: 0,
        lolosPool: 0,
        juara: 0,
        finalist: 0,
        semifinalist: 0,
        quarterfinalist: 0,
        ligaMain: 0,
        ligaMenang: 0,
        ligaKalah: 0
      };
    });

    const isUserInParticipant = (p, userId) => {
      if (!p) return false;
      if (p.id === userId) return true;
      if (p.pemain1?.id === userId) return true;
      if (p.pemain2?.id === userId) return true;

      // Fallback name matching untuk data lama (sebelum migrasi)
      const userObj = pemainList.find(u => u.id === userId);
      if (userObj) {
        const uName = (userObj.nama || userObj.name || '').trim().toLowerCase();
        
        const isMatch = (tName) => {
          if (!tName) return false;
          return uName.startsWith(tName) || tName.startsWith(uName);
        };

        const pName = (p.nama || p.name || '').trim().toLowerCase();
        if (isMatch(pName)) return true;
        
        if (p.pemain1) {
            const p1Name = (p.pemain1.nama || p.pemain1.name || '').trim().toLowerCase();
            if (isMatch(p1Name)) return true;
        }
        if (p.pemain2) {
            const p2Name = (p.pemain2.nama || p.pemain2.name || '').trim().toLowerCase();
            if (isMatch(p2Name)) return true;
        }
      }
      return false;
    };

    // 1. Calculate PTS Turnamen
    tournaments.forEach(t => {
      const hasPeserta = t.peserta || [];
      pemainList.forEach(user => {
        const participated = hasPeserta.some(p => isUserInParticipant(p, user.id));
        if (participated) {
          userPts[user.id].ptsTurnamen += 10; // +10 PTS for participation
          if (t.tipe === 'Double') {
            userPts[user.id].ikutDouble += 1;
          } else {
            userPts[user.id].ikutSingle += 1;
          }
        }
      });

      const pools = t.pools || [];
      pools.forEach(pool => {
        const matches = pool.pertandingan || [];
        matches.forEach(m => {
          if (m.selesai && m.skor && m.skor.length > 0) {
            pemainList.forEach(user => {
              if (isUserInParticipant(m.peserta1, user.id)) {
                let sets = 0;
                m.skor.forEach(s => {
                  if (s[0] > s[1]) sets++;
                });
                userPts[user.id].setMenang += sets;
                userPts[user.id].ptsTurnamen += sets * 1; // +1 PTS per set won
              } else if (isUserInParticipant(m.peserta2, user.id)) {
                let sets = 0;
                m.skor.forEach(s => {
                  if (s[1] > s[0]) sets++;
                });
                userPts[user.id].setMenang += sets;
                userPts[user.id].ptsTurnamen += sets * 1; // +1 PTS per set won
              }
            });
          }
        });
      });

      if (t.bracket && t.bracket.rounds) {
        t.bracket.rounds.forEach((round, roundIdx) => {
          const matches = round.pertandingan || [];
          matches.forEach(m => {
            if (m.selesai && m.skor && m.skor.length > 0) {
              pemainList.forEach(user => {
                if (isUserInParticipant(m.peserta1, user.id)) {
                  let sets = 0;
                  m.skor.forEach(s => {
                    if (s[0] > s[1]) sets++;
                  });
                  userPts[user.id].setMenang += sets;
                  userPts[user.id].ptsTurnamen += sets * 1;
                } else if (isUserInParticipant(m.peserta2, user.id)) {
                  let sets = 0;
                  m.skor.forEach(s => {
                    if (s[1] > s[0]) sets++;
                  });
                  userPts[user.id].setMenang += sets;
                  userPts[user.id].ptsTurnamen += sets * 1;
                }
              });
            }
          });

          if (roundIdx === 0) {
            pemainList.forEach(user => {
              const inRound = matches.some(m => isUserInParticipant(m.peserta1, user.id) || isUserInParticipant(m.peserta2, user.id));
              if (inRound) {
                userPts[user.id].lolosPool += 1;
                userPts[user.id].ptsTurnamen += 15; // +15 PTS for passing pool stage
              }
            });
          }

          const roundName = round.nama || '';
          pemainList.forEach(user => {
            const inRound = matches.some(m => isUserInParticipant(m.peserta1, user.id) || isUserInParticipant(m.peserta2, user.id));
            if (inRound) {
              if (roundName === 'Perempat Final') {
                userPts[user.id].quarterfinalist += 1;
                userPts[user.id].ptsTurnamen += 10;
              } else if (roundName === 'Semi Final') {
                userPts[user.id].semifinalist += 1;
                userPts[user.id].ptsTurnamen += 20;
              } else if (roundName === 'Final') {
                userPts[user.id].finalist += 1;
                userPts[user.id].ptsTurnamen += 30;
              }
            }
          });
        });
      }

      if (t.juara) {
        pemainList.forEach(user => {
          if (isUserInParticipant(t.juara, user.id)) {
            userPts[user.id].juara += 1;
            userPts[user.id].ptsTurnamen += 50; // +50 PTS for champion
          }
        });
      }
    });

    // 2. Calculate PTS Liga from all leagues
    leagues.forEach(liga => {
      const klasemen = liga.klasemen || [];
      pemainList.forEach(user => {
        const uName = (user.nama || user.name || '').trim().toLowerCase();
        const standing = klasemen.find(k => 
          k.pesertaId === user.id || 
          (k.nama && k.nama.trim().toLowerCase() === uName)
        );
        if (standing) {
          userPts[user.id].ptsLiga += Number(standing.poin || 0);
          userPts[user.id].ligaMain += Number(standing.main || 0);
          userPts[user.id].ligaMenang += Number(standing.menang || 0);
          userPts[user.id].ligaKalah += Number(standing.kalah || 0);
        }
      });
    });

    // 3. Compute PTS Total = PTS Liga + PTS Turnamen & Save to Firestore
    const promises = pemainList.map(user => {
      const userRef = doc(db, PEMAIN_COLLECTION, user.id);
      const data = userPts[user.id];
      const totalPoints = data.ptsTurnamen + data.ptsLiga;
      data.pts = totalPoints;
      data.ptsTotal = totalPoints;

      return setDoc(userRef, {
        pts: totalPoints,
        ptsTotal: totalPoints,
        ptsLiga: data.ptsLiga,
        ptsTurnamen: data.ptsTurnamen,
        statsPTS: {
          ptsTotal: totalPoints,
          ptsLiga: data.ptsLiga,
          ptsTurnamen: data.ptsTurnamen,
          ikutSingle: data.ikutSingle,
          ikutDouble: data.ikutDouble,
          setMenang: data.setMenang,
          lolosPool: data.lolosPool,
          juara: data.juara,
          finalist: data.finalist,
          semifinalist: data.semifinalist,
          quarterfinalist: data.quarterfinalist,
          ligaMain: data.ligaMain,
          ligaMenang: data.ligaMenang,
          ligaKalah: data.ligaKalah
        }
      }, { merge: true });
    });

    await Promise.all(promises);
    console.log('[PTS] Recalculated PTS Total, PTS Liga, and PTS Turnamen for all users!');
  } catch (error) {
    console.error("[PTS] Error recalculating points:", error);
  }
}

export async function getTurnamenById(id) {
  const turnamenRef = doc(db, TURNAMEN_COLLECTION, id);
  const turnamenSnap = await getDoc(turnamenRef);
  if (turnamenSnap.exists()) {
    return fromFirestore({ id: turnamenSnap.id, ...turnamenSnap.data() });
  }
  return null;
}

export async function getUsers() {
  const querySnapshot = await getDocs(collection(db, 'users'));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function updateUserRole(userId, newRole) {
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, { role: newRole }, { merge: true });
}

// ================= PERSAHABATAN (FRIENDLY MATCH) =================
const PERSAHABATAN_COLLECTION = 'persahabatan';

function persahabatanToFirestore(match) {
  const m = JSON.parse(JSON.stringify(match));
  if (m.partai) {
    m.partai.forEach(p => convertMatchSkor(p, 'toFirestore'));
  }
  return m;
}

function persahabatanFromFirestore(match) {
  if (!match) return null;
  const m = JSON.parse(JSON.stringify(match));
  if (m.partai) {
    m.partai.forEach(p => convertMatchSkor(p, 'fromFirestore'));
  }
  return m;
}

export async function getPersahabatan() {
  const querySnapshot = await getDocs(collection(db, PERSAHABATAN_COLLECTION));
  return querySnapshot.docs.map(d => persahabatanFromFirestore({ id: d.id, ...d.data() }));
}

export async function getPersahabatanById(id) {
  const docRef = doc(db, PERSAHABATAN_COLLECTION, id);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return persahabatanFromFirestore({ id: snap.id, ...snap.data() });
  }
  return null;
}

export async function addPersahabatan(persahabatan) {
  const id = persahabatan.id;
  await setDoc(doc(db, PERSAHABATAN_COLLECTION, id), persahabatanToFirestore(persahabatan));
  return await getPersahabatan();
}

export async function updatePersahabatan(id, data) {
  await setDoc(doc(db, PERSAHABATAN_COLLECTION, id), persahabatanToFirestore(data));
  return await getPersahabatan();
}

export async function deletePersahabatan(id) {
  await deleteDoc(doc(db, PERSAHABATAN_COLLECTION, id));
  return await getPersahabatan();
}

// ================= LIGA (LEAGUE SYSTEM) =================
const LIGA_COLLECTION = 'liga';

function ligaToFirestore(liga) {
  const l = JSON.parse(JSON.stringify(liga));
  if (l.jadwal) {
    l.jadwal.forEach(pekan => {
      pekan.pertandingan?.forEach(m => convertMatchSkor(m, 'toFirestore'));
    });
  }
  return l;
}

function ligaFromFirestore(liga) {
  if (!liga) return null;
  const l = JSON.parse(JSON.stringify(liga));
  if (l.jadwal) {
    l.jadwal.forEach(pekan => {
      pekan.pertandingan?.forEach(m => convertMatchSkor(m, 'fromFirestore'));
    });
  }
  return l;
}

export async function getLiga() {
  const querySnapshot = await getDocs(collection(db, LIGA_COLLECTION));
  return querySnapshot.docs.map(d => ligaFromFirestore({ id: d.id, ...d.data() }));
}

export async function getLigaById(id) {
  const docRef = doc(db, LIGA_COLLECTION, id);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return ligaFromFirestore({ id: snap.id, ...snap.data() });
  }
  return null;
}

export async function addLiga(liga) {
  const id = liga.id;
  await setDoc(doc(db, LIGA_COLLECTION, id), ligaToFirestore(liga));
  await recalculatePTS();
  return await getLiga();
}

export async function updateLiga(id, data) {
  await setDoc(doc(db, LIGA_COLLECTION, id), ligaToFirestore(data));
  await recalculatePTS();
  return await getLiga();
}

export async function deleteLiga(id) {
  await deleteDoc(doc(db, LIGA_COLLECTION, id));
  await recalculatePTS();
  return await getLiga();
}

/**
 * Sinkronisasi menyeluruh antara seluruh Member dan seluruh Liga:
 * Mengisi noHP, karet, divisi, PTM, dan PTS pada peserta liga jika masih kosong atau belum sama dengan database Member.
 */
export async function syncAllMembersWithAllLeagues() {
  try {
    const allMembers = await getPemain();
    const allLeagues = await getLiga();
    if (!allMembers || !allLeagues) return;

    for (const liga of allLeagues) {
      let isChanged = false;
      const currentPeserta = (liga.peserta || []).map(p => {
        const m = allMembers.find(mem => 
          (mem.id && p.id && mem.id === p.id) || 
          (mem.nama && p.nama && mem.nama.trim().toLowerCase() === p.nama.trim().toLowerCase())
        );
        if (m) {
          const merged = {
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
            p.noHP !== merged.noHP ||
            p.divisi !== merged.divisi ||
            p.namaPTM !== merged.namaPTM ||
            p.karetForehand !== merged.karetForehand ||
            p.karetBackhand !== merged.karetBackhand ||
            p.nama !== merged.nama
          ) {
            isChanged = true;
          }
          return merged;
        }
        return p;
      });

      if (isChanged) {
        const updatedKlasemen = hitungKlasemenLiga(currentPeserta, liga.jadwal || [], {
          poinMenang: Number(liga.poinMenang || 3),
          poinKalah: Number(liga.poinKalah || 0)
        });
        await setDoc(doc(db, LIGA_COLLECTION, liga.id), ligaToFirestore({
          ...liga,
          peserta: currentPeserta,
          klasemen: updatedKlasemen
        }));
      }
    }
  } catch (err) {
    console.error("Error in syncAllMembersWithAllLeagues:", err);
  }
}

/**
 * Sinkronisasi data Member (users) ke seluruh data Liga yang ada:
 * - Jika Member diedit, data di peserta liga & pertandingan otomatis terupdate.
 * - Jika Member dicentang ikutLiga = true, otomatis masuk ke peserta liga.
 * - Jika Member dicentang ikutLiga = false atau dihapus, otomatis dikeluarkan dari peserta liga.
 */
export async function syncMemberToLeagues(memberData, isDelete = false) {
  try {
    const allLeagues = await getLiga();
    if (!allLeagues || allLeagues.length === 0) return;

    for (const liga of allLeagues) {
      let isChanged = false;
      let currentPeserta = [...(liga.peserta || [])];
      const pIdx = currentPeserta.findIndex(
        p => p.id === memberData.id || p.nama?.trim().toLowerCase() === memberData.nama?.trim().toLowerCase()
      );

      if (isDelete || memberData.ikutLiga === false) {
        if (pIdx !== -1) {
          currentPeserta = currentPeserta.filter((_, idx) => idx !== pIdx);
          isChanged = true;
        }
      } else if (memberData.ikutLiga === true) {
        if (pIdx !== -1) {
          // Update existing participant
          currentPeserta[pIdx] = {
            ...currentPeserta[pIdx],
            nama: memberData.nama || currentPeserta[pIdx].nama,
            noHP: memberData.noHP || currentPeserta[pIdx].noHP || '',
            divisi: String(memberData.divisi || currentPeserta[pIdx].divisi || '1'),
            namaPTM: memberData.namaPTM || currentPeserta[pIdx].namaPTM || 'Klub',
            karetForehand: memberData.karetForehand || currentPeserta[pIdx].karetForehand || '',
            karetBackhand: memberData.karetBackhand || currentPeserta[pIdx].karetBackhand || '',
            ikutLiga: true
          };
          isChanged = true;
        } else {
          // Add new participant to league
          currentPeserta.push({
            id: memberData.id,
            nama: memberData.nama,
            noHP: memberData.noHP || '',
            divisi: String(memberData.divisi || '1'),
            namaPTM: memberData.namaPTM || 'Klub',
            karetForehand: memberData.karetForehand || '',
            karetBackhand: memberData.karetBackhand || '',
            pts: memberData.pts || 0,
            ikutLiga: true
          });
          isChanged = true;
        }
      } else {
        // Just general profile update for player already in the league
        if (pIdx !== -1) {
          currentPeserta[pIdx] = {
            ...currentPeserta[pIdx],
            nama: memberData.nama || currentPeserta[pIdx].nama,
            noHP: memberData.noHP || currentPeserta[pIdx].noHP || '',
            divisi: String(memberData.divisi || currentPeserta[pIdx].divisi || '1'),
            namaPTM: memberData.namaPTM || currentPeserta[pIdx].namaPTM || 'Klub',
            karetForehand: memberData.karetForehand || currentPeserta[pIdx].karetForehand || '',
            karetBackhand: memberData.karetBackhand || currentPeserta[pIdx].karetBackhand || ''
          };
          isChanged = true;
        }
      }

      if (isChanged) {
        // Also update name/PTM in matches (jadwal)
        const updatedJadwal = (liga.jadwal || []).map(pekan => ({
          ...pekan,
          pertandingan: (pekan.pertandingan || []).map(m => {
            let newM = { ...m };
            if (m.peserta1?.id === memberData.id) {
              newM.peserta1 = { ...m.peserta1, nama: memberData.nama, namaPTM: memberData.namaPTM || m.peserta1.namaPTM };
            }
            if (m.peserta2?.id === memberData.id) {
              newM.peserta2 = { ...m.peserta2, nama: memberData.nama, namaPTM: memberData.namaPTM || m.peserta2.namaPTM };
            }
            if (m.wasit?.id === memberData.id) {
              newM.wasit = { ...m.wasit, nama: memberData.nama, namaPTM: memberData.namaPTM || m.wasit.namaPTM };
            }
            return newM;
          })
        }));

        const updatedKlasemen = hitungKlasemenLiga(currentPeserta, updatedJadwal, {
          poinMenang: Number(liga.poinMenang || 3),
          poinKalah: Number(liga.poinKalah || 0)
        });

        await updateLiga(liga.id, {
          ...liga,
          peserta: currentPeserta,
          jadwal: updatedJadwal,
          klasemen: updatedKlasemen
        });
      }
    }
  } catch (err) {
    console.error("Error syncing member to leagues:", err);
  }
}

/**
 * Sinkronisasi data Peserta Liga ke database Member (users):
 * - Saat peserta liga diedit/ditambah, database Member otomatis terupdate & diberi flag ikutLiga = true.
 * - Saat peserta liga dihapus dari liga, flag ikutLiga pada database Member diubah menjadi false.
 */
export async function syncLeaguePlayerToMember(playerData, isRemove = false, currentUser = null) {
  try {
    const allMembers = await getPemain();
    const existing = allMembers.find(
      m => m.id === playerData.id || m.nama?.trim().toLowerCase() === playerData.nama?.trim().toLowerCase()
    );

    if (isRemove) {
      if (existing) {
        await updatePemain(existing.id, { ikutLiga: false });
      }
    } else {
      if (existing) {
        await updatePemain(existing.id, {
          nama: playerData.nama,
          noHP: playerData.noHP || existing.noHP || '',
          divisi: String(playerData.divisi || existing.divisi || '1'),
          namaPTM: playerData.namaPTM || existing.namaPTM || 'Klub',
          karetForehand: playerData.karetForehand || existing.karetForehand || '',
          karetBackhand: playerData.karetBackhand || existing.karetBackhand || '',
          ikutLiga: true
        });
      } else {
        await addPemain({
          id: playerData.id,
          nama: playerData.nama,
          noHP: playerData.noHP || '',
          divisi: String(playerData.divisi || '1'),
          namaPTM: playerData.namaPTM || 'Klub',
          karetForehand: playerData.karetForehand || '',
          karetBackhand: playerData.karetBackhand || '',
          ownerUid: currentUser?.uid || '',
          ownerPTM: playerData.namaPTM || '',
          pts: 0,
          ikutLiga: true,
          createdAt: new Date().toISOString()
        });
      }
    }
  } catch (err) {
    console.error("Error syncing league player to member:", err);
  }
}




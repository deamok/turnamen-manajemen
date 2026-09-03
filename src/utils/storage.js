import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

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

  // admin & player: PTM yang sama persis
  return all.filter(p => {
    const memberPTM = (p.namaPTM || p.ownerPTM || '').trim().toLowerCase();
    const myPTM = (ptm || '').trim().toLowerCase();
    
    // Jika admin sudah memiliki PTM, HANYA tampilkan pemain dari PTM tersebut (dan dirinya sendiri)
    if (myPTM) {
      return memberPTM === myPTM || p.id === uid;
    }
    
    // Jika admin belum menyetel PTM-nya, tampilkan pemain yang pernah ia buat
    return p.ownerUid === uid || p.id === uid;
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

// Automatically recalculate PTS for all users based on all tournament history
export async function recalculatePTS() {
  try {
    const pemainSnapshot = await getDocs(collection(db, PEMAIN_COLLECTION));
    const pemainList = pemainSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const tournamentsSnapshot = await getDocs(collection(db, TURNAMEN_COLLECTION));
    const tournaments = tournamentsSnapshot.docs.map(doc => fromFirestore({ id: doc.id, ...doc.data() }));

    const userPts = {};
    pemainList.forEach(u => {
      userPts[u.id] = {
        pts: 0,
        ikutSingle: 0,
        ikutDouble: 0,
        setMenang: 0,
        lolosPool: 0,
        juara: 0,
        finalist: 0,
        semifinalist: 0,
        quarterfinalist: 0
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

    tournaments.forEach(t => {
      const hasPeserta = t.peserta || [];
      pemainList.forEach(user => {
        const participated = hasPeserta.some(p => isUserInParticipant(p, user.id));
        if (participated) {
          userPts[user.id].pts += 10; // +10 PTS for participation
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
                userPts[user.id].pts += sets * 1; // +1 PTS per set won
              } else if (isUserInParticipant(m.peserta2, user.id)) {
                let sets = 0;
                m.skor.forEach(s => {
                  if (s[1] > s[0]) sets++;
                });
                userPts[user.id].setMenang += sets;
                userPts[user.id].pts += sets * 1; // +1 PTS per set won
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
                  userPts[user.id].pts += sets * 1;
                } else if (isUserInParticipant(m.peserta2, user.id)) {
                  let sets = 0;
                  m.skor.forEach(s => {
                    if (s[1] > s[0]) sets++;
                  });
                  userPts[user.id].setMenang += sets;
                  userPts[user.id].pts += sets * 1;
                }
              });
            }
          });

          if (roundIdx === 0) {
            pemainList.forEach(user => {
              const inRound = matches.some(m => isUserInParticipant(m.peserta1, user.id) || isUserInParticipant(m.peserta2, user.id));
              if (inRound) {
                userPts[user.id].lolosPool += 1;
                userPts[user.id].pts += 15; // +15 PTS for passing pool stage
              }
            });
          }

          const roundName = round.nama || '';
          pemainList.forEach(user => {
            const inRound = matches.some(m => isUserInParticipant(m.peserta1, user.id) || isUserInParticipant(m.peserta2, user.id));
            if (inRound) {
              if (roundName === 'Perempat Final') {
                userPts[user.id].quarterfinalist += 1;
                userPts[user.id].pts += 10;
              } else if (roundName === 'Semi Final') {
                userPts[user.id].semifinalist += 1;
                userPts[user.id].pts += 20;
              } else if (roundName === 'Final') {
                userPts[user.id].finalist += 1;
                userPts[user.id].pts += 30;
              }
            }
          });
        });
      }

      if (t.juara) {
        pemainList.forEach(user => {
          if (isUserInParticipant(t.juara, user.id)) {
            userPts[user.id].juara += 1;
            userPts[user.id].pts += 50; // +50 PTS for champion
          }
        });
      }
    });

    const promises = pemainList.map(user => {
      const userRef = doc(db, PEMAIN_COLLECTION, user.id);
      const data = userPts[user.id];
      return setDoc(userRef, {
        pts: data.pts,
        statsPTS: {
          ikutSingle: data.ikutSingle,
          ikutDouble: data.ikutDouble,
          setMenang: data.setMenang,
          lolosPool: data.lolosPool,
          juara: data.juara,
          finalist: data.finalist,
          semifinalist: data.semifinalist,
          quarterfinalist: data.quarterfinalist
        }
      }, { merge: true });
    });

    await Promise.all(promises);
    console.log('[PTS] Recalculated points for all users!');
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


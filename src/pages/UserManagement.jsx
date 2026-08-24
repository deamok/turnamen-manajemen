import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUsers, updateUserRole } from '../utils/storage';
import { collection, getDocs, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const ROLE_LABELS = {
  superadmin: { label: 'Super Admin', emoji: '👑', color: 'var(--color-warning)' },
  admin:      { label: 'Admin',       emoji: '🛡️',  color: 'var(--color-primary)' },
  player:     { label: 'Player',      emoji: '🏓',  color: 'var(--color-text-secondary)' },
};

const UserManagement = () => {
  const { currentUser, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);   // uid yang sedang disimpan
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('Semua');
  const [migrating, setMigrating] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      // Tampilkan urut: superadmin → admin → player, lalu A-Z nama
      data.sort((a, b) => {
        const order = { superadmin: 0, admin: 1, player: 2 };
        const diff = (order[a.role] ?? 3) - (order[b.role] ?? 3);
        if (diff !== 0) return diff;
        return (a.name || a.email || '').localeCompare(b.name || b.email || '');
      });
      setUsers(data);
    } catch (e) {
      console.error('Gagal memuat users:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) { navigate('/login'); return; }
    if (!isSuperAdmin) return;
    loadUsers();
  }, [currentUser, isSuperAdmin, navigate]);

  const handleRoleChange = async (user, newRole) => {
    if (user.role === newRole) return;
    if (!window.confirm(
      `Ubah role "${user.nama || user.name || user.email}" dari "${user.role}" menjadi "${newRole}"?`
    )) return;

    try {
      setSaving(user.id);
      await updateUserRole(user.id, newRole);
      setUsers(prev =>
        prev.map(u => u.id === user.id ? { ...u, role: newRole } : u)
          .sort((a, b) => {
            const order = { superadmin: 0, admin: 1, player: 2 };
            const diff = (order[a.role] ?? 3) - (order[b.role] ?? 3);
            if (diff !== 0) return diff;
            return (a.nama || a.name || a.email || '').localeCompare(b.nama || b.name || b.email || '');
          })
      );
    } catch (e) {
      console.error('Gagal mengubah role:', e);
      alert('Gagal mengubah role. Coba lagi.');
    } finally {
      setSaving(null);
    }
  };

  const handleMigrate = async () => {
    if (!window.confirm('Proses ini akan memigrasi data pemain LAMA sekaligus menormalisasi seluruh struktur data di koleksi "users". Lanjutkan?')) return;
    setMigrating(true);
    try {
      // 1. Ambil semua data dari koleksi pemain lama
      const pemainSnap = await getDocs(collection(db, 'pemain'));
      // 2. Ambil semua data users saat ini
      const usersSnap = await getDocs(collection(db, 'users'));
      
      let count = 0;
      
      // Struktur dasar yang HARUS dimiliki oleh semua user/pemain
      const getBaseStructure = () => ({
        nama: '',
        email: '',
        role: 'player',
        noHP: '',
        divisi: '',
        namaPTM: '',
        ownerUid: '',
        ownerPTM: '',
        pts: 0,
        statsPTS: {
          ikutSingle: 0, ikutDouble: 0, setMenang: 0, lolosPool: 0,
          juara: 0, finalist: 0, semifinalist: 0, quarterfinalist: 0
        },
        createdAt: new Date().toISOString()
      });

      // Proses normalisasi seluruh dokumen di 'users'
      const normalizeUserPromises = usersSnap.docs.map(async (uDoc) => {
        const uData = uDoc.data();
        const base = getBaseStructure();
        
        const mergedData = {
          ...base,
          ...uData,
          nama: uData.nama || uData.name || base.nama,
          statsPTS: { ...base.statsPTS, ...(uData.statsPTS || {}) },
          pts: uData.pts || 0
        };
        // Hapus field lama 'name' agar bersih
        delete mergedData.name;
        
        await setDoc(doc(db, 'users', uDoc.id), mergedData);
        count++;
      });
      await Promise.all(normalizeUserPromises);

      // Proses migrasi dokumen dari 'pemain' ke 'users'
      const migratePromises = pemainSnap.docs.map(async (pDoc) => {
        const pData = pDoc.data();
        const userRef = doc(db, 'users', pDoc.id);
        const userSnap = await getDoc(userRef);
        
        const base = getBaseStructure();
        
        if (userSnap.exists()) {
          const existing = userSnap.data();
          const mergedData = {
            ...base,
            ...existing,
            ...pData,
            nama: existing.nama || pData.nama || existing.name || base.nama,
            statsPTS: { ...base.statsPTS, ...(existing.statsPTS || {}), ...(pData.statsPTS || {}) },
            pts: Math.max(existing.pts || 0, pData.pts || 0),
            role: existing.role || 'player'
          };
          delete mergedData.name;
          await setDoc(userRef, mergedData);
        } else {
          const mergedData = {
            ...base,
            ...pData,
            nama: pData.nama || pData.name || base.nama,
            statsPTS: { ...base.statsPTS, ...(pData.statsPTS || {}) },
            pts: pData.pts || 0
          };
          delete mergedData.name;
          await setDoc(userRef, mergedData);
        }
        count++;
      });
      await Promise.all(migratePromises);

      alert(`Selesai! Berhasil menormalisasi & migrasi ${count} entri data! Semua struktur field sekarang 100% seragam.`);
      loadUsers();
    } catch (e) {
      console.error('Migrasi gagal:', e);
      alert('Gagal melakukan normalisasi data.');
    } finally {
      setMigrating(false);
    }
  };

  // --- Guard ---
  if (!currentUser) return null;
  if (!isSuperAdmin) {
    return (
      <div className="page-container" style={{ textAlign: 'center', marginTop: '60px' }}>
        <h2>⛔ Akses Ditolak</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '10px' }}>
          Halaman ini hanya dapat diakses oleh Super Admin.
        </p>
      </div>
    );
  }

  const filtered = users.filter(u => {
    const matchRole = filterRole === 'Semua' || u.role === filterRole;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q ||
      ((u.nama || u.name) && (u.nama || u.name).toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q));
    return matchRole && matchSearch;
  });

  const counts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  const handleRecalculatePTS = async () => {
    try {
      if (!window.confirm("Hitung ulang semua PTS pemain dari awal? (Ini akan memindai seluruh data pertandingan)")) return;
      setMigrating(true);
      const { recalculatePTS } = await import('../utils/storage');
      await recalculatePTS();
      alert('Perhitungan PTS Selesai!');
      loadUsers();
    } catch(e) {
      alert('Gagal menghitung PTS.');
      console.error(e);
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="page-container fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>👑 Manajemen User</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Kelola hak akses pengguna yang sudah terdaftar
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleRecalculatePTS} disabled={migrating}>
            📊 Hitung Ulang PTS
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleMigrate} disabled={migrating} style={{ background: 'var(--color-primary)' }}>
            {migrating ? '⏳ Migrasi...' : '⚡ Migrasi Pemain'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={loadUsers}>🔄 Refresh</button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {Object.entries(ROLE_LABELS).map(([role, meta]) => (
          <div key={role} className="card" style={{
            padding: '16px 20px',
            borderLeft: `3px solid ${meta.color}`,
            cursor: 'pointer',
            outline: filterRole === role ? `1px solid ${meta.color}` : 'none',
          }} onClick={() => setFilterRole(filterRole === role ? 'Semua' : role)}>
            <div style={{ fontSize: '1.5rem' }}>{meta.emoji}</div>
            <div style={{ fontWeight: '700', fontSize: '1.4rem', color: meta.color, lineHeight: 1, marginTop: '4px' }}>
              {counts[role] || 0}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{meta.label}</div>
          </div>
        ))}
        <div className="card" style={{ padding: '16px 20px', borderLeft: '3px solid var(--border-color)' }}>
          <div style={{ fontSize: '1.5rem' }}>👥</div>
          <div style={{ fontWeight: '700', fontSize: '1.4rem', lineHeight: 1, marginTop: '4px' }}>{users.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>Total User</div>
        </div>
      </div>

      {/* Filter & Search */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          className="form-input"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="🔍 Cari nama atau email..."
          style={{ maxWidth: '280px', borderRadius: '24px', margin: 0, padding: '8px 16px', fontSize: '0.85rem' }}
        />
        <div style={{ display: 'flex', gap: '6px' }}>
          {['Semua', 'superadmin', 'admin', 'player'].map(r => (
            <button
              key={r}
              className={`chip ${filterRole === r ? 'active' : ''}`}
              onClick={() => setFilterRole(r)}
            >
              {r === 'Semua' ? 'Semua Role' : ROLE_LABELS[r]?.label || r}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            ⏳ Memuat data pengguna...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Tidak ada pengguna yang cocok.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.03)' }}>
                {['Pengguna', 'Email', 'Role Saat Ini', 'Ubah Role'].map(col => (
                  <th key={col} style={{
                    padding: '12px 16px', textAlign: 'left',
                    fontSize: '0.78rem', fontWeight: '600',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    color: 'var(--color-text-secondary)'
                  }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((user, idx) => {
                const roleMeta = ROLE_LABELS[user.role] || ROLE_LABELS.player;
                const isSelf = user.id === currentUser.uid;
                const isBusy = saving === user.id;

                return (
                  <tr key={user.id} style={{
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background 0.15s',
                    background: isSelf ? 'rgba(0,200,255,0.04)' : 'transparent'
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = isSelf ? 'rgba(0,200,255,0.04)' : 'transparent'}
                  >
                    {/* Nama */}
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '34px', height: '34px', borderRadius: '50%',
                          background: `${roleMeta.color}22`,
                          border: `1.5px solid ${roleMeta.color}55`,
                          display: 'grid', placeItems: 'center',
                          fontSize: '1rem', flexShrink: 0
                        }}>
                          {roleMeta.emoji}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                            {user.nama || user.name || '(Belum diisi)'}
                            {isSelf && <span style={{ marginLeft: '6px', fontSize: '0.7rem', background: 'rgba(0,200,255,0.15)', color: 'var(--color-primary)', padding: '1px 6px', borderRadius: '4px' }}>Saya</span>}
                          </div>
                          {user.namaPTM && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{user.namaPTM}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td style={{ padding: '13px 16px', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                      {user.email || '-'}
                    </td>

                    {/* Role badge */}
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '4px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '600',
                        background: `${roleMeta.color}20`,
                        border: `1px solid ${roleMeta.color}50`,
                        color: roleMeta.color
                      }}>
                        {roleMeta.emoji} {roleMeta.label}
                      </span>
                    </td>

                    {/* Tombol ubah role */}
                    <td style={{ padding: '13px 16px' }}>
                      {user.role === 'superadmin' ? (
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                          Tidak dapat diubah
                        </span>
                      ) : (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {['admin', 'player'].map(newRole => (
                            newRole !== user.role && (
                              <button
                                key={newRole}
                                disabled={isBusy}
                                onClick={() => handleRoleChange(user, newRole)}
                                style={{
                                  padding: '5px 12px',
                                  borderRadius: '6px',
                                  border: `1px solid ${ROLE_LABELS[newRole].color}60`,
                                  background: `${ROLE_LABELS[newRole].color}15`,
                                  color: ROLE_LABELS[newRole].color,
                                  cursor: isBusy ? 'wait' : 'pointer',
                                  fontSize: '0.78rem',
                                  fontWeight: '600',
                                  transition: 'all 0.15s',
                                  opacity: isBusy ? 0.6 : 1
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = `${ROLE_LABELS[newRole].color}30`; }}
                                onMouseLeave={e => { e.currentTarget.style.background = `${ROLE_LABELS[newRole].color}15`; }}
                              >
                                {isBusy ? '⏳' : `→ ${ROLE_LABELS[newRole].emoji} ${ROLE_LABELS[newRole].label}`}
                              </button>
                            )
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
        Total: {filtered.length} dari {users.length} pengguna
      </div>
    </div>
  );
};

export default UserManagement;

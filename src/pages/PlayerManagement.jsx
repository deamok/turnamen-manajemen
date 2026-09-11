import React, { useState, useEffect } from 'react';
import { getPemainByScope, addPemain, updatePemain, deletePemain, syncFriendlyMatchPlayersToMembers, syncMemberToLeagues, syncAllMembersWithAllLeagues, recalculatePTS } from '../utils/storage';
import { generateId } from '../utils/helpers';
import PlayerForm from '../components/PlayerForm';
import PlayerTable from '../components/PlayerTable';
import { useAuth } from '../contexts/AuthContext';

const PlayerManagement = () => {
  const { currentUser, canCreateTournament, isSuperAdmin, userPTM } = useAuth();
  const [pemainList, setPemainList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPemain, setEditingPemain] = useState(null);
  const [filterDivisi, setFilterDivisi] = useState('Semua');
  const [filterPTM, setFilterPTM] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');

  const loadPemain = async () => {
    try {
      // Sinkronisasi otomatis pemain dari laga persahabatan ke daftar Member
      await syncFriendlyMatchPlayersToMembers(currentUser);
      // Sinkronisasi data member dengan seluruh liga
      await syncAllMembersWithAllLeagues();
      // Hitung ulang seluruh PTS (Liga + Turnamen = Total)
      await recalculatePTS();

      const data = await getPemainByScope({
        isSuperAdmin,
        uid: currentUser?.uid,
        ptm: userPTM,
      });
      setPemainList(data || []);
    } catch (error) {
      console.error('Error loading players:', error);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadPemain();
    }
  }, [currentUser, isSuperAdmin, userPTM]);

  const handleAdd = async (data) => {
    const pemainData = {
      ...data,
      id: generateId(),
      ownerUid: currentUser?.uid || '',
      ownerPTM: userPTM || data.namaPTM || '',
      pts: 0,
      ikutLiga: !!data.ikutLiga,
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
    await addPemain(pemainData);
    if (pemainData.ikutLiga) {
      await syncMemberToLeagues(pemainData);
    }
    await loadPemain();
    setShowForm(false);
  };

  const handleUpdate = async (data) => {
    // Pertahankan ownerUid & ownerPTM asli pemain
    const updatedData = {
      ...data,
      ownerUid: editingPemain.ownerUid || currentUser?.uid || '',
      ownerPTM: editingPemain.ownerPTM || userPTM || '',
      ikutLiga: !!data.ikutLiga
    };
    await updatePemain(editingPemain.id, updatedData);
    await syncMemberToLeagues({ id: editingPemain.id, ...updatedData });
    await loadPemain();
    setEditingPemain(null);
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus pemain ini?')) {
      const deletedPlayer = pemainList.find(p => p.id === id);
      await deletePemain(id);
      if (deletedPlayer) {
        await syncMemberToLeagues(deletedPlayer, true);
      }
      await loadPemain();
    }
  };

  const handleEditClick = (pemain) => {
    setEditingPemain(pemain);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Daftar PTM yang unik untuk filter
  const ptmOptions = Array.from(
    new Set(pemainList.map(p => (p.namaPTM || p.ownerPTM || '').trim()).filter(Boolean))
  ).sort();

  const filteredPemain = pemainList.filter(p => {
    const matchDivisi = filterDivisi === 'Semua' || p.divisi === filterDivisi;
    const matchPTM = filterPTM === 'Semua' || (p.namaPTM || p.ownerPTM || '').trim().toLowerCase() === filterPTM.toLowerCase();
    const matchQuery = !searchQuery ||
      p.nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.namaPTM && p.namaPTM.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchDivisi && matchPTM && matchQuery;
  }).sort((a, b) => (b.pts || 0) - (a.pts || 0));

  const divisiGroups = ['Semua', '1', '2', '3', '4', '5'];

  // --- Guards ---
  if (!currentUser) {
    return (
      <div className="page-container" style={{ textAlign: 'center', marginTop: '50px' }}>
        <h2>Harap Login Terlebih Dahulu</h2>
      </div>
    );
  }

  return (
    <div className="page-container fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Manajemen Pemain</h1>
          {!isSuperAdmin && (
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              {userPTM
                ? `Menampilkan member ${userPTM} dan pemain yang Anda daftarkan`
                : 'Menampilkan member yang Anda tambahkan'}
            </p>
          )}
          {isSuperAdmin && (
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              Menampilkan semua member dari seluruh admin
            </p>
          )}
        </div>
        {canCreateTournament && (
          <button
            className={`btn ${showForm ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => { setShowForm(!showForm); setEditingPemain(null); }}
          >
            {showForm ? '✖ Batal' : '➕ Tambah Pemain'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="card fade-in" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h3>{editingPemain ? 'Edit Pemain' : 'Tambah Pemain Baru'}</h3>
          </div>
          <div className="card-body">
            <PlayerForm
              pemain={editingPemain}
              onSubmit={editingPemain ? handleUpdate : handleAdd}
              onCancel={() => { setShowForm(false); setEditingPemain(null); }}
            />
          </div>
        </div>
      )}

      {/* Filter Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Divisi Filter */}
          <div className="divisi-filter" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {divisiGroups.map(div => (
              <button
                key={div}
                className={`chip ${filterDivisi === div ? 'active' : ''}`}
                onClick={() => setFilterDivisi(div)}
              >
                {div === 'Semua' ? 'Semua Divisi' : `Divisi ${div}`}
              </button>
            ))}
          </div>

          {/* PTM Filter Dropdown */}
          {ptmOptions.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>🏠 PTM:</span>
              <select
                className="form-select"
                value={filterPTM}
                onChange={e => setFilterPTM(e.target.value)}
                style={{ fontSize: '0.85rem', padding: '4px 10px', width: 'auto', margin: 0 }}
              >
                <option value="Semua">Semua PTM ({pemainList.length})</option>
                {ptmOptions.map(ptmName => (
                  <option key={ptmName} value={ptmName}>{ptmName}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
          <input
            type="text"
            className="form-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
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
      </div>

      <div className="card">
        <PlayerTable
          pemainList={filteredPemain}
          onEdit={handleEditClick}
          onDelete={handleDelete}
          canEdit={canCreateTournament}
        />
      </div>

      <div style={{ marginTop: '15px', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
        Total: {filteredPemain.length} pemain {filterDivisi !== 'Semua' ? `di Divisi ${filterDivisi}` : ''}
      </div>
    </div>
  );
};

export default PlayerManagement;

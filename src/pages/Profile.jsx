import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const Profile = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    nama: '',
    noHP: '',
    namaPTM: '',
    divisi: ''
  });

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const fetchUserData = async () => {
      try {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({
            nama: data.nama || data.name || currentUser.displayName || '',
            noHP: data.noHP || '',
            namaPTM: data.namaPTM || '',
            divisi: data.divisi || ''
          });
        }
      } catch (e) {
        console.error("Gagal mengambil data user:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [currentUser, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nama || !formData.noHP || !formData.namaPTM || !formData.divisi) {
      alert('Semua data wajib diisi!');
      return;
    }

    setSaving(true);
    
    try {
      const docRef = doc(db, 'users', currentUser.uid);
      await updateDoc(docRef, {
        nama: formData.nama,
        noHP: formData.noHP,
        namaPTM: formData.namaPTM,
        divisi: formData.divisi
      });
      alert('Profil berhasil diperbarui!');
      navigate('/');
      window.location.reload();
    } catch (e) {
      console.error("Gagal menyimpan profil:", e);
      alert('Gagal menyimpan profil. Silakan coba lagi.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '50px' }}>
        <h2>Memuat data...</h2>
      </div>
    );
  }

  return (
    <div className="page-container fade-in">
      <div className="card" style={{ maxWidth: '600px', margin: '0 auto', padding: '30px' }}>
        <h2 style={{ marginBottom: '20px', color: 'var(--color-primary)' }}>Data Profile</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label className="form-label">Nama Lengkap</label>
            <input 
              type="text" 
              className="form-input" 
              value={formData.nama} 
              onChange={(e) => setFormData({...formData, nama: e.target.value})} 
              required 
            />
          </div>

          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label className="form-label">Nomor HP</label>
            <input 
              type="text" 
              className="form-input" 
              value={formData.noHP} 
              onChange={e => setFormData({...formData, noHP: e.target.value})} 
              placeholder="Contoh: 08123456789"
              required
            />
          </div>
          
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label className="form-label">Nama PTM / Klub</label>
            <input 
              type="text" 
              className="form-input" 
              value={formData.namaPTM} 
              onChange={e => setFormData({...formData, namaPTM: e.target.value})} 
              placeholder="Contoh: PTM Bintang"
              required
            />
          </div>
          
          <div className="form-group" style={{ marginBottom: '25px' }}>
            <label className="form-label">Divisi</label>
            <select 
              className="form-input" 
              value={formData.divisi} 
              onChange={e => setFormData({...formData, divisi: e.target.value})} 
              required
            >
              <option value="">-- Pilih Divisi --</option>
              <option value="1">Divisi 1</option>
              <option value="2">Divisi 2</option>
              <option value="3">Divisi 3</option>
              <option value="4">Divisi 4</option>
              <option value="5">Divisi 5</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>
              Kembali
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;

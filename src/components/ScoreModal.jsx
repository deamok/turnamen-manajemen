import React, { useState, useEffect } from 'react';
import { getNamaPeserta, tentukanPemenang } from '../utils/tournament';

const ScoreModal = ({ match, isOpen, onClose, onSave, tipe }) => {
  const [scores, setScores] = useState(
    Array.from({ length: 5 }, () => ['', ''])
  );
  const [jam, setJam] = useState('');
  const [meja, setMeja] = useState('');
  const [tanggal, setTanggal] = useState('');

  useEffect(() => {
    if (isOpen && match) {
      setJam(match.jam || '');
      setMeja(match.meja || '');
      setTanggal(match.tanggal || '');
      if (match.skor && match.skor.length > 0) {
        const initial = Array.from({ length: 5 }, (_, i) =>
          match.skor[i] ? [String(match.skor[i][0]), String(match.skor[i][1])] : ['', '']
        );
        setScores(initial);
      } else {
        setScores(Array.from({ length: 5 }, () => ['', '']));
      }
    }
  }, [isOpen, match]);

  if (!isOpen || !match) return null;

  const numSets = 5;
  const requiredWins = 3;

  const handleScoreChange = (setIndex, playerIndex, value) => {
    const newScores = scores.map((s, i) =>
      i === setIndex ? s.map((v, j) => (j === playerIndex ? value : v)) : [...s]
    );
    setScores(newScores);
  };

  const handleSave = () => {
    onSave({
      matchId: match.id,
      skor: currentValidScores,
      pemenang: currentWinnerId,
      selesai: currentWinnerId !== null,
      jam: jam,
      meja: meja,
      tanggal: tanggal
    });
    onClose();
  };

  const nama1 = getNamaPeserta(match.peserta1);
  const nama2 = getNamaPeserta(match.peserta2);

  // Calculate live score for display and determining winner
  const activeScores = scores.slice(0, numSets);
  const currentValidScores = activeScores
    .filter(s => s[0] !== '' && s[1] !== '')
    .map(s => [parseInt(s[0]) || 0, parseInt(s[1]) || 0]);
  const liveWinner = tentukanPemenang(currentValidScores, requiredWins);
  const currentWinnerId = liveWinner === 1 ? match.peserta1?.id : liveWinner === 2 ? match.peserta2?.id : null;
  let setsWon1 = 0, setsWon2 = 0;
  currentValidScores.forEach(s => {
    if (s[0] >= 11 && s[0] - s[1] >= 2) setsWon1++;
    else if (s[1] >= 11 && s[1] - s[0] >= 2) setsWon2++;
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🏓 Input Skor Pertandingan</h3>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: liveWinner === 1 ? 'var(--color-success)' : 'var(--color-text)' }}>{nama1}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '5px' }}>{setsWon1}</div>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--color-text-secondary)', padding: '0 15px' }}>VS</div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: liveWinner === 2 ? 'var(--color-success)' : 'var(--color-text)' }}>{nama2}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '5px' }}>{setsWon2}</div>
            </div>
          </div>

          {/* Tanggal, Jam & Nomor Meja */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: '12px', 
            marginBottom: '20px', 
            background: 'rgba(255,255,255,0.02)', 
            padding: '15px', 
            borderRadius: '8px', 
            border: '1px solid var(--border-light)' 
          }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tanggal Tanding</label>
              <input 
                type="date" 
                className="form-input" 
                value={tanggal} 
                onChange={e => setTanggal(e.target.value)} 
              />
            </div>
            <div style={{ display: 'flex', gap: '15px' }}>
              <div className="form-group" style={{ flex: 1, margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Jam Tanding</label>
                <input 
                  type="time" 
                  className="form-input" 
                  value={jam} 
                  onChange={e => setJam(e.target.value)} 
                />
              </div>
              <div className="form-group" style={{ flex: 1, margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Nomor Meja</label>
                <select 
                  className="form-input" 
                  value={meja} 
                  onChange={e => setMeja(e.target.value)}
                >
                  <option value="">-- Pilih Meja --</option>
                  <option value="Meja 1">Meja 1</option>
                  <option value="Meja 2">Meja 2</option>
                </select>
              </div>
            </div>
          </div>

          {scores.slice(0, numSets).map((set, index) => {
            // Auto-lock: Disable input if match is already won and this set has no score yet
            const isLocked = liveWinner > 0 && set[0] === '' && set[1] === '';
            return (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', opacity: isLocked ? 0.5 : 1 }}>
                <label className="form-label" style={{ width: '60px', margin: 0, flexShrink: 0 }}>Set {index + 1}</label>
                <input
                  type="number"
                  className="form-input"
                  style={{ width: '70px', textAlign: 'center' }}
                  value={set[0]}
                  onChange={(e) => handleScoreChange(index, 0, e.target.value)}
                  min="0"
                  placeholder="0"
                  disabled={isLocked}
                />
                <span style={{ fontWeight: 'bold', color: 'var(--color-text-secondary)' }}>-</span>
                <input
                  type="number"
                  className="form-input"
                  style={{ width: '70px', textAlign: 'center' }}
                  value={set[1]}
                  onChange={(e) => handleScoreChange(index, 1, e.target.value)}
                  min="0"
                  placeholder="0"
                  disabled={isLocked}
                />
              </div>
            );
          })}

          {liveWinner > 0 && (
            <div style={{ marginTop: '15px', padding: '10px', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', textAlign: 'center' }}>
              <strong>🏆 Pemenang: {liveWinner === 1 ? nama1 : nama2}</strong>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={handleSave}>Simpan Perubahan</button>
        </div>
      </div>
    </div>
  );
};

export default ScoreModal;

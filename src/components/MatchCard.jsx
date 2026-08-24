import React from 'react';
import { getNamaPeserta } from '../utils/tournament';

const MatchCard = ({ match, onClick, tipe }) => {
  const nama1 = getNamaPeserta(match.peserta1);
  const nama2 = getNamaPeserta(match.peserta2);
  const isClickable = !match.selesai;

  return (
    <div
      className={`match-card ${isClickable ? 'clickable' : ''}`}
      onClick={() => isClickable && onClick && onClick(match)}
      style={{ cursor: isClickable ? 'pointer' : 'default' }}
    >
      <div className={`match-player ${match.pemenang === match.peserta1?.id ? 'match-winner' : ''}`}>
        {nama1}
      </div>
      <div className="match-vs">VS</div>
      <div className={`match-player ${match.pemenang === match.peserta2?.id ? 'match-winner' : ''}`}>
        {nama2}
      </div>
      {match.selesai && match.skor.length > 0 && (
        <div className="match-score">
          {match.skor.map((s, i) => `${s[0]}-${s[1]}`).join(' | ')}
        </div>
      )}
    </div>
  );
};

export default MatchCard;

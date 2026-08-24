import React, { useState, useEffect, useRef } from 'react';
import { getNamaPeserta } from '../utils/tournament';

const EliminationBracket = ({ bracket, onInputSkor, tipe, isAdmin }) => {
  const containerRef = useRef(null);
  const [paths, setPaths] = useState([]);

  const updatePaths = () => {
    if (!containerRef.current || !bracket || !bracket.rounds) return;

    const containerEl = containerRef.current;
    const containerRect = containerEl.getBoundingClientRect();
    const scrollLeft = containerEl.scrollLeft;
    const scrollTop = containerEl.scrollTop;

    const newPaths = [];

    // Loop through each round except the last one
    for (let r = 0; r < bracket.rounds.length - 1; r++) {
      const currentRound = bracket.rounds[r].pertandingan;
      const nextRound = bracket.rounds[r + 1].pertandingan;

      currentRound.forEach((match, matchIdx) => {
        const nextMatchIdx = Math.floor(matchIdx / 2);
        const nextMatch = nextRound[nextMatchIdx];

        if (!nextMatch) return;

        const cardEl = document.getElementById(`match-card-${match.id}`);
        const nextCardEl = document.getElementById(`match-card-${nextMatch.id}`);

        if (cardEl && nextCardEl) {
          const rect = cardEl.getBoundingClientRect();
          const nextRect = nextCardEl.getBoundingClientRect();

          // Start point: right-center of current match card
          const x1 = rect.right - containerRect.left + scrollLeft;
          const y1 = rect.top - containerRect.top + rect.height / 2 + scrollTop;

          // End point: left-center of next match card
          const x2 = nextRect.left - containerRect.left + scrollLeft;
          const y2 = nextRect.top - containerRect.top + nextRect.height / 2 + scrollTop;

          // Orthogonal path
          const xMid = x1 + (x2 - x1) / 2;
          const pathD = `M ${x1} ${y1} H ${xMid} V ${y2} H ${x2}`;
          newPaths.push(pathD);
        }
      });
    }

    setPaths(newPaths);
  };

  useEffect(() => {
    updatePaths();

    const resizeObserver = new ResizeObserver(() => {
      updatePaths();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', updatePaths);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updatePaths);
    };
  }, [bracket]);

  if (!bracket || !bracket.rounds) return <div className="empty-state">Bracket belum tersedia</div>;

  return (
    <div 
      className="bracket-container" 
      ref={containerRef}
      style={{ position: 'relative', display: 'flex', overflowX: 'auto', padding: '40px 20px', gap: '80px', minHeight: '500px' }}
    >
      {/* SVG Overlay behind match cards */}
      <svg 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          pointerEvents: 'none',
          zIndex: 1
        }}
      >
        {paths.map((d, idx) => (
          <path 
            key={idx}
            d={d}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="2"
            opacity="0.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>

      {bracket.rounds.map((round, roundIndex) => (
        <div 
          key={roundIndex} 
          className="bracket-round"
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-around', 
            gap: '20px',
            minWidth: '240px',
            position: 'relative',
            zIndex: 2
          }}
        >
          <h4 className="bracket-round-title" style={{ textAlign: 'center', marginBottom: '15px', color: 'var(--color-primary)' }}>
            {round.nama}
          </h4>
          <div className="bracket-matches" style={{ display: 'flex', flexDirection: 'column', gap: '30px', justifyContent: 'space-around', height: '100%' }}>
            {round.pertandingan.map((match, matchIndex) => {
              const p1 = match.peserta1;
              const p2 = match.peserta2;
              const isBye1 = p1 === null && roundIndex === 0;
              const isBye2 = p2 === null && roundIndex === 0;
              const isClickable = isAdmin && p1 !== null && p2 !== null;

              return (
                <div
                  key={match.id || matchIndex}
                  id={`match-card-${match.id}`}
                  className={`bracket-match ${isClickable ? 'clickable' : ''}`}
                  onClick={() => isClickable && onInputSkor && onInputSkor(match)}
                  style={{ 
                    cursor: isClickable ? 'pointer' : 'default',
                    position: 'relative',
                    paddingTop: (match.jam || match.meja || match.tanggal) ? '22px' : '10px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '8px',
                    minWidth: '200px'
                  }}
                >
                  {(match.jam || match.meja || match.tanggal) && (
                    <div style={{
                      position: 'absolute',
                      top: '4px',
                      left: '8px',
                      fontSize: '0.65rem',
                      color: 'var(--warning-color)',
                      fontWeight: 'bold'
                    }}>
                      ⏰ {match.jam || '-'} • 🏓 {match.meja || '-'}
                    </div>
                  )}
                  <div className={`match-player ${match.pemenang === p1?.id ? 'match-winner' : ''}`} style={isBye1 ? { opacity: 0.4 } : {}}>
                    <span>{isBye1 ? 'BYE' : (p1 ? getNamaPeserta(p1) : 'Menunggu...')}</span>
                    {match.selesai && match.skor.length > 0 && (
                      <span className="match-score">{match.skor.map(s => s[0]).join(' ')}</span>
                    )}
                    {match.selesai && isBye2 && !isBye1 && (
                      <span className="match-score" style={{ fontSize: '0.65rem', color: 'var(--color-success)', fontStyle: 'italic', fontWeight: 'bold' }}>Menang BYE</span>
                    )}
                  </div>
                  <div className={`match-player ${match.pemenang === p2?.id ? 'match-winner' : ''}`} style={isBye2 ? { opacity: 0.4 } : {}}>
                    <span>{isBye2 ? 'BYE' : (p2 ? getNamaPeserta(p2) : 'Menunggu...')}</span>
                    {match.selesai && match.skor.length > 0 && (
                      <span className="match-score">{match.skor.map(s => s[1]).join(' ')}</span>
                    )}
                    {match.selesai && isBye1 && !isBye2 && (
                      <span className="match-score" style={{ fontSize: '0.65rem', color: 'var(--color-success)', fontStyle: 'italic', fontWeight: 'bold' }}>Menang BYE</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default EliminationBracket;

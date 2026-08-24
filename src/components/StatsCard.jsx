import React from 'react';

const StatsCard = ({ icon, value, label }) => {
  return (
    <div className="stat-card fade-in">
      <div className="stat-header">
        <span className="stat-label">{label}</span>
        <div className="stat-icon-wrapper">
          {icon}
        </div>
      </div>
      <div className="stat-value">{value}</div>
    </div>
  );
};

export default StatsCard;

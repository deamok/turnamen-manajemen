import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

const Navbar = () => {
  const { currentUser, canCreateTournament, isSuperAdmin, userProfile } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const displayName = (userProfile?.name || currentUser?.displayName || 'User').split(' ')[0];

  return (
    <nav className="navbar">
      <NavLink to="/" className="navbar-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
        <span className="animate-pulse" style={{
          display: 'grid',
          placeItems: 'center',
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: 'rgba(0, 200, 255, 0.15)',
          border: '1px solid rgba(0, 200, 255, 0.3)',
          color: 'var(--primary-color)',
          boxShadow: '0 0 15px rgba(0, 200, 255, 0.25)',
          fontSize: '1.2rem'
        }}>
          🏓
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '1' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-primary)' }}>
            TOURNAMENT <span style={{ color: 'var(--primary-color)' }}>MANAGEMENT</span>
          </span>
          <span style={{ fontSize: '7.5px', fontWeight: 'bold', letterSpacing: '0.19em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '2px' }}>
           Aplikasi Turnamen Tenis Meja Sistem Pool dan Eleminasi (ITTF)
          </span>
        </span>
      </NavLink>
      <div className="navbar-links">
        <NavLink to="/" className={({ isActive }) => isActive ? "active" : ""}>Dashboard</NavLink>
        <NavLink to="/jadwal" className={({ isActive }) => isActive ? "active" : ""}>Histori</NavLink>
        
        {currentUser && (
          <NavLink to="/pemain" className={({ isActive }) => isActive ? "active" : ""}>Member</NavLink>
        )}

        {canCreateTournament && (
          <NavLink to="/turnamen/baru" className={({ isActive }) => isActive ? "active" : ""}>Turnamen Baru</NavLink>
        )}
        
        {isSuperAdmin && (
          <NavLink to="/users" className={({ isActive }) => isActive ? "active" : ""} style={{ color: 'var(--color-warning)' }}>👑 Users</NavLink>
        )}
        
        {currentUser ? (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowDropdown(!showDropdown)} className="btn btn-secondary btn-sm">
              {displayName} ▾
            </button>
            {showDropdown && (
              <div className="navbar-dropdown">
                <button onClick={() => { navigate('/profile'); setShowDropdown(false); }} className="navbar-dropdown-item">
                  Data Profile 👤
                </button>
                <div style={{ height: '1px', background: 'var(--border-light)', margin: '4px 0' }}></div>
                <button onClick={handleLogout} className="navbar-dropdown-item danger">
                  Logout 🚪
                </button>
              </div>
            )}
          </div>
        ) : (
          <button onClick={() => navigate('/login')} className="btn btn-primary btn-sm">
            Login
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

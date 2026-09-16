import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

const Navbar = () => {
  const { currentUser, canCreateTournament, isSuperAdmin, userProfile } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    await signOut(auth);
    navigate('/login');
  };

  const displayName = (userProfile?.name || currentUser?.displayName || 'User').split(' ')[0];

  const handleNavClick = () => {
    setMobileMenuOpen(false);
    setShowDropdown(false);
  };

  return (
    <nav className="navbar">
      <div className="navbar-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <NavLink to="/" onClick={handleNavClick} className="navbar-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
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
            fontSize: '1.2rem',
            flexShrink: 0
          }}>
            🏓
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '1' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-primary)' }}>
              TOURNAMENT <span style={{ color: 'var(--primary-color)' }}>MANAGEMENT</span>
            </span>
            <span style={{ fontSize: '7px', fontWeight: 'bold', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '2px' }}>
              Aplikasi Tenis Meja Sistem Pool & Eleminasi
            </span>
          </span>
        </NavLink>

        {/* Mobile Hamburger Toggle Button */}
        <button
          type="button"
          className="mobile-nav-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Navigation"
          style={{
            display: 'none',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            fontSize: '1.4rem',
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            cursor: 'pointer',
            placeItems: 'center',
            padding: 0
          }}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Navigation Links */}
      <div className={`navbar-links ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <NavLink to="/" onClick={handleNavClick} className={({ isActive }) => isActive ? "active" : ""}>
          Liga 🏆
        </NavLink>
        
        {currentUser && (
          <NavLink to="/pemain" onClick={handleNavClick} className={({ isActive }) => isActive ? "active" : ""}>
            Member
          </NavLink>
        )}

        {canCreateTournament && (
          <NavLink to="/turnamen/baru" onClick={handleNavClick} className={({ isActive }) => isActive ? "active" : ""}>
            Turnamen Baru
          </NavLink>
        )}
        
        {isSuperAdmin && (
          <NavLink to="/users" onClick={handleNavClick} className={({ isActive }) => isActive ? "active" : ""} style={{ color: 'var(--color-warning)' }}>
            👑 Users
          </NavLink>
        )}
        
        {currentUser ? (
          <div className="navbar-user-section" style={{ position: 'relative' }}>
            <button onClick={() => setShowDropdown(!showDropdown)} className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
              👤 {displayName} ▾
            </button>
            {showDropdown && (
              <div className="navbar-dropdown">
                <button onClick={() => { navigate('/profile'); handleNavClick(); }} className="navbar-dropdown-item">
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
          <button onClick={() => { navigate('/login'); handleNavClick(); }} className="btn btn-primary btn-sm" style={{ width: '100%' }}>
            Login
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import PlayerManagement from './pages/PlayerManagement';
import CreateTournament from './pages/CreateTournament';
import TournamentDetail from './pages/TournamentDetail';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Jadwal from './pages/Jadwal';
import UserManagement from './pages/UserManagement';
import FriendlyMatchList from './pages/FriendlyMatchList';
import CreateFriendlyMatch from './pages/CreateFriendlyMatch';
import FriendlyMatchDetail from './pages/FriendlyMatchDetail';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Navbar />
          <main>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Dashboard />} />
              <Route path="/pemain" element={<PlayerManagement />} />
              <Route path="/turnamen/baru" element={<CreateTournament />} />
              <Route path="/turnamen/:id" element={<TournamentDetail />} />
              <Route path="/persahabatan" element={<FriendlyMatchList />} />
              <Route path="/persahabatan/baru" element={<CreateFriendlyMatch />} />
              <Route path="/persahabatan/:id" element={<FriendlyMatchDetail />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/jadwal" element={<Jadwal />} />
              <Route path="/users" element={<UserManagement />} />
            </Routes>
          </main>
          <footer style={{ 
            textAlign: 'center', 
            padding: '20px 10px', 
            color: 'var(--text-secondary)', 
            fontSize: '0.85rem',
            marginTop: 'auto',
            borderTop: '1px solid var(--border-light)'
          }}>
            dibuat oleh de@mok & Antigravity - 2026
          </footer>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;

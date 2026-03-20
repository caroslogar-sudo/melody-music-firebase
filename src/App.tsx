import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Music } from './pages/Music';
import { Videos } from './pages/Videos';
import { Playlists } from './pages/Playlists';
import { Trash } from './pages/Trash';
import { Settings } from './pages/Settings';
import { Users } from './pages/Users';
import { Shared } from './pages/Shared';
import { MyGroups } from './pages/MyGroups';
import { Chat } from './pages/Chat';
import { Mail } from './pages/Mail';
import { Requests } from './pages/Requests';
import { History } from './pages/History';
import { Favorites } from './pages/Favorites';
import { Register } from './pages/Register';
import { Invites } from './pages/Invites';
import { Analytics } from './pages/Analytics';
import { Loader2 } from 'lucide-react';

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, authLoading } = useApp();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 size={40} className="text-gold-300 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <Layout>{children}</Layout>;
};

const AppRoutes = () => {
  const { user, authLoading } = useApp();

  return (
    <Routes>
      <Route
        path="/"
        element={
          authLoading ? (
            <div className="w-full h-screen flex items-center justify-center bg-[#0a0a0a]">
              <Loader2 size={40} className="text-gold-300 animate-spin" />
            </div>
          ) : user ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Login />
          )
        }
      />
      <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/music" element={<RequireAuth><Music /></RequireAuth>} />
      <Route path="/videos" element={<RequireAuth><Videos /></RequireAuth>} />
      <Route path="/playlists" element={<RequireAuth><Playlists /></RequireAuth>} />
      <Route path="/history" element={<RequireAuth><History /></RequireAuth>} />
      <Route path="/favorites" element={<RequireAuth><Favorites /></RequireAuth>} />
      <Route path="/shared" element={<RequireAuth><Shared /></RequireAuth>} />
      <Route path="/my-groups" element={<RequireAuth><MyGroups /></RequireAuth>} />
      <Route path="/chat" element={<RequireAuth><Chat /></RequireAuth>} />
      <Route path="/mail" element={<RequireAuth><Mail /></RequireAuth>} />
      <Route path="/requests" element={<RequireAuth><Requests /></RequireAuth>} />
      <Route path="/invites" element={<RequireAuth><Invites /></RequireAuth>} />
      <Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
      <Route path="/register" element={<Register />} />
      <Route path="/trash" element={<RequireAuth><Trash /></RequireAuth>} />
      <Route path="/users" element={<RequireAuth><Users /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
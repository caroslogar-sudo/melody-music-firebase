import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { PlayerBar } from './PlayerBar';
import { SessionGuard } from './SessionGuard';
import { NotificationManager } from './NotificationManager';
import { MelodyLogo } from './MelodyLogo';
import { useApp } from '../context/AppContext';
import { Menu, X, Maximize, Minimize } from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { currentTrack } = useApp();

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const closeMenu = () => setMenuOpen(false);

  const hasPlayer = !!currentTrack && currentTrack.type !== 'video';

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden flex text-elegant-black font-sans bg-[#0a0a0a]">
      {/* Background gradients */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#050505] via-[#1a1a1a] to-[#8C6E19]/40" />
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-gold-500/10 via-transparent to-transparent opacity-50" />

      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <Sidebar onNavigate={closeMenu} />
      </div>

      {/* Mobile drawer overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-[90] md:hidden" onClick={closeMenu}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="absolute top-0 left-0 h-full w-72 z-[95] animate-slide-in overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <Sidebar onNavigate={closeMenu} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col h-full overflow-hidden z-10">
        {/* Mobile top bar */}
        <div className="flex md:hidden items-center justify-between px-3 py-2 relative z-20 flex-shrink-0">
          <button onClick={toggleMenu}
            className="p-2 bg-white/10 border border-white/20 rounded-xl text-white active:scale-95 transition-transform"
            aria-label="Abrir menu">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex items-center gap-2">
            <MelodyLogo size={26} />
            <span className="text-white font-bold text-sm">Melody Music</span>
          </div>
          <button onClick={toggleFullscreen}
            className="p-2 bg-white/10 border border-white/20 rounded-xl text-white active:scale-95 transition-transform"
            aria-label="Pantalla completa">
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>

        {/* Fullscreen button for desktop/tablet */}
        <button onClick={toggleFullscreen}
          className="hidden md:flex fixed top-4 right-1/2 translate-x-1/2 z-[60] p-2 bg-black/40 border border-white/15 rounded-xl text-white/50 hover:text-white hover:bg-gold-500/30 transition-all backdrop-blur-md items-center gap-2"
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>
          {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          <span className="text-[11px] font-medium hidden lg:inline">{isFullscreen ? 'Salir' : 'Pantalla completa'}</span>
        </button>

        {/* Page content - dynamic padding based on player visibility */}
        <div className={`flex-1 overflow-y-auto p-3 md:p-6 scroll-smooth ${hasPlayer ? 'pb-24 md:pb-28' : 'pb-4 md:pb-6'}`}>
          {children}
        </div>

        {/* Sticky Player */}
        {hasPlayer && (
          <div className="absolute bottom-0 left-0 right-0 p-2 md:p-3 pointer-events-none z-50">
            <div className="pointer-events-auto">
              <PlayerBar />
            </div>
          </div>
        )}
      </main>

      {/* Session inactivity guard */}
      <SessionGuard />

      {/* Real-time notifications */}
      <NotificationManager />
    </div>
  );
};
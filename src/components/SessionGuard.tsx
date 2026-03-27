import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { MelodyLogo } from './MelodyLogo';
import { CheckCircle } from 'lucide-react';

const INACTIVITY_MS = 60 * 60 * 1000; // 1 hour
const COUNTDOWN_TOTAL = 300; // 5 minutes in seconds

export const SessionGuard: React.FC = () => {
  const { user, logout } = useApp();
  const [showPrompt, setShowPrompt] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_TOTAL);

  const lastActivityRef = useRef(Date.now());
  const promptVisibleRef = useRef(false);
  const promptStartRef = useRef(0);
  const logoutRef = useRef(logout);

  useEffect(() => { logoutRef.current = logout; }, [logout]);
  useEffect(() => { promptVisibleRef.current = showPrompt; }, [showPrompt]);

  // Core check - works on wake from sleep too
  const checkInactivity = () => {
    if (promptVisibleRef.current) {
      // Prompt already showing - check if 5min expired (phone may have been sleeping)
      const elapsed = Math.floor((Date.now() - promptStartRef.current) / 1000);
      if (elapsed >= COUNTDOWN_TOTAL) {
        console.log('[SessionGuard] Auto-logout (background expired)');
        logoutRef.current();
        return;
      }
      setCountdown(Math.max(0, COUNTDOWN_TOTAL - elapsed));
      return;
    }
    const elapsed = Date.now() - lastActivityRef.current;
    if (elapsed >= INACTIVITY_MS) {
      console.log('[SessionGuard] Inactivity:', Math.round(elapsed / 60000), 'min');
      promptStartRef.current = Date.now();
      setShowPrompt(true);
      setCountdown(COUNTDOWN_TOTAL);
    }
  };

  useEffect(() => {
    if (!user) return;
    console.log('[SessionGuard] Started for', user.uid);

    const onActivity = () => {
      if (!promptVisibleRef.current) lastActivityRef.current = Date.now();
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'touchmove', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));

    // Check every 30s while active
    const interval = setInterval(checkInactivity, 30000);

    // MOBILE FIX: check when app comes back to foreground
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        console.log('[SessionGuard] Visible again, checking...');
        checkInactivity();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', checkInactivity);

    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity));
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', checkInactivity);
    };
  }, [user?.uid]);

  // Countdown - uses real timestamps, not interval ticks
  useEffect(() => {
    if (!showPrompt) return;
    promptStartRef.current = Date.now();

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - promptStartRef.current) / 1000);
      const remaining = COUNTDOWN_TOTAL - elapsed;
      if (remaining <= 0) {
        clearInterval(interval);
        logoutRef.current();
        setCountdown(0);
      } else {
        setCountdown(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [showPrompt]);

  const handleContinue = () => {
    setShowPrompt(false);
    setCountdown(COUNTDOWN_TOTAL);
    lastActivityRef.current = Date.now();
  };

  const handleLogout = () => {
    setShowPrompt(false);
    logout();
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (!showPrompt) return null;

  const pct = (countdown / COUNTDOWN_TOTAL) * 100;
  const color = countdown > 60 ? '#C8A23C' : countdown > 30 ? '#f59e0b' : '#ef4444';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
      <div className="w-full max-w-sm bg-[#161b22] border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
        style={{ animation: 'sgFade 0.3s ease-out' }}>
        <div className="h-1.5 bg-gray-800">
          <div className="h-full transition-all duration-1000 ease-linear rounded-full"
            style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>

        <div className="p-6 flex flex-col items-center gap-4">
          <MelodyLogo size={50} />
          <div className="text-center">
            <h3 className="text-lg font-bold text-white mb-1">Sigues ahi?</h3>
            <p className="text-sm text-gray-400">Tu sesion lleva 1 hora activa.</p>
          </div>

          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#1e293b" strokeWidth="6" />
              <circle cx="50" cy="50" r="42" fill="none" stroke={color}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - countdown / COUNTDOWN_TOTAL)}`}
                className="transition-all duration-1000 ease-linear" />
            </svg>
            <p className="text-2xl font-mono font-bold z-10" style={{ color }}>{fmt(countdown)}</p>
          </div>

          <p className="text-xs text-gray-500 text-center">La sesion se cerrara automaticamente si no respondes</p>

          <div className="flex gap-3 w-full">
            <button onClick={handleLogout}
              className="flex-1 bg-white/10 text-gray-300 py-3 rounded-xl font-bold text-sm border border-white/10 active:scale-95">
              Salir
            </button>
            <button onClick={handleContinue}
              className="flex-1 bg-gold-500 text-white py-3 rounded-xl font-bold text-sm shadow-lg active:scale-95 flex items-center justify-center gap-2">
              <CheckCircle size={16} /> Seguir conectado
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes sgFade{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
};
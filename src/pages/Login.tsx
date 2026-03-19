import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { GlassCard } from '../components/ui/GlassCard';
import { MelodyLogo } from '../components/MelodyLogo';
import { ArrowRight, Loader2, Eye, EyeOff, KeyRound, ArrowLeft } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebase';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const { login, loginError } = useApp();
  const navigate = useNavigate();

  // Splash screen on mobile/tablet
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      // Error is set in context
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail.trim()) { setResetMsg('Introduce tu email'); return; }
    setResetLoading(true);
    setResetMsg('');
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetMsg('Se ha enviado un enlace a tu correo para restablecer la contrasena');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') setResetMsg('No existe una cuenta con ese email');
      else if (err.code === 'auth/invalid-email') setResetMsg('El email no es valido');
      else setResetMsg('Error al enviar. Intentalo de nuevo.');
    }
    setResetLoading(false);
  };

  // Splash Screen
  if (showSplash) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-[#0a0a0a] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gold-500/5 via-transparent to-gold-300/5" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-gold-500/10 rounded-full blur-[100px]" />
        
        <div className="animate-fade-in flex flex-col items-center gap-6 z-10">
          <div className="animate-pulse">
            <MelodyLogo size={100} />
          </div>
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white tracking-tight">
              Melody <span className="text-gold-400">Music</span>
            </h1>
            <p className="text-gold-400/60 text-sm mt-2 tracking-[0.3em] uppercase font-light">Experiencia Musical Privada</p>
          </div>
          <div className="mt-4">
            <Loader2 size={20} className="text-gold-400/40 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative flex items-center justify-center overflow-hidden bg-[#0a0a0a]">
      <div className="absolute inset-0 bg-gradient-to-br from-black via-transparent to-gold-500/10" />
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-gold-500/15 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-gold-300/10 rounded-full blur-[120px]" />

      <GlassCard className="w-full max-w-md p-10 flex flex-col items-center gap-6 border-white/20 shadow-2xl relative z-10 bg-white/95 animate-fade-in">
        <MelodyLogo size={80} />

        <div className="text-center">
          <h2 className="text-3xl font-bold text-elegant-black tracking-tight">Melody Music</h2>
          <p className="text-gold-500 mt-2 font-medium tracking-wide text-sm">EXPERIENCIA MUSICAL PRIVADA</p>
        </div>

        {showReset ? (
          /* Reset password view */
          <div className="w-full flex flex-col gap-4 mt-2">
            <div className="flex items-center gap-2 mb-1">
              <KeyRound size={20} className="text-gold-500" />
              <h3 className="font-bold text-elegant-black">Restablecer contrasena</h3>
            </div>
            <p className="text-xs text-elegant-gray">Introduce tu email y te enviaremos un enlace para cambiar tu contrasena.</p>
            <div>
              <label className="block text-xs font-bold text-elegant-gray uppercase mb-2 ml-1">Email</label>
              <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="tu@email.com" autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                className="w-full bg-white border border-gold-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-gold-300 transition-all text-elegant-black placeholder-gray-400" />
            </div>
            {resetMsg && (
              <p className={'text-sm text-center font-medium py-2 rounded-lg ' + (resetMsg.includes('enviado') ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50')}>{resetMsg}</p>
            )}
            <button onClick={handleResetPassword} disabled={resetLoading || !resetEmail.trim()}
              className="w-full bg-gold-500 text-white font-semibold py-3 rounded-xl shadow-lg hover:bg-gold-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {resetLoading ? <Loader2 size={18} className="animate-spin" /> : <><KeyRound size={18} /><span>Enviar enlace</span></>}
            </button>
            <button onClick={() => { setShowReset(false); setResetMsg(''); setResetEmail(''); }}
              className="flex items-center justify-center gap-1 text-sm text-elegant-gray hover:text-gold-500 transition-colors">
              <ArrowLeft size={14} /> Volver al inicio de sesion
            </button>
          </div>
        ) : (
          /* Login form */
          <form onSubmit={handleLogin} className="w-full flex flex-col gap-4 mt-2">
            <div>
              <label className="block text-xs font-bold text-elegant-gray uppercase mb-2 ml-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com"
                className="w-full bg-white border border-gold-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-gold-300 transition-all text-elegant-black placeholder-gray-400" autoComplete="email" />
            </div>
            <div>
              <label className="block text-xs font-bold text-elegant-gray uppercase mb-2 ml-1">Contrasena</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="........"
                  className="w-full bg-white border border-gold-200 rounded-xl px-4 py-3 pr-12 outline-none focus:ring-2 focus:ring-gold-300 transition-all text-elegant-black placeholder-gray-400" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gold-500 transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="button" onClick={() => { setShowReset(true); setResetEmail(email); }}
              className="text-xs text-gold-500 hover:text-gold-600 font-medium self-end -mt-2 transition-colors">
              He olvidado mi contrasena
            </button>
            {loginError && <p className="text-red-500 text-sm text-center font-medium bg-red-50 py-2 rounded-lg">{loginError}</p>}
            <button type="submit" disabled={loading || !email || !password}
              className="w-full bg-elegant-black text-gold-100 font-semibold py-3 rounded-xl shadow-lg hover:bg-black hover:text-white transition-all flex items-center justify-center gap-2 group disabled:opacity-50">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <><span>Acceder</span><ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>}
            </button>
          </form>
        )}

        <p className="text-xs text-slate-400 mt-2">v7.2 · Acceso autorizado</p>
      </GlassCard>
    </div>
  );
};
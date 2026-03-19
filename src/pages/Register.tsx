import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { MelodyLogo } from '../components/MelodyLogo';
import { ArrowLeft, Loader2, Eye, EyeOff, UserPlus, CheckCircle, ShieldCheck } from 'lucide-react';
import { registerWithEmail } from '../services/authService';
import { validateInvitationCode, markInvitationUsed } from '../services/inviteService';

export const Register = () => {
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get('code') || '';

  const [inviteCode, setInviteCode] = useState(codeFromUrl);
  const [codeValid, setCodeValid] = useState<boolean | null>(null);
  const [validating, setValidating] = useState(false);
  const [invId, setInvId] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();

  // Auto-validate code from URL
  useEffect(() => {
    if (codeFromUrl) handleValidateCode(codeFromUrl);
  }, []);

  const handleValidateCode = async (code?: string) => {
    const c = (code || inviteCode).trim().toUpperCase();
    if (!c) return;
    setValidating(true);
    setCodeValid(null);
    try {
      const inv = await validateInvitationCode(c);
      if (inv) {
        setCodeValid(true);
        setInvId(inv.id);
        if (inv.email) setEmail(inv.email);
      } else {
        setCodeValid(false);
      }
    } catch { setCodeValid(false); }
    setValidating(false);
  };

  const handleRegister = async () => {
    setError('');
    if (!name.trim()) { setError('Introduce tu nombre'); return; }
    if (!email.trim()) { setError('Introduce tu email'); return; }
    if (password.length < 6) { setError('La contrasena debe tener al menos 6 caracteres'); return; }
    if (password !== password2) { setError('Las contrasenas no coinciden'); return; }

    setLoading(true);
    try {
      const appUser = await registerWithEmail(email.trim(), password, name.trim());
      // Mark invitation as used
      if (invId) await markInvitationUsed(invId, appUser.uid).catch(() => {});
      setSuccess(true);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') setError('Ya existe una cuenta con ese email');
      else if (err.code === 'auth/invalid-email') setError('El email no es valido');
      else if (err.code === 'auth/weak-password') setError('La contrasena es demasiado debil');
      else setError(err.message || 'Error al registrar');
    }
    setLoading(false);
  };

  // Success screen
  if (success) {
    return (
      <div className="w-full h-screen relative flex items-center justify-center overflow-hidden bg-[#0a0a0a]">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-transparent to-gold-500/10" />
        <GlassCard className="w-full max-w-md p-10 flex flex-col items-center gap-6 border-white/20 shadow-2xl relative z-10 bg-white/95 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle size={40} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-elegant-black text-center">Registro completado</h2>
          <p className="text-elegant-gray text-center text-sm">Tu cuenta ha sido creada. Un administrador revisara tu solicitud y aprobara tu acceso.</p>
          <div className="bg-gold-50 border border-gold-200 rounded-xl p-4 w-full">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={16} className="text-gold-500" />
              <p className="text-sm font-bold text-gold-700">Pendiente de aprobacion</p>
            </div>
            <p className="text-xs text-gold-600">Recibiras acceso cuando el administrador active tu cuenta.</p>
          </div>
          <button onClick={() => navigate('/')}
            className="w-full bg-elegant-black text-gold-100 font-semibold py-3 rounded-xl shadow-lg hover:bg-black hover:text-white transition-all flex items-center justify-center gap-2">
            Ir al inicio de sesion
          </button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative flex items-center justify-center overflow-hidden bg-[#0a0a0a]">
      <div className="absolute inset-0 bg-gradient-to-br from-black via-transparent to-gold-500/10" />
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-gold-500/15 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-gold-300/10 rounded-full blur-[120px]" />

      <GlassCard className="w-full max-w-md p-8 md:p-10 flex flex-col items-center gap-5 border-white/20 shadow-2xl relative z-10 bg-white/95 animate-fade-in max-h-[95vh] overflow-y-auto">
        <MelodyLogo size={60} />
        <div className="text-center">
          <h2 className="text-2xl font-bold text-elegant-black tracking-tight">Registro</h2>
          <p className="text-gold-500 mt-1 font-medium tracking-wide text-xs">MELODY MUSIC</p>
        </div>

        {/* Step 1: Invitation code */}
        {codeValid !== true ? (
          <div className="w-full flex flex-col gap-4">
            <p className="text-xs text-elegant-gray text-center">Necesitas un codigo de invitacion para registrarte.</p>
            <div>
              <label className="block text-xs font-bold text-elegant-gray uppercase mb-2 ml-1">Codigo de invitacion</label>
              <div className="flex gap-2">
                <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="XXXXXXXX" maxLength={8}
                  onKeyDown={(e) => e.key === 'Enter' && handleValidateCode()}
                  className="flex-1 bg-white border border-gold-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-gold-300 text-elegant-black placeholder-gray-400 text-center font-mono text-lg tracking-widest uppercase" />
                <button onClick={() => handleValidateCode()} disabled={validating || !inviteCode.trim()}
                  className="bg-gold-500 text-white px-5 py-3 rounded-xl font-bold disabled:opacity-50 hover:bg-gold-600 transition-colors">
                  {validating ? <Loader2 size={18} className="animate-spin" /> : 'Validar'}
                </button>
              </div>
            </div>
            {codeValid === false && (
              <p className="text-red-500 text-sm text-center bg-red-50 py-2 rounded-lg">Codigo invalido o expirado</p>
            )}
            <button onClick={() => navigate('/')}
              className="flex items-center justify-center gap-1 text-sm text-elegant-gray hover:text-gold-500 transition-colors mt-2">
              <ArrowLeft size={14} /> Ya tengo cuenta
            </button>
          </div>
        ) : (
          /* Step 2: Registration form */
          <div className="w-full flex flex-col gap-3">
            <div className="bg-green-50 border border-green-200 rounded-xl p-2.5 flex items-center gap-2">
              <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
              <p className="text-xs text-green-700 font-medium">Codigo valido - Completa tu registro</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-elegant-gray uppercase mb-1.5 ml-1">Nombre</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre"
                className="w-full bg-white border border-gold-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-gold-300 text-elegant-black placeholder-gray-400 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-elegant-gray uppercase mb-1.5 ml-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com"
                className="w-full bg-white border border-gold-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-gold-300 text-elegant-black placeholder-gray-400 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-elegant-gray uppercase mb-1.5 ml-1">Contrasena</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimo 6 caracteres"
                  className="w-full bg-white border border-gold-200 rounded-xl px-4 py-2.5 pr-12 outline-none focus:ring-2 focus:ring-gold-300 text-elegant-black placeholder-gray-400 text-sm" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gold-500">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-elegant-gray uppercase mb-1.5 ml-1">Repetir contrasena</label>
              <input type={showPassword ? 'text' : 'password'} value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="Repite la contrasena"
                className="w-full bg-white border border-gold-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-gold-300 text-elegant-black placeholder-gray-400 text-sm" />
            </div>
            {error && <p className="text-red-500 text-sm text-center bg-red-50 py-2 rounded-lg">{error}</p>}
            <button onClick={handleRegister} disabled={loading}
              className="w-full bg-elegant-black text-gold-100 font-semibold py-3 rounded-xl shadow-lg hover:bg-black hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-1">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <><UserPlus size={18} /><span>Crear cuenta</span></>}
            </button>
            <button onClick={() => navigate('/')}
              className="flex items-center justify-center gap-1 text-sm text-elegant-gray hover:text-gold-500 transition-colors">
              <ArrowLeft size={14} /> Ya tengo cuenta
            </button>
          </div>
        )}
      </GlassCard>
    </div>
  );
};
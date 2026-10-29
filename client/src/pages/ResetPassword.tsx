import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, KeyRound, ArrowRight } from 'lucide-react';

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenEmail, setTokenEmail] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setTokenValid(false);
      setTokenError('Geen herstel-token gevonden in de link. Vraag een nieuwe herstellink aan.');
      return;
    }

    const checkToken = async () => {
      try {
        const res = await fetch(`/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Deze herstellink is ongeldig of verlopen.');
        }
        setTokenValid(true);
        setTokenEmail(data.email);
      } catch (err: any) {
        setTokenValid(false);
        setTokenError(err?.message || 'Controle van herstellink mislukt.');
      } finally {
        setVerifying(false);
      }
    };

    checkToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (password.length < 6) {
      setSubmitError('Het nieuwe wachtwoord moet minimaal 6 tekens bevatten.');
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError('De wachtwoorden komen niet overeen.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Wachtwoord instellen mislukt.');
      }

      setSuccess(true);
    } catch (err: any) {
      setSubmitError(err?.message || 'Er is een fout opgetreden.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-7 shadow-xl">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-400 mb-3 shadow-inner">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Nieuw Wachtwoord</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-center">
            {tokenEmail ? `Voor account ${tokenEmail}` : 'Kies een nieuw, veilig wachtwoord voor uw account'}
          </p>
        </div>

        {verifying ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-3 text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
            <span>Herstellink verifiëren...</span>
          </div>
        ) : !tokenValid ? (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-800 dark:text-rose-300 space-y-2">
              <div className="flex items-center space-x-2 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>Link Ongeldig of Verlopen</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {tokenError || 'Deze herstellink is niet meer geldig. Vraag via het inlogscherm een nieuwe link aan.'}
              </p>
            </div>

            <div className="pt-2 text-center">
              <Link
                to="/forgot-password"
                className="px-4 py-2 bg-slate-900 hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition"
              >
                <span>Nieuwe Link Aanvragen</span>
              </Link>
            </div>
          </div>
        ) : success ? (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 space-y-2">
              <div className="flex items-center space-x-2 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Wachtwoord Succesvol Gewijzigd!</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Uw nieuwe wachtwoord is opgeslagen. U kunt nu direct inloggen met uw nieuwe inloggegevens.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full py-2.5 bg-accent-600 text-white hover:bg-accent-700 rounded-xl font-bold transition flex items-center justify-center space-x-2 shadow-md hover:scale-[1.01]"
            >
              <span>Direct Inloggen</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {submitError && (
              <div className="flex items-center space-x-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-xl font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Nieuw Wachtwoord
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimaal 6 tekens"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-10 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-sky-500 shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Wachtwoord Bevestigen
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Herhaal nieuw wachtwoord"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-10 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-sky-500 shadow-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-accent-600 text-white hover:bg-accent-700 rounded-xl font-bold transition disabled:opacity-50 flex items-center justify-center space-x-2 mt-2 shadow-md hover:scale-[1.01]"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>{submitting ? 'Opslaan...' : 'Wachtwoord Opslaan'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

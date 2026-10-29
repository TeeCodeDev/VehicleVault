import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login, user, authDisabled } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user || authDisabled) {
      navigate('/', { replace: true });
    }
  }, [user, authDisabled, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password, rememberMe);
      navigate('/');
    } catch (err: any) {
      setError(err?.message || 'Inloggen mislukt. Controleer uw gegevens.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-7 shadow-xl">
        <div className="flex flex-col items-center mb-6">
          <img src="/icon-512.png" alt="VehicleVault" className="w-16 h-16 object-contain mb-3 drop-shadow-md" />
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">VehicleVault</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Log in op uw self-hosted wagenparkdashboard
          </p>
        </div>

        {error && (
          <div className="flex items-center space-x-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-xl mb-4 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">E-mailadres</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="bestuurder@voorbeeld.nl"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-sky-500 shadow-sm font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Wachtwoord</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-sky-500 shadow-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center space-x-2 text-slate-600 dark:text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-accent-600 focus:ring-accent-500/20"
              />
              <span className="text-[11px] font-medium">Blijf ingelogd</span>
            </label>

            <Link
              to="/forgot-password"
              className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline"
            >
              Wachtwoord vergeten?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-accent-600 text-white hover:bg-accent-700 rounded-xl font-bold transition disabled:opacity-50 flex items-center justify-center space-x-2 mt-3 shadow-md hover:scale-[1.01]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>{loading ? 'Bezig met inloggen...' : 'Inloggen'}</span>
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-4">
          <span>Nog geen account aangemaakt? </span>
          <Link to="/register" className="text-sky-600 dark:text-sky-400 hover:underline font-bold">
            Account Registreren
          </Link>
        </div>
      </div>
    </div>
  );
};

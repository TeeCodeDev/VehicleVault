import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle2, AlertCircle, KeyRound, ExternalLink } from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    resetLink?: string;
    smtpConfigured?: boolean;
    emailSent?: boolean;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Aanvraag mislukt');
      }

      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Er is een fout opgetreden bij het aanvragen van het herstel.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-7 shadow-xl">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-400 mb-3 shadow-inner">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Wachtwoord Vergeten?</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-center">
            Vul uw e-mailadres in om een herstellink te ontvangen.
          </p>
        </div>

        {error && (
          <div className="flex items-center space-x-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-xl mb-4 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result ? (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2 text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center space-x-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Herstelaanvraag Verwerkt</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {result.message}
              </p>
            </div>

            {/* Fallback direct reset link for homelab setups without SMTP */}
            {result.resetLink && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2">
                <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200 block">
                  ⚙️ Homelab / Directe Herstellink
                </span>
                <p className="text-[10px] text-amber-700 dark:text-amber-300">
                  Omdat SMTP e-mail nog niet is geconfigureerd, kunt u direct deze gegenereerde link gebruiken:
                </p>
                <a
                  href={result.resetLink}
                  className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1.5 transition break-all"
                >
                  <span>Wachtwoord nu herstellen</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              </div>
            )}

            <div className="pt-2 text-center">
              <Link
                to="/login"
                className="inline-flex items-center space-x-1.5 text-xs text-sky-600 dark:text-sky-400 font-bold hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Terug naar Inloggen</span>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">E-mailadres</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="bestuurder@voorbeeld.nl"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-sky-500 shadow-sm font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-accent-600 text-white hover:bg-accent-700 rounded-xl font-bold transition disabled:opacity-50 flex items-center justify-center space-x-2 mt-2 shadow-md hover:scale-[1.01]"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>{loading ? 'Bezig met versturen...' : 'Herstellink Aanvragen'}</span>
            </button>

            <div className="pt-3 text-center border-t border-slate-100 dark:border-slate-800">
              <Link
                to="/login"
                className="inline-flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white font-medium transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Terug naar inloggen</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

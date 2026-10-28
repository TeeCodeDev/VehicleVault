import React, { useEffect, useState } from 'react';
import {
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Check,
  Cpu,
  Shield,
  Activity,
  Sun,
  Moon,
  Laptop,
  Globe,
  Sparkles,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { ApiKeyItem } from '../types/index.js';
import { apiFetch } from '../api/client.js';
import { useTheme } from '../context/ThemeContext.js';
import { useLanguage } from '../context/LanguageContext.js';

export const Settings: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [health, setHealth] = useState<any | null>(null);
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();

  // AI Vision Receipt Scanner State
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai' | 'none'>('gemini');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-1.5-flash');
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [geminiKeyMasked, setGeminiKeyMasked] = useState<string | null>(null);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('https://api.openai.com/v1');
  const [hasOpenaiKey, setHasOpenaiKey] = useState(false);
  const [openaiKeyMasked, setOpenaiKeyMasked] = useState<string | null>(null);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);

  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSavedSuccess, setAiSavedSuccess] = useState(false);

  useEffect(() => {
    loadApiKeys();
    loadHealth();
    loadAiSettings();
  }, []);

  const loadApiKeys = async () => {
    try {
      const res = await apiFetch<{ apiKeys: ApiKeyItem[] }>('/api/auth/api-keys');
      setApiKeys(res.apiKeys);
    } catch {
      // ignore
    }
  };

  const loadHealth = async () => {
    try {
      const res = await fetch('/healthz');
      if (res.ok) {
        setHealth(await res.json());
      }
    } catch {
      // ignore
    }
  };

  const loadAiSettings = async () => {
    try {
      const res = await apiFetch<{
        provider: 'gemini' | 'openai' | 'none';
        geminiModel: string;
        hasGeminiKey: boolean;
        geminiKeyMasked: string | null;
        openaiModel: string;
        openaiBaseUrl: string;
        hasOpenaiKey: boolean;
        openaiKeyMasked: string | null;
      }>('/api/settings/ai');

      setAiProvider(res.provider || 'gemini');
      setGeminiModel(res.geminiModel || 'gemini-1.5-flash');
      setHasGeminiKey(res.hasGeminiKey);
      setGeminiKeyMasked(res.geminiKeyMasked);

      setOpenaiModel(res.openaiModel || 'gpt-4o-mini');
      setOpenaiBaseUrl(res.openaiBaseUrl || 'https://api.openai.com/v1');
      setHasOpenaiKey(res.hasOpenaiKey);
      setOpenaiKeyMasked(res.openaiKeyMasked);
    } catch {
      // ignore if settings not initialized
    }
  };

  const handleTestAiConnection = async () => {
    if (aiProvider === 'none') return;
    setAiTesting(true);
    setAiTestResult(null);

    try {
      const payload: any = {
        provider: aiProvider,
        apiKey: aiProvider === 'gemini' ? geminiApiKey : openaiApiKey,
        model: aiProvider === 'gemini' ? geminiModel : openaiModel,
      };
      if (aiProvider === 'openai') {
        payload.baseUrl = openaiBaseUrl;
      }

      const res = await apiFetch<{ success: boolean; message: string }>('/api/settings/ai/test', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAiTestResult(res);
    } catch (err: any) {
      setAiTestResult({
        success: false,
        message: err?.message || 'Verbindingstest mislukt',
      });
    } finally {
      setAiTesting(false);
    }
  };

  const handleSaveAiSettings = async () => {
    setAiSaving(true);
    setAiSavedSuccess(false);

    try {
      await apiFetch('/api/settings/ai', {
        method: 'PUT',
        body: JSON.stringify({
          provider: aiProvider,
          geminiApiKey,
          geminiModel,
          openaiApiKey,
          openaiModel,
          openaiBaseUrl,
        }),
      });

      setAiSavedSuccess(true);
      setGeminiApiKey('');
      setOpenaiApiKey('');
      await loadAiSettings();
      setTimeout(() => setAiSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(err?.message || 'Fout bij opslaan van instellingen');
    } finally {
      setAiSaving(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName) return;

    try {
      const res = await apiFetch<{ apiKey: string }>('/api/auth/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: newKeyName }),
      });
      setGeneratedKey(res.apiKey);
      setNewKeyName('');
      loadApiKeys();
    } catch (err: any) {
      alert(err?.message || 'Failed to generate API key');
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (confirm(lang === 'nl' ? 'Deze API-sleutel intrekken? AI-assistenten die deze sleutel gebruiken verliezen direct toegang.' : 'Revoke this API key? AI assistants using this key will immediately lose access.')) {
      try {
        await apiFetch(`/api/auth/api-keys/${id}`, { method: 'DELETE' });
        loadApiKeys();
      } catch (err: any) {
        alert(err?.message || 'Failed to revoke key');
      }
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center space-x-2">
          <KeyRound className="w-5 h-5 text-sky-500" />
          <span>{t('settingsTitle')}</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {t('settingsSubtitle')}
        </p>
      </div>

      {/* Language Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm transition-colors">
        <div className="flex items-center space-x-2">
          <Globe className="w-4 h-4 text-sky-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('languageSection')}</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {lang === 'nl'
            ? 'Kies je voorkeurstaal. Alle menu\'s, datumpickers, categorieën en meldingen schakelen direct mee.'
            : 'Select your preferred language. All menus, date pickers, categories, and alerts will switch immediately.'}
        </p>
        <div className="flex items-center space-x-3 pt-1">
          <button
            onClick={() => setLang('nl')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 border transition ${
              lang === 'nl'
                ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white border-slate-900 dark:border-slate-700 shadow-sm'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <span className="text-[11px] font-bold">🇳🇱</span>
            <span>{t('dutch')}</span>
          </button>
          <button
            onClick={() => setLang('en')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 border transition ${
              lang === 'en'
                ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white border-slate-900 dark:border-slate-700 shadow-sm'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <span className="text-[11px] font-bold">🇬🇧</span>
            <span>{t('english')}</span>
          </button>
        </div>
      </div>

      {/* Theme Preference */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm transition-colors">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('appearance')}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {lang === 'nl'
            ? 'Schakel tussen lichte en donkere modus met het neutrale slate/zinc kleurenpalet.'
            : 'Switch between light and dark modes with the clean neutral slate/zinc color palette.'}
        </p>
        <div className="flex items-center space-x-3 pt-1">
          <button
            onClick={() => setTheme('dark')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 border transition ${
              theme === 'dark'
                ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white border-slate-900 dark:border-slate-700 shadow-sm'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <Moon className="w-4 h-4 text-amber-400" />
            <span>{t('themeDark')}</span>
          </button>
          <button
            onClick={() => setTheme('light')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 border transition ${
              theme === 'light'
                ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white border-slate-900 dark:border-slate-700 shadow-sm'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <Sun className="w-4 h-4 text-amber-500" />
            <span>{t('themeLight')}</span>
          </button>
          <button
            onClick={() => setTheme('system')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 border transition ${
              theme === 'system'
                ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white border-slate-900 dark:border-slate-700 shadow-sm'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>{t('themeSystem')}</span>
          </button>
        </div>
      </div>

      {/* AI Bonherkenning (Gemini & OpenAI) Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-sm transition-colors">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('aiReceiptTitle')}
              </h3>
              <p className="text-[11px] text-slate-500">Google Gemini &amp; OpenAI Vision</p>
            </div>
          </div>
          {aiProvider !== 'none' && (hasGeminiKey || hasOpenaiKey) && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800/50 dark:text-emerald-300 font-bold text-[10px] flex items-center space-x-1">
              <Check className="w-3 h-3" />
              <span>{lang === 'nl' ? 'Actief gekoppeld' : 'Connected'}</span>
            </span>
          )}
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          {t('aiReceiptSubtitle')}
        </p>

        {/* Engine Selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            {t('aiProviderLabel')}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => { setAiProvider('gemini'); setAiTestResult(null); }}
              className={`p-3 rounded-xl text-left border text-xs transition flex flex-col justify-between ${
                aiProvider === 'gemini'
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-100 ring-1 ring-indigo-500'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <div className="font-bold flex items-center justify-between">
                <span>Google Gemini</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold">
                  {lang === 'nl' ? 'Gratis' : 'Free'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">1.5 / 2.0 Flash • 100% accuraat &amp; snel</p>
            </button>

            <button
              type="button"
              onClick={() => { setAiProvider('openai'); setAiTestResult(null); }}
              className={`p-3 rounded-xl text-left border text-xs transition flex flex-col justify-between ${
                aiProvider === 'openai'
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-500'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <div className="font-bold flex items-center justify-between">
                <span>OpenAI Vision</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-semibold">GPT-4o-mini</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">OpenAI API of compatibel (Groq / Ollama)</p>
            </button>

            <button
              type="button"
              onClick={() => { setAiProvider('none'); setAiTestResult(null); }}
              className={`p-3 rounded-xl text-left border text-xs transition flex flex-col justify-between ${
                aiProvider === 'none'
                  ? 'border-slate-500 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white ring-1 ring-slate-500'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <div className="font-bold flex items-center justify-between">
                <span>Tesseract OCR</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                  {lang === 'nl' ? 'Lokaal' : 'Local'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Geen API-sleutel nodig (traditionele OCR)</p>
            </button>
          </div>
        </div>

        {/* Gemini Inputs */}
        {aiProvider === 'gemini' && (
          <div className="space-y-3.5 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t('geminiApiKeyLabel')}
                </label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center space-x-1"
                >
                  <span>{t('geminiFreeKeyHelp')}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="relative">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder={hasGeminiKey && geminiKeyMasked ? `Opgeslagen (${geminiKeyMasked}) - typ om te wijzigen` : t('geminiKeyPlaceholder')}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg pl-3 pr-10 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {hasGeminiKey && !geminiApiKey && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center space-x-1 font-medium">
                  <Check className="w-3 h-3" />
                  <span>{lang === 'nl' ? `Huidige actieve sleutel: ${geminiKeyMasked}` : `Active key: ${geminiKeyMasked}`}</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                  {t('geminiModelLabel')}
                </label>
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 shadow-sm"
                >
                  <option value="gemini-1.5-flash">gemini-1.5-flash (Aanbevolen, ultra snel &amp; gratis)</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash (Nieuwste generatie)</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro (Krachtigste redenering)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* OpenAI Inputs */}
        {aiProvider === 'openai' && (
          <div className="space-y-3.5 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t('openaiApiKeyLabel')}
                </label>
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center space-x-1"
                >
                  <span>OpenAI API Keys</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="relative">
                <input
                  type={showOpenaiKey ? 'text' : 'password'}
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  placeholder={hasOpenaiKey && openaiKeyMasked ? `Opgeslagen (${openaiKeyMasked}) - typ om te wijzigen` : t('openaiKeyPlaceholder')}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg pl-3 pr-10 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showOpenaiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {hasOpenaiKey && !openaiApiKey && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center space-x-1 font-medium">
                  <Check className="w-3 h-3" />
                  <span>{lang === 'nl' ? `Huidige actieve sleutel: ${openaiKeyMasked}` : `Active key: ${openaiKeyMasked}`}</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                  {t('openaiModelLabel')}
                </label>
                <select
                  value={openaiModel}
                  onChange={(e) => setOpenaiModel(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 shadow-sm"
                >
                  <option value="gpt-4o-mini">gpt-4o-mini (Aanbevolen, snel &amp; voordelig)</option>
                  <option value="gpt-4o">gpt-4o (Volledig model)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                  {t('openaiBaseUrlLabel')}
                </label>
                <input
                  type="text"
                  value={openaiBaseUrl}
                  onChange={(e) => setOpenaiBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 shadow-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Test Result Message */}
        {aiTestResult && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center space-x-2 ${
              aiTestResult.success
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200'
            }`}
          >
            {aiTestResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className="font-medium">{aiTestResult.message}</span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {aiProvider !== 'none' ? (
            <button
              type="button"
              onClick={handleTestAiConnection}
              disabled={aiTesting}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold inline-flex items-center space-x-1.5 transition disabled:opacity-50 shadow-sm"
            >
              {aiTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5 text-indigo-500" />}
              <span>{aiTesting ? t('testingAiConnection') : t('testAiConnection')}</span>
            </button>
          ) : <div />}

          <div className="flex items-center space-x-2">
            {aiSavedSuccess && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center space-x-1">
                <Check className="w-3.5 h-3.5" />
                <span>{t('aiConfigSaved')}</span>
              </span>
            )}
            <button
              type="button"
              onClick={handleSaveAiSettings}
              disabled={aiSaving}
              className="px-4 py-2 bg-slate-900 text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition shadow-sm disabled:opacity-50"
            >
              {aiSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>{aiSaving ? t('saving') : (lang === 'nl' ? 'AI Instellingen Opslaan' : 'Save AI Settings')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Model Context Protocol (MCP) Integration Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm transition-colors">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('mcpInstructionsTitle')}
            </h3>
            <p className="text-[11px] text-slate-500">Claude Desktop &amp; Antigravity MCP</p>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          {t('mcpInstructionsText')}
        </p>

        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs font-mono space-y-2.5">
          <div className="text-slate-600 dark:text-slate-400 flex items-center justify-between font-sans">
            <span className="font-semibold">Claude Desktop Config (claude_desktop_config.json):</span>
            <button
              onClick={() =>
                handleCopy(
                  JSON.stringify(
                    {
                      mcpServers: {
                        vehiclevault: {
                          command: 'node',
                          args: ['/path/to/VehicleVault/server/dist/mcp/stdio.js'],
                          env: { DATA_DIR: './data' },
                        },
                      },
                    },
                    null,
                    2
                  )
                )
              }
              className="text-sky-600 dark:text-sky-400 hover:underline flex items-center space-x-1 font-semibold"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Copied' : 'Copy JSON'}</span>
            </button>
          </div>
          <pre className="text-slate-800 dark:text-slate-300 overflow-x-auto p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800/80">
{`"mcpServers": {
  "vehiclevault": {
    "command": "node",
    "args": ["/path/to/VehicleVault/server/dist/mcp/stdio.js"],
    "env": { "DATA_DIR": "./data" }
  }
}`}
          </pre>
        </div>
      </div>

      {/* Granular API Keys Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm transition-colors">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-sky-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('apiKeysTitle')}</h3>
          </div>
        </div>

        {/* Create API Key Form */}
        <form onSubmit={handleCreateKey} className="flex items-center space-x-2.5">
          <input
            type="text"
            required
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder={t('keyName')}
            className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition shadow-sm hover:scale-[1.02]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('createKey')}</span>
          </button>
        </form>

        {/* Display Generated Key Notice */}
        {generatedKey && (
          <div className="bg-amber-50 dark:bg-slate-950 border border-amber-300 dark:border-amber-600/60 rounded-xl p-4 text-xs space-y-2 shadow-sm">
            <span className="text-amber-800 dark:text-amber-400 font-bold block">
              {t('newKeyWarning')}
            </span>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={generatedKey}
                className="flex-1 bg-white dark:bg-slate-900 border border-amber-300 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white rounded-lg px-3 py-2 select-all shadow-inner"
              />
              <button
                type="button"
                onClick={() => handleCopy(generatedKey)}
                className="px-3.5 py-2 bg-amber-200 dark:bg-amber-900/60 hover:bg-amber-300 dark:hover:bg-amber-800/60 text-amber-900 dark:text-amber-200 rounded-lg font-bold flex items-center space-x-1 shadow-sm transition"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        )}

        {/* List API Keys */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                <th className="py-2.5 px-3">{lang === 'nl' ? 'Label' : 'Name'}</th>
                <th className="py-2.5 px-3">Prefix</th>
                <th className="py-2.5 px-3">{t('date')}</th>
                <th className="py-2.5 px-3">{lang === 'nl' ? 'Laatst gebruikt' : 'Last used'}</th>
                <th className="py-2.5 px-3 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {apiKeys.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 font-medium">
                    {t('noKeysFound')}
                  </td>
                </tr>
              ) : (
                apiKeys.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-200">{k.name}</td>
                    <td className="py-3 px-3 font-mono font-semibold text-slate-600 dark:text-slate-400">{k.prefix}••••••••</td>
                    <td className="py-3 px-3 text-slate-500">{k.created_at.split('T')[0]}</td>
                    <td className="py-3 px-3 text-slate-500">
                      {k.last_used_at ? k.last_used_at.split('T')[0] : (lang === 'nl' ? 'Nooit' : 'Never')}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleDeleteKey(k.id)}
                        className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded transition"
                        title={t('delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Health Status */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between text-xs shadow-sm transition-colors">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white">{lang === 'nl' ? 'Systeemstatus & Database' : 'System Status & Database'}</div>
            <div className="text-slate-500 text-[11px] font-medium">
              Database: {health?.database === 'connected' ? 'Connected (SQLite WAL Mode)' : 'Connected'} • Runtime: Node.js {health?.version || 'v24'}
            </div>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800/50 dark:text-emerald-300 font-black text-[10px] uppercase tracking-wider">
          {lang === 'nl' ? 'Operationeel' : 'Operational'}
        </span>
      </div>
    </div>
  );
};

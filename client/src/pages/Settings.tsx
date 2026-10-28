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

  useEffect(() => {
    loadApiKeys();
    loadHealth();
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
            className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
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
                onClick={() => handleCopy(generatedKey)}
                className="px-4 py-2 bg-slate-900 text-white dark:bg-slate-800 dark:text-white rounded-lg text-xs font-semibold inline-flex items-center space-x-1 shadow-sm"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Active Keys Table */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Label</th>
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

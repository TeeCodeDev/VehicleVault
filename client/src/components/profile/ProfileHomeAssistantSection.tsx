import React, { useState, useEffect } from 'react';
import {
  Radio,
  Plus,
  Trash2,
  Copy,
  Check,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { apiFetch } from '../../api/client.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { ApiKeyItem } from '../../types/index.js';
import { formatDisplayDate } from '../../utils/format.js';

export const ProfileHomeAssistantSection: React.FC = () => {
  const { t } = useLanguage();
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedYaml, setCopiedYaml] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  const loadKeys = async () => {
    try {
      const res = await apiFetch<{ apiKeys: ApiKeyItem[] }>('/api/auth/api-keys');
      setApiKeys(res.apiKeys || []);
    } catch {}
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ apiKey: string }>('/api/auth/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      setGeneratedKey(res.apiKey);
      setNewKeyName('');
      loadKeys();
    } catch (err: any) {
      alert(err?.message || t('profileKeyCreateFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm(t('profileConfirmRevokeKey'))) return;
    try {
      await apiFetch(`/api/auth/api-keys/${id}`, { method: 'DELETE' });
      loadKeys();
    } catch (err: any) {
      alert(err?.message || t('deleteFailed'));
    }
  };

  const haHost = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3084';
  const effectiveKey = generatedKey || (apiKeys[0]?.prefix ? `${apiKeys[0].prefix}... (plaats hier je volledige API Key)` : 'UW_VEHICLEVAULT_API_KEY');

  const sensorYaml = `# Home Assistant configuration.yaml (Sensoren uitlezen)
rest:
  - resource: ${haHost}/api/integrations/ha/sensors
    scan_interval: 300
    headers:
      x-api-key: ${effectiveKey}
    sensor:
      - name: "VehicleVault Odometer"
        value_template: "{{ value_json.vehicles[0].odometer }}"
        unit_of_measurement: "km"
        icon: "mdi:counter"
      - name: "VehicleVault APK Status"
        value_template: "{{ value_json.vehicles[0].apk.status }}"
        icon: "mdi:shield-check"
      - name: "VehicleVault Fuel Consumption"
        value_template: "{{ value_json.vehicles[0].fuel_stats.consumption_l_per_100km }}"
        unit_of_measurement: "L/100km"
        icon: "mdi:gas-station"
`;

  const odoYaml = `# Home Assistant configuration.yaml (Kilometerstand doorsturen)
rest_command:
  update_vehiclevault_odometer:
    url: "${haHost}/api/integrations/ha/odometer"
    method: POST
    headers:
      x-api-key: "${effectiveKey}"
      content-type: "application/json"
    payload: '{"license_plate": "{{ plate }}", "odometer": {{ odo | float }} }'
`;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 rounded-xl border border-sky-200 dark:border-sky-800/60">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center space-x-2">
              <span>{t('profileHaTitle')}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('profileHaHint')}
            </p>
          </div>
        </div>
        <a
          href="https://github.com/TeeCodeDev/ha-vehiclevault"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-sky-600 dark:text-sky-400 font-bold hover:underline flex items-center space-x-1"
        >
          <span>{t('profileHacsLink')}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {generatedKey && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-1.5 animate-fade-in">
          <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{t('profileKeyCreated')}</span>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={generatedKey}
              className="flex-1 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-white font-mono select-all font-bold"
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(generatedKey);
                setCopiedKey(true);
                setTimeout(() => setCopiedKey(false), 2000);
              }}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1 shrink-0"
            >
              {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey ? t('copied') : t('copy')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Active API keys */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
          {t('profileMyApiKeys', { count: apiKeys.length })}
        </span>
        {apiKeys.length === 0 ? (
          <p className="text-xs text-slate-400 italic">{t('profileNoApiKeys')}</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/30">
            {apiKeys.map((k) => (
              <div key={k.id} className="p-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">{k.name}</span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {k.prefix}... • {t('profileKeyCreatedOn', { date: formatDisplayDate(k.created_at) })}
                    {k.last_used_at ? ` • ${t('profileKeyLastUsed', { date: formatDisplayDate(k.last_used_at) })}` : ''}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteKey(k.id)}
                  className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                  title={t('profileRevokeKey')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Key Form */}
      <form onSubmit={handleCreateKey} className="flex items-center space-x-2">
        <input
          type="text"
          placeholder={t('profileKeyNamePlaceholder')}
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-accent-500"
        />
        <button
          type="submit"
          disabled={loading || !newKeyName.trim()}
          className="px-3.5 py-1.5 bg-accent-600 hover:bg-accent-700 text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1 transition disabled:opacity-50 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('profileCreateKey')}</span>
        </button>
      </form>

      {/* Pre-configured YAML Snippets */}
      <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {t('profileSensorYamlTitle')}
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(sensorYaml);
                setCopiedYaml(true);
                setTimeout(() => setCopiedYaml(false), 2000);
              }}
              className="text-xs text-sky-600 dark:text-sky-400 font-bold hover:underline flex items-center space-x-1"
            >
              {copiedYaml ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              <span>{copiedYaml ? t('copied') : t('profileCopySensorYaml')}</span>
            </button>
          </div>
          <pre className="p-3 bg-slate-950 text-slate-300 font-mono text-[11px] rounded-xl overflow-x-auto border border-slate-800">
            {sensorYaml}
          </pre>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {t('profileOdoYamlTitle')}
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(odoYaml);
                setCopiedCommand(true);
                setTimeout(() => setCopiedCommand(false), 2000);
              }}
              className="text-xs text-sky-600 dark:text-sky-400 font-bold hover:underline flex items-center space-x-1"
            >
              {copiedCommand ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              <span>{copiedCommand ? t('copied') : t('profileCopyCommandYaml')}</span>
            </button>
          </div>
          <pre className="p-3 bg-slate-950 text-slate-300 font-mono text-[11px] rounded-xl overflow-x-auto border border-slate-800">
            {odoYaml}
          </pre>
        </div>
      </div>
    </div>
  );
};

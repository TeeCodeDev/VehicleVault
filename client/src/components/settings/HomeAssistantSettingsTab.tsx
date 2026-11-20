import React, { useState, useEffect } from 'react';
import {
  Radio,
  Copy,
  Check,
  ExternalLink,
  Terminal,
  Zap,
  KeyRound,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { apiFetch } from '../../api/client.js';
import { useLanguage } from '../../context/LanguageContext.js';
import { ApiKeyItem } from '../../types/index.js';
import { HomeAssistantTelematicsCard } from './HomeAssistantTelematicsCard.js';

interface HomeAssistantSettingsTabProps {
  onNavigateToUsers: () => void;
}

/** Replaces `{name}` placeholders in a translated string with React nodes (e.g. <code> or <strong>). */
const fillSlots = (text: string, slots: Record<string, React.ReactNode>) =>
  text.split(/(\{\w+\})/).map((part, i) => {
    const name = part.match(/^\{(\w+)\}$/)?.[1];
    return <React.Fragment key={i}>{name && name in slots ? slots[name] : part}</React.Fragment>;
  });

export const HomeAssistantSettingsTab: React.FC<HomeAssistantSettingsTabProps> = ({
  onNavigateToUsers,
}) => {
  const { t } = useLanguage();
  const [haCopied, setHaCopied] = useState(false);
  const [haOdoCopied, setHaOdoCopied] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);

  useEffect(() => {
    apiFetch<{ apiKeys: ApiKeyItem[] }>('/api/auth/api-keys')
      .then((res) => setApiKeys(res.apiKeys || []))
      .catch(() => {});
  }, []);

  const haHost = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3084';
  const haKeyPrefix = apiKeys[0]?.prefix ? `${apiKeys[0].prefix}... (plaats hier je volledige API Key)` : 'UW_VEHICLEVAULT_API_KEY';

  const haYamlConfig = `# Home Assistant configuration.yaml
# Integratie met VehicleVault via REST Sensors
rest:
  - resource: ${haHost}/api/integrations/ha/sensors
    scan_interval: 300
    headers:
      x-api-key: ${haKeyPrefix}
    sensor:
      - name: "VehicleVault Odometer"
        value_template: "{{ value_json.vehicles[0].odometer }}"
        unit_of_measurement: "km"
        icon: "mdi:counter"
      - name: "VehicleVault APK Days Remaining"
        value_template: "{{ value_json.vehicles[0].apk.days_remaining }}"
        unit_of_measurement: "d"
        icon: "mdi:calendar-clock"
      - name: "VehicleVault APK Status"
        value_template: "{{ value_json.vehicles[0].apk.status }}"
        icon: "mdi:shield-check"
      - name: "VehicleVault Fuel Consumption"
        value_template: "{{ value_json.vehicles[0].fuel_stats.consumption_l_per_100km }}"
        unit_of_measurement: "L/100km"
        icon: "mdi:gas-station"
      - name: "VehicleVault Last Refuel Cost"
        value_template: "{{ value_json.vehicles[0].fuel_stats.last_fuel_cost }}"
        unit_of_measurement: "EUR"
        icon: "mdi:currency-eur"
`;

  const haPushOdoConfig = `# 1. Home Assistant configuration.yaml (REST Command):
rest_command:
  update_vehiclevault_odometer:
    url: "${haHost}/api/integrations/ha/odometer"
    method: POST
    headers:
      x-api-key: "${apiKeys[0]?.prefix ? `${apiKeys[0].prefix}... (plaats hier je API Key)` : 'UW_VEHICLEVAULT_API_KEY'}"
      content-type: "application/json"
    payload: '{"license_plate": "{{ plate }}", "odometer": {{ odo | float }} }'

# 2. Voorbeeld Automatisering (automations.yaml):
alias: "Auto Thuis - Kilometerstand Sync naar VehicleVault"
trigger:
  - platform: state
    entity_id: sensor.mijn_auto_odometer
action:
  - service: rest_command.update_vehiclevault_odometer
    data:
      plate: "NL-KENTEKEN"
      odo: "{{ states('sensor.mijn_auto_odometer') }}"
`;

  return (
    <div className="space-y-6">
      {/* Outbound Home Assistant Telematics Sync (Pull Odometer from HA) */}
      <HomeAssistantTelematicsCard />

      {/* Home Assistant Integration Guide (HACS & YAML) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Radio className="w-4 h-4 text-sky-500" />
              <span>{t('haIntegrationTitle')}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('haIntegrationHint')}
            </p>
          </div>

          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400 border border-sky-200 dark:border-sky-800/60 shrink-0 self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
            <span>{t('haRestApiActive')}</span>
          </span>
        </div>

        {/* Quick REST API URL Banner */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">
              {t('haSensorsEndpoint')}
            </span>
            <span className="font-mono text-slate-800 dark:text-slate-200 truncate block mt-0.5">
              {haHost}/api/integrations/ha/sensors
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(`${haHost}/api/integrations/ha/sensors`);
              setHaCopied(true);
              setTimeout(() => setHaCopied(false), 2000);
            }}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 border border-slate-200 dark:border-slate-700 shrink-0"
          >
            {haCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{haCopied ? t('copied') : t('haCopyEndpointUrl')}</span>
          </button>
        </div>

        {/* Option 1: HACS UI Integration */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-sky-50 to-indigo-50/50 dark:from-sky-950/30 dark:to-indigo-950/20 border border-sky-200/80 dark:border-sky-800/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded-full bg-sky-500 text-white text-[10px] font-black uppercase tracking-wider">
                {t('haRecommended')}
              </span>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                {t('haHacsTitle')}
              </h3>
            </div>
            <a
              href="https://github.com/TeeCodeDev/ha-vehiclevault"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-sky-600 dark:text-sky-400 font-bold hover:underline flex items-center space-x-1"
            >
              <span>GitHub Repository</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300">
            {t('haHacsHint')}
          </p>

          <ol className="list-decimal list-inside text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pl-1">
            <li>
              {fillSlots(t('haHacsStepAddRepo'), {
                repo: <code className="px-1.5 py-0.5 bg-white dark:bg-slate-900 rounded font-mono text-[11px] border border-sky-200 dark:border-sky-800">https://github.com/TeeCodeDev/ha-vehiclevault</code>,
              })}
            </li>
            <li>
              {t('haHacsStepDownload')}
            </li>
            <li>
              {fillSlots(t('haHacsStepAddIntegration'), {
                path: <strong>{t('haHacsIntegrationPath')}</strong>,
                name: <strong>VehicleVault</strong>,
              })}
            </li>
            <li>
              {fillSlots(t('haHacsStepCredentials'), {
                url: <code className="px-1.5 py-0.5 bg-white dark:bg-slate-900 rounded font-mono text-[11px] border border-sky-200 dark:border-sky-800">{haHost}</code>,
              })}
            </li>
          </ol>
        </div>

        {/* Option 2: Manual YAML Configuration */}
        <div className="pt-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
              <span>{t('haYamlOptionTitle')}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(haYamlConfig);
                setHaCopied(true);
                setTimeout(() => setHaCopied(false), 2000);
              }}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition flex items-center space-x-1.5"
            >
              {haCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{haCopied ? t('copied') : t('haCopyYaml')}</span>
            </button>
          </div>

          <div className="relative">
            <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800 max-h-60">
              {haYamlConfig}
            </pre>
          </div>
        </div>

        {/* Option 3: Kilometerstand automatisch synchroniseren vanuit Home Assistant */}
        <div className="p-4 rounded-xl border border-sky-200/80 dark:border-sky-900/50 bg-sky-50/40 dark:bg-sky-950/20 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center space-x-2">
                <Zap className="w-4 h-4 text-sky-500" />
                <span>{t('haOdoPushTitle')}</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {t('haOdoPushHint')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(haPushOdoConfig);
                setHaOdoCopied(true);
                setTimeout(() => setHaOdoCopied(false), 2000);
              }}
              className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shrink-0 shadow-2xs"
            >
              {haOdoCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{haOdoCopied ? t('copied') : t('haCopyYaml')}</span>
            </button>
          </div>

          <div className="relative">
            <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800 max-h-60">
              {haPushOdoConfig}
            </pre>
          </div>
        </div>
      </div>

      {/* Home Assistant API Key Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <KeyRound className="w-4 h-4 text-sky-500" />
              <span>{t('haApiKeyTitle')}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('haApiKeyHint')}
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateToUsers}
            className="text-xs text-sky-600 dark:text-sky-400 font-bold hover:underline flex items-center space-x-1"
          >
            <span>{t('haManageApiKeys')}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {apiKeys.some((k) => k.name.toLowerCase().includes('home assistant') || k.name.toLowerCase().includes('ha')) ? (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <div>
                <span className="font-bold text-emerald-900 dark:text-emerald-200 block">
                  {t('haApiKeyActive', {
                    name: apiKeys.find((k) => k.name.toLowerCase().includes('home assistant') || k.name.toLowerCase().includes('ha'))?.name || '',
                  })}
                </span>
                <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                  {apiKeys.find((k) => k.name.toLowerCase().includes('home assistant') || k.name.toLowerCase().includes('ha'))?.prefix}••••••••
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <span className="text-slate-600 dark:text-slate-300">
              {t('haNoApiKey')}
            </span>
            <button
              type="button"
              onClick={onNavigateToUsers}
              className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 self-start sm:self-auto shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('haCreateKey')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};


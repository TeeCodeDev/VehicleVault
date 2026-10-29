import React, { useEffect, useState } from 'react';
import {
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Check,
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
  Lock,
  Unlock,
  ShieldCheck,
  Users,
  Bell,
  Database,
  Download,
  Upload,
  Radio,
  Sliders,
  Terminal,
  RefreshCw,
  X,
  UserPlus,
  FileSpreadsheet,
  Table,
  AlertTriangle,
  Palette,
  Fuel,
  Route,
  Wrench,
  Disc,
  Landmark,
  FolderLock,
  LineChart,
  Layers,
} from 'lucide-react';
import { ApiKeyItem, Vehicle } from '../types/index.js';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api/client.js';
import { useTheme, ACCENT_COLOR_OPTIONS } from '../context/ThemeContext.js';
import { useLanguage } from '../context/LanguageContext.js';
import { useAuth } from '../context/AuthContext.js';
import { useModules } from '../context/ModuleContext.js';
import { formatDisplayDate } from '../utils/format.js';

export const Settings: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const outlet = useOutletContext<{ vehicles?: Vehicle[]; selectedVehicle?: Vehicle | null }>();
  const vehicles = outlet?.vehicles || [];
  const selectedVehicle = outlet?.selectedVehicle || null;

  const validTabs = ['general', 'ai', 'users', 'notifications', 'backup', 'import'] as const;
  type TabType = typeof validTabs[number];
  const urlTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<TabType>(
    urlTab && (validTabs as readonly string[]).includes(urlTab) ? (urlTab as TabType) : 'general'
  );

  useEffect(() => {
    const tParam = searchParams.get('tab');
    if (tParam && (validTabs as readonly string[]).includes(tParam)) {
      setActiveTab(tParam as TabType);
    }
  }, [searchParams]);

  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [health, setHealth] = useState<any | null>(null);
  const [diagnosticsRefreshing, setDiagnosticsRefreshing] = useState(false);
  const { theme, setTheme, accentColor, setAccentColor } = useTheme();
  const { modules, toggleModule } = useModules();
  const { lang, setLang, t } = useLanguage();
  const { refreshAuthStatus } = useAuth();

  const handleRefreshDiagnostics = async () => {
    setDiagnosticsRefreshing(true);
    try {
      await Promise.all([loadHealth(), loadStorageStats()]);
    } finally {
      setTimeout(() => setDiagnosticsRefreshing(false), 500);
    }
  };

  // AI Vision Receipt Scanner State
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai' | 'none'>('gemini');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-3.8-flash');
  const [discoveredGeminiModels, setDiscoveredGeminiModels] = useState<string[]>([]);
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

  // Security & Authentication Mode State (Pangolin / No-Auth)
  const [disableAuth, setDisableAuth] = useState(false);
  const [isEnvEnforced, setIsEnvEnforced] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);

  // Users Management State
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'driver' | 'user'>('driver');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  // Notifications State
  const [notifProvider, setNotifProvider] = useState<'none' | 'ntfy' | 'gotify' | 'webhook'>('none');
  const [ntfyUrl, setNtfyUrl] = useState('');
  const [ntfyToken, setNtfyToken] = useState('');
  const [gotifyUrl, setGotifyUrl] = useState('');
  const [gotifyToken, setGotifyToken] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [notifApk, setNotifApk] = useState(true);
  const [notifMaintenance, setNotifMaintenance] = useState(true);
  const [notifTesting, setNotifTesting] = useState(false);
  const [notifTestResult, setNotifTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaveSuccess, setNotifSaveSuccess] = useState(false);

  // Home Assistant State
  const [haCopied, setHaCopied] = useState(false);

  // Backup & Storage State
  const [storageStats, setStorageStats] = useState<{
    databaseSizeFormatted: string;
    totalUploadsFormatted: string;
    dataDir: string;
  } | null>(null);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // CSV Import State
  const [importVehicleId, setImportVehicleId] = useState<string>('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [forcedFormat, setForcedFormat] = useState<'auto' | 'fuelio' | 'lubelogger' | 'generic'>('auto');
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importExecuting, setImportExecuting] = useState(false);
  const [importResultMessage, setImportResultMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Custom column mapping state if generic
  const [showMapping, setShowMapping] = useState(false);
  const [recordType, setRecordType] = useState<'fuel' | 'service'>('fuel');
  const [dateCol, setDateCol] = useState('');
  const [odoCol, setOdoCol] = useState('');
  const [costCol, setCostCol] = useState('');
  const [litersCol, setLitersCol] = useState('');
  const [notesCol, setNotesCol] = useState('');

  const targetVehicleId = importVehicleId || selectedVehicle?.id || vehicles[0]?.id || '';

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCsvFile(e.target.files[0]);
      setImportPreview(null);
      setImportResultMessage(null);
      setImportError(null);
    }
  };

  const handleImportPreview = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!csvFile || !targetVehicleId) return;

    setImportLoading(true);
    setImportError(null);
    setImportResultMessage(null);

    const formData = new FormData();
    formData.append('file', csvFile);
    formData.append('vehicleId', targetVehicleId);
    if (forcedFormat !== 'auto') {
      formData.append('forcedFormat', forcedFormat);
    }

    if (showMapping) {
      formData.append(
        'mapping',
        JSON.stringify({
          type: recordType,
          dateColumn: dateCol,
          odometerColumn: odoCol,
          costColumn: costCol,
          litersColumn: litersCol || undefined,
          notesColumn: notesCol || undefined,
        })
      );
    }

    try {
      const data = await apiFetch<any>('/api/import/preview', {
        method: 'POST',
        body: formData,
      });
      setImportPreview(data);

      if (data.detectedFormat === 'generic' && data.headers?.length > 0 && !showMapping) {
        setShowMapping(true);
        setDateCol(data.headers[0] || '');
        setOdoCol(data.headers[1] || '');
        setCostCol(data.headers[2] || '');
      }
    } catch (err: any) {
      setImportError(err?.message || 'Fout bij inspecteren van CSV-bestand');
    } finally {
      setImportLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!importPreview || !targetVehicleId) return;

    setImportExecuting(true);
    setImportError(null);
    try {
      const res = await apiFetch<any>('/api/import/execute', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId: targetVehicleId,
          records: importPreview.records,
        }),
      });

      setImportResultMessage(res.message);
      setImportPreview(null);
      setCsvFile(null);
    } catch (err: any) {
      setImportError(err?.message || 'Import mislukt');
    } finally {
      setImportExecuting(false);
    }
  };

  useEffect(() => {
    loadHealth();
    loadApiKeys();
    loadAiSettings();
    loadSecuritySettings();
    loadUsers();
    loadNotificationSettings();
    loadStorageStats();
  }, []);

  const loadHealth = async () => {
    try {
      const res = await fetch('/healthz');
      if (res.ok) setHealth(await res.json());
    } catch {}
  };

  const loadApiKeys = async () => {
    try {
      const res = await apiFetch<{ apiKeys: ApiKeyItem[] }>('/api/auth/api-keys');
      setApiKeys(res.apiKeys);
    } catch {}
  };

  const loadSecuritySettings = async () => {
    try {
      const res = await apiFetch<{ disableAuth: boolean; isEnvEnforced: boolean }>('/api/settings/security');
      setDisableAuth(res.disableAuth);
      setIsEnvEnforced(res.isEnvEnforced);
    } catch {}
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await apiFetch<{ users: any[] }>('/api/auth/users');
      setUsersList(res.users);
    } catch {
      // Non-admins will receive 403, ignore
    } finally {
      setUsersLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await apiFetch(`/api/auth/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      await loadUsers();
    } catch (err: any) {
      alert(err?.message || 'Fout bij bijwerken van rol');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail) return;
    setCreatingUser(true);
    try {
      await apiFetch('/api/auth/users', {
        method: 'POST',
        body: JSON.stringify({
          email: newUserEmail,
          role: newUserRole,
          password: newUserPassword || undefined,
        }),
      });
      setIsCreateUserModalOpen(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('driver');
      await loadUsers();
    } catch (err: any) {
      alert(err?.message || 'Fout bij toevoegen van gebruiker');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Weet je zeker dat je gebruiker "${userEmail}" wilt verwijderen?`)) return;
    try {
      await apiFetch(`/api/auth/users/${userId}`, { method: 'DELETE' });
      await loadUsers();
    } catch (err: any) {
      alert(err?.message || 'Fout bij verwijderen van gebruiker');
    }
  };

  const handleToggleDisableAuth = async (newVal: boolean) => {
    setSecurityLoading(true);
    setSecurityMessage(null);
    try {
      const res = await apiFetch<{ success: boolean; disableAuth: boolean; message: string }>('/api/settings/security', {
        method: 'PUT',
        body: JSON.stringify({ disableAuth: newVal }),
      });
      setDisableAuth(res.disableAuth);
      setSecurityMessage(res.message);
      await refreshAuthStatus();
    } catch (err: any) {
      setSecurityMessage(err?.message || 'Fout bij wijzigen van inloginstellingen');
    } finally {
      setSecurityLoading(false);
    }
  };

  const loadAiSettings = async () => {
    try {
      const res = await apiFetch<{
        provider: 'gemini' | 'openai' | 'none';
        geminiModel: string;
        hasGeminiKey: boolean;
        geminiKeyMasked: string | null;
        availableGeminiModels?: string[];
        openaiModel: string;
        openaiBaseUrl: string;
        hasOpenaiKey: boolean;
        openaiKeyMasked: string | null;
      }>('/api/settings/ai');

      setAiProvider(res.provider || 'gemini');
      setGeminiModel(res.geminiModel || 'gemini-3.8-flash');
      setHasGeminiKey(res.hasGeminiKey);
      setGeminiKeyMasked(res.geminiKeyMasked);
      if (res.availableGeminiModels && res.availableGeminiModels.length > 0) {
        setDiscoveredGeminiModels(res.availableGeminiModels);
      }
      setOpenaiModel(res.openaiModel || 'gpt-4o-mini');
      setOpenaiBaseUrl(res.openaiBaseUrl || 'https://api.openai.com/v1');
      setHasOpenaiKey(res.hasOpenaiKey);
      setOpenaiKeyMasked(res.openaiKeyMasked);
    } catch {}
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
      if (aiProvider === 'openai') payload.baseUrl = openaiBaseUrl;

      const res = await apiFetch<{ success: boolean; message: string; models?: string[] }>('/api/settings/ai/test', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAiTestResult(res);
      if (res.models && res.models.length > 0) {
        setDiscoveredGeminiModels(res.models);
        if (!res.models.includes(geminiModel)) {
          const best = res.models.find((m) => m.includes('3.8-flash')) || res.models.find((m) => m.includes('flash')) || res.models[0];
          if (best) setGeminiModel(best);
        }
      }
    } catch (err: any) {
      setAiTestResult({ success: false, message: err?.message || 'Verbindingstest mislukt' });
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

  const handleClearKey = async (type: 'gemini' | 'openai') => {
    const confirmMsg = lang === 'nl'
      ? `Weet je zeker dat je de opgeslagen ${type === 'gemini' ? 'Google Gemini' : 'OpenAI'} API-sleutel wilt wissen?`
      : `Are you sure you want to remove the stored ${type === 'gemini' ? 'Google Gemini' : 'OpenAI'} API key?`;
    if (!confirm(confirmMsg)) return;

    try {
      await apiFetch('/api/settings/ai', {
        method: 'PUT',
        body: JSON.stringify({
          clearGeminiKey: type === 'gemini',
          clearOpenaiKey: type === 'openai',
        }),
      });
      await loadAiSettings();
      setAiTestResult(null);
    } catch (err: any) {
      alert(err?.message || 'Fout bij wissen van API-sleutel');
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
      alert(err?.message || 'Error generating API key');
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;
    try {
      await apiFetch(`/api/auth/api-keys/${id}`, { method: 'DELETE' });
      loadApiKeys();
    } catch (err: any) {
      alert(err?.message || 'Error deleting key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Notification Methods
  const loadNotificationSettings = async () => {
    try {
      const res = await apiFetch<any>('/api/notifications/settings');
      setNotifProvider(res.provider || 'none');
      setNtfyUrl(res.ntfyUrl || '');
      setNtfyToken(res.ntfyToken || '');
      setGotifyUrl(res.gotifyUrl || '');
      setGotifyToken(res.gotifyToken || '');
      setWebhookUrl(res.webhookUrl || '');
      setNotifApk(res.enabledApk ?? true);
      setNotifMaintenance(res.enabledMaintenance ?? true);
    } catch {}
  };

  const handleSaveNotifications = async () => {
    setNotifSaving(true);
    setNotifSaveSuccess(false);
    try {
      await apiFetch('/api/notifications/settings', {
        method: 'PUT',
        body: JSON.stringify({
          provider: notifProvider,
          ntfyUrl,
          ntfyToken,
          gotifyUrl,
          gotifyToken,
          webhookUrl,
          enabledApk: notifApk,
          enabledMaintenance: notifMaintenance,
        }),
      });
      setNotifSaveSuccess(true);
      setTimeout(() => setNotifSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err?.message || 'Fout bij opslaan van notificatie-instellingen');
    } finally {
      setNotifSaving(false);
    }
  };

  const handleTestNotification = async () => {
    setNotifTesting(true);
    setNotifTestResult(null);
    try {
      const res = await apiFetch<{ success: boolean; message: string }>('/api/notifications/test', {
        method: 'POST',
      });
      setNotifTestResult(res);
    } catch (err: any) {
      setNotifTestResult({ success: false, message: err?.message || 'Fout bij verzenden van testmelding' });
    } finally {
      setNotifTesting(false);
    }
  };

  // Backup & Storage Methods
  const loadStorageStats = async () => {
    try {
      const res = await apiFetch<any>('/api/backup/stats');
      setStorageStats(res);
    } catch {}
  };

  const handleDownloadBackup = async () => {
    try {
      const token = localStorage.getItem('vv_token');
      const res = await fetch('/api/backup/export', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Backup download mislukt');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vehiclevault-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err?.message || 'Fout bij downloaden van backup');
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    if (!confirm(`Weet je zeker dat je de backup "${file.name}" wilt terugzetten? De huidige database wordt bijgewerkt.`)) {
      e.target.value = '';
      return;
    }

    setRestoringBackup(true);
    setRestoreMessage(null);
    setRestoreError(null);

    const formData = new FormData();
    formData.append('backup', file);

    try {
      const token = localStorage.getItem('vv_token');
      const res = await fetch('/api/backup/import', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Herstellen van backup mislukt');

      setRestoreMessage(data.message || 'Backup succesvol hersteld!');
      loadStorageStats();
      loadHealth();
    } catch (err: any) {
      setRestoreError(err?.message || 'Fout bij herstellen van backup');
    } finally {
      setRestoringBackup(false);
      e.target.value = '';
    }
  };

  // Home Assistant REST Sensor YAML configuration template
  const haHost = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3084';
  const haYamlConfig = `# Home Assistant configuration.yaml
# Integratie met VehicleVault via REST Sensors
rest:
  - resource: ${haHost}/api/integrations/ha/sensors
    scan_interval: 300
    headers:
      x-api-key: ${apiKeys[0]?.prefix ? `${apiKeys[0].prefix}... (plaats hier je volledige API Key)` : 'UW_VEHICLEVAULT_API_KEY'}
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center space-x-2">
          <Sliders className="w-5 h-5 text-sky-500" />
          <span>{t('settingsTitle')}</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {lang === 'nl'
            ? 'Beheer systeemconfiguratie, AI bonherkenning, gebruikersrollen, notificaties en backups.'
            : 'Manage system settings, AI receipt scanning, user roles, notifications, and backups.'}
        </p>
      </div>

      {/* Modern 6-Tab Navigation Bar */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800 scrollbar-none">
        <button
          onClick={() => handleTabClick('general')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition shrink-0 ${
            activeTab === 'general'
              ? 'bg-accent-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Algemeen</span>
        </button>

        <button
          onClick={() => handleTabClick('ai')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition shrink-0 ${
            activeTab === 'ai'
              ? 'bg-accent-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>AI Bonherkenning</span>
        </button>

        <button
          onClick={() => handleTabClick('users')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition shrink-0 ${
            activeTab === 'users'
              ? 'bg-accent-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Gebruikers &amp; Toegang</span>
        </button>

        <button
          onClick={() => handleTabClick('notifications')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition shrink-0 ${
            activeTab === 'notifications'
              ? 'bg-accent-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Notificaties &amp; Home Assistant</span>
        </button>

        <button
          onClick={() => handleTabClick('backup')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition shrink-0 ${
            activeTab === 'backup'
              ? 'bg-accent-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Database &amp; Backups</span>
        </button>

        <button
          onClick={() => handleTabClick('import')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition shrink-0 ${
            activeTab === 'import'
              ? 'bg-accent-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Gegevens Importeren</span>
        </button>
      </div>

      {/* TAB 1: ALGEMEEN */}
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Weergave & Taal */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Sun className="w-4 h-4 text-amber-500" />
                <span>{lang === 'nl' ? 'Weergave & Taal' : 'Appearance & Language'}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'nl'
                  ? 'Pas de interface van VehicleVault aan naar jouw persoonlijke voorkeur.'
                  : 'Customize the appearance and interface language to your preference.'}
              </p>
            </div>

            <div className="space-y-4 pt-1">
              {/* Theme Selector */}
              <div className="space-y-2.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/80">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>{lang === 'nl' ? 'Kleurthema' : 'Color Theme'}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {lang === 'nl' ? 'Kies voor een lichte, donkere of automatische weergave.' : 'Choose between light, dark, or automatic system appearance.'}
                </p>

                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-xl shadow-inner mt-2">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                      theme === 'light'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span>{t('themeLight')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                      theme === 'dark'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{t('themeDark')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('system')}
                    className={`inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                      theme === 'system'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Laptop className="w-3.5 h-3.5 text-sky-400" />
                    <span>{t('themeSystem')}</span>
                  </button>
                </div>
              </div>

              {/* Language Selector */}
              <div className="space-y-2.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/80">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                  <Globe className="w-3.5 h-3.5 text-sky-500" />
                  <span>{lang === 'nl' ? 'Interfacetaal' : 'Interface Language'}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {lang === 'nl' ? 'Stel de taal in voor alle menu’s, overzichten en labels.' : 'Set the interface language for all menus, overviews, and labels.'}
                </p>

                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-xl shadow-inner mt-2">
                  <button
                    type="button"
                    onClick={() => setLang('nl')}
                    className={`inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                      lang === 'nl'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>🇳🇱 Nederlands</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLang('en')}
                    className={`inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                      lang === 'en'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>🇬🇧 English</span>
                  </button>
                </div>
              </div>

              {/* Accent Color Selector */}
              <div className="space-y-2.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/80">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                  <Palette className="w-3.5 h-3.5 text-accent-500" />
                  <span>{lang === 'nl' ? 'Accentkleur' : 'Accent Color'}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {lang === 'nl'
                    ? 'Kies jouw favoriete accentkleur voor knoppen, navigatie en actieve selecties.'
                    : 'Choose your favorite accent color for buttons, navigation, and active highlights.'}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {ACCENT_COLOR_OPTIONS.map((opt) => {
                    const isSelected = accentColor === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAccentColor(opt.id)}
                        className={`flex items-center space-x-2.5 p-2 rounded-xl border text-left transition ${
                          isSelected
                            ? 'bg-white dark:bg-slate-900 border-accent-500 shadow-sm ring-2 ring-accent-500/30'
                            : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full shrink-0 shadow-sm flex items-center justify-center ring-1 ring-black/10"
                          style={{ backgroundColor: opt.dotColor }}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                        </span>
                        <div className="min-w-0">
                          <div className={`text-xs font-bold truncate ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                            {lang === 'nl' ? opt.name.split(' ')[0] : opt.enName.split(' ')[0]}
                          </div>
                          <div className="text-[9px] text-slate-400 truncate">
                            {lang === 'nl' ? opt.name : opt.enName}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Actieve Modules & Functies */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Layers className="w-4 h-4 text-accent-500" />
                <span>{lang === 'nl' ? 'Actieve Modules & Functies' : 'Active Feature Modules'}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'nl'
                  ? 'Schakel onderdelen die je niet gebruikt (zoals rittenregistratie of vaste lasten) eenvoudig uit voor een rustigere interface.'
                  : 'Disable modules you do not use to keep your navigation and sidebar clean and focused.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {[
                {
                  key: 'fuel' as const,
                  icon: Fuel,
                  title: lang === 'nl' ? 'Tanken & Laden' : 'Fuel & EV Charging',
                  desc: lang === 'nl' ? 'Brandstof- en laadbeurten loggen, verbruiksberekening en bonscanner.' : 'Log fill-ups and charging, consumption, and receipt scanner.',
                },
                {
                  key: 'trips' as const,
                  icon: Route,
                  title: lang === 'nl' ? 'Ritregistratie' : 'Trip Logging',
                  desc: lang === 'nl' ? 'Kilometeradministratie voor zakelijke en privé ritten met Belastingdienst export.' : 'Mileage logs for business & private trips with tax exports.',
                },
                {
                  key: 'maintenance' as const,
                  icon: Wrench,
                  title: lang === 'nl' ? 'Onderhoud & APK' : 'Maintenance & Service',
                  desc: lang === 'nl' ? 'Dual-trigger intervallen, facturen, DIY-besparingsmeter en digitaal onderhoudsboekje.' : 'Dual-trigger service intervals, invoices, DIY savings, and PDF booklet.',
                },
                {
                  key: 'tires' as const,
                  icon: Disc,
                  title: lang === 'nl' ? 'Bandenbeheer' : 'Tire Management',
                  desc: lang === 'nl' ? 'Zomer-, winter- en 4-seizoenssets, wissels, DOT-codes en profieldiepte.' : 'Summer, winter, and all-season sets, seasonal swaps, and tread depth.',
                },
                {
                  key: 'fixedExpenses' as const,
                  icon: Landmark,
                  title: lang === 'nl' ? 'Vaste Lasten' : 'Fixed Expenses',
                  desc: lang === 'nl' ? 'Wegenbelasting (MRB), autoverzekering, pechhulp en leasecontracten.' : 'Road tax, auto insurance, roadside assistance, and subscriptions.',
                },
                {
                  key: 'documents' as const,
                  icon: FolderLock,
                  title: lang === 'nl' ? 'Documentenkluis' : 'Document Vault',
                  desc: lang === 'nl' ? 'Kentekenbewijzen, groene kaarten, keuringsrapporten en handleidingen.' : 'Vehicle registrations, green cards, inspection forms, and manuals.',
                },
                {
                  key: 'analytics' as const,
                  icon: LineChart,
                  title: lang === 'nl' ? 'Rapporten & TCO' : 'Reports & TCO',
                  desc: lang === 'nl' ? 'Total Cost of Ownership, kilometerkostprijs, verbruiksgrafieken en analyses.' : 'Total Cost of Ownership, cost per km, consumption trends, and station stats.',
                },
              ].map((m) => {
                const Icon = m.icon;
                const isEnabled = modules[m.key] !== false;
                return (
                  <div
                    key={m.key}
                    onClick={() => toggleModule(m.key)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 shadow-2xs select-none ${
                      isEnabled
                        ? 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 hover:border-accent-400 dark:hover:border-accent-600'
                        : 'bg-slate-100/40 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 opacity-60 hover:opacity-90'
                    }`}
                  >
                    <div className="flex items-start space-x-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          isEnabled
                            ? 'bg-accent-50 dark:bg-accent-950/60 text-accent-600 dark:text-accent-400 border border-accent-200/60 dark:border-accent-700/40'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-400 border border-slate-300/60 dark:border-slate-700/60'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                          <span>{m.title}</span>
                          {!isEnabled && (
                            <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-500">
                              {lang === 'nl' ? 'Uitgeschakeld' : 'Disabled'}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug line-clamp-2">
                          {m.desc}
                        </p>
                      </div>
                    </div>

                    {/* iOS style toggle switch */}
                    <div
                      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 p-0.5 ${
                        isEnabled ? 'bg-accent-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                          isEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Systeeminformatie & Status */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  <span>{lang === 'nl' ? 'Systeeminformatie & Status' : 'System Diagnostics'}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {lang === 'nl' ? 'Actuele status van database, dataopslag en container.' : 'Live status of database, data storage, and container.'}
                </p>
              </div>

              <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Operationeel</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/70 dark:border-slate-800/80">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">{lang === 'nl' ? 'App Versie' : 'App Version'}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                  {health?.version || 'v1.0.20'}
                </span>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/70 dark:border-slate-800/80">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">{lang === 'nl' ? 'Database Status' : 'Database Status'}</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                  {health?.database || 'Connected'} (WAL)
                </span>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/70 dark:border-slate-800/80">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">{lang === 'nl' ? 'Uptime' : 'Uptime'}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                  {health?.uptime ? `${Math.floor(health.uptime / 60)} min` : 'Actief'}
                </span>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/70 dark:border-slate-800/80">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Opslagpad (/data)</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-1 block truncate" title={storageStats?.dataDir || '/data'}>
                  {storageStats?.dataDir || '/data'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 text-xs flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">Systeemdiagnostiek</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  Vernieuw live status van database, cache en achtergrondtaken.
                </span>
              </div>
              <button
                type="button"
                onClick={handleRefreshDiagnostics}
                disabled={diagnosticsRefreshing}
                className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 border border-slate-200 dark:border-slate-700 shadow-sm transition shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-sky-500 ${diagnosticsRefreshing ? 'animate-spin' : ''}`} />
                <span>{diagnosticsRefreshing ? 'Verversen...' : 'Vernieuwen'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AI BONHERKENNING */}
      {activeTab === 'ai' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>{lang === 'nl' ? 'AI Bonherkenning Configuratie' : 'AI Receipt Scanning Configuration'}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'nl' ? 'Stel Google Gemini of OpenAI in om tankbonnen automatisch uit te lezen.' : 'Configure Google Gemini or OpenAI to automatically extract data from receipt photos.'}
              </p>
            </div>
            {hasGeminiKey && aiProvider === 'gemini' && (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/50 flex items-center space-x-1.5 self-start sm:self-center">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Google Gemini Actief</span>
              </span>
            )}
            {hasOpenaiKey && aiProvider === 'openai' && (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/50 flex items-center space-x-1.5 self-start sm:self-center">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>OpenAI Actief</span>
              </span>
            )}
          </div>

          {/* Provider Selection Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setAiProvider('gemini')}
              className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                aiProvider === 'gemini'
                  ? 'border-sky-500 bg-sky-50/60 dark:bg-sky-950/40 text-slate-900 dark:text-white ring-1 ring-sky-500'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs">Google Gemini</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                  {lang === 'nl' ? 'Aanbevolen (Gratis)' : 'Recommended (Free)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {lang === 'nl'
                  ? 'Beste herkenning van Nederlandse tankbonnen (Fieten Olie, Shell, etc.). Gratis API sleutel beschikbaar.'
                  : 'Superior OCR and extraction for receipts. Free API key available in Google AI Studio.'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setAiProvider('openai')}
              className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                aiProvider === 'openai'
                  ? 'border-sky-500 bg-sky-50/60 dark:bg-sky-950/40 text-slate-900 dark:text-white ring-1 ring-sky-500'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs">OpenAI / Compatible</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold">
                  GPT-4o
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {lang === 'nl'
                  ? 'Ondersteunt officiële OpenAI API of lokale self-hosted proxies (bijv. LocalAI / Ollama met visie).'
                  : 'Official OpenAI API or compatible self-hosted vision endpoints.'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setAiProvider('none')}
              className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                aiProvider === 'none'
                  ? 'border-sky-500 bg-sky-50/60 dark:bg-sky-950/40 text-slate-900 dark:text-white ring-1 ring-sky-500'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs">Alleen Tesseract (Offline)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold">
                  Geen AI
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {lang === 'nl'
                  ? 'Klassieke lokale regex parser zonder externe API calls. Sneller, maar minder tolerant voor wazige foto\'s.'
                  : 'Pure on-device Tesseract OCR regex parsing with zero cloud or API requirements.'}
              </p>
            </button>
          </div>

          {/* Gemini Form */}
          {aiProvider === 'gemini' && (
            <div className="space-y-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Google Gemini API Sleutel
                  </label>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center space-x-1 text-[11px]"
                  >
                    <span>{lang === 'nl' ? 'Gratis sleutel aanmaken in Google AI Studio' : 'Get free key at Google AI Studio'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="relative">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder={hasGeminiKey ? (geminiKeyMasked || '•••••••••••••••• (Opgeslagen)') : 'AIzaSy...'}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 pr-20 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-sky-500"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => setShowGeminiKey(!showGeminiKey)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
                      title={showGeminiKey ? 'Verbergen' : 'Tonen'}
                    >
                      {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    {hasGeminiKey && (
                      <button
                        type="button"
                        onClick={() => handleClearKey('gemini')}
                        className="p-1 text-rose-500 hover:text-rose-700 rounded"
                        title="API Sleutel Wissen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Model Selection */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Gemini Model
                </label>
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="gemini-3.8-flash">gemini-3.8-flash (Aanbevolen, ultra snel &amp; modern)</option>
                  <option value="gemini-2.5-flash">gemini-2.5-flash (Uiterst stabiel)</option>
                  <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite (Lichtgewicht &amp; zuinig)</option>
                  <option value="gemini-3.1-flash-lite-preview">gemini-3.1-flash-lite-preview</option>
                  {discoveredGeminiModels
                    .filter((m) => !['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.1-flash-lite-preview'].includes(m))
                    .map((m) => (
                      <option key={m} value={m}>
                        {m} (Gevonden via API)
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}

          {/* OpenAI Form */}
          {aiProvider === 'openai' && (
            <div className="space-y-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                  OpenAI API Sleutel
                </label>
                <div className="relative">
                  <input
                    type={showOpenaiKey ? 'text' : 'password'}
                    value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value)}
                    placeholder={hasOpenaiKey ? (openaiKeyMasked || '•••••••••••••••• (Opgeslagen)') : 'sk-...'}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 pr-20 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-sky-500"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
                    >
                      {showOpenaiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    {hasOpenaiKey && (
                      <button
                        type="button"
                        onClick={() => handleClearKey('openai')}
                        className="p-1 text-rose-500 hover:text-rose-700 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                    Base URL (optioneel voor proxies / Ollama)
                  </label>
                  <input
                    type="text"
                    value={openaiBaseUrl}
                    onChange={(e) => setOpenaiBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                    Model Naam
                  </label>
                  <input
                    type="text"
                    value={openaiModel}
                    onChange={(e) => setOpenaiModel(e.target.value)}
                    placeholder="gpt-4o-mini"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Test Result Message */}
          {aiTestResult && (
            <div
              className={`p-3.5 rounded-xl border flex items-start space-x-2.5 text-xs font-medium ${
                aiTestResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
              }`}
            >
              {aiTestResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              )}
              <div className="space-y-1 flex-1">
                <span className="font-bold block">
                  {aiTestResult.success ? 'Verbinding Geslaagd!' : 'Verbinding Mislukt'}
                </span>
                <span className="block leading-relaxed">{aiTestResult.message}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            {aiProvider !== 'none' ? (
              <button
                type="button"
                onClick={handleTestAiConnection}
                disabled={aiTesting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold inline-flex items-center space-x-2 transition disabled:opacity-50"
              >
                {aiTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5 text-sky-500" />}
                <span>{aiTesting ? 'Bezig met testen...' : 'Test Verbinding'}</span>
              </button>
            ) : <div />}

            <div className="flex items-center space-x-2">
              {aiSavedSuccess && (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Instellingen opgeslagen</span>
                </span>
              )}
              <button
                type="button"
                onClick={handleSaveAiSettings}
                disabled={aiSaving}
                className="px-5 py-2 bg-slate-900 text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-sm"
              >
                {aiSaving ? 'Opslaan...' : 'Wijzigingen Opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GEBRUIKERS & TOEGANG */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Reverse Proxy / No-Auth Toggle */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-sky-500" />
                  <span>Pangolin / Beveiligingsmodus</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configureer of inloggen vereist is of dat VehicleVault achter een reverse proxy (Pangolin / Authelia) draait.
                </p>
              </div>

              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border flex items-center space-x-1.5 self-start sm:self-center ${
                disableAuth
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800/60'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60'
              }`}>
                {disableAuth ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                <span>{disableAuth ? 'Geen Inlog Vereist (No-Auth)' : 'Beveiligd (Inloggen Vereist)'}</span>
              </span>
            </div>

            {securityMessage && (
              <div className="p-3 bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800/80 text-sky-800 dark:text-sky-300 rounded-xl text-xs font-medium">
                {securityMessage}
              </div>
            )}

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
              <div className="space-y-0.5 pr-4">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Inloggen Uitschakelen (voor beveiligd thuisnetwerk / LAN)
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Wanneer ingeschakeld, kan iedereen op het netwerk zonder wachtwoord direct de applicatie gebruiken.
                </span>
              </div>

              <button
                type="button"
                disabled={securityLoading || isEnvEnforced}
                onClick={() => handleToggleDisableAuth(!disableAuth)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  disableAuth ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                } ${isEnvEnforced ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    disableAuth ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Users List & Roles Management */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Users className="w-4 h-4 text-emerald-500" />
                  <span>Gebruikersbeheer &amp; Chauffeur-Rollen</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Wijs rollen toe aan gebruikers. Chauffeurs krijgen een vereenvoudigde interface om snel te tanken.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateUserModalOpen(true)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Gebruiker Toevoegen</span>
                </button>
                <button
                  type="button"
                  onClick={loadUsers}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition"
                  title="Vernieuwen"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {usersLoading ? (
              <div className="py-6 text-center text-xs text-slate-400">Gebruikers laden...</div>
            ) : usersList.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Geen gebruikerslijst beschikbaar (alleen zichtbaar voor beheerders).
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase">
                    <tr>
                      <th className="py-2.5 px-3">E-mailadres / Pangolin Gebruiker</th>
                      <th className="py-2.5 px-3">Rol &amp; Toegang</th>
                      <th className="py-2.5 px-3">Geregistreerd</th>
                      <th className="py-2.5 px-3 text-right">Actie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-900 dark:text-white block">{u.email}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{u.id}</span>
                        </td>
                        <td className="py-3 px-3">
                          <select
                            value={u.role}
                            onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                            className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                          >
                            <option value="admin">👑 Beheerder (Admin)</option>
                            <option value="driver">🚗 Chauffeur (Snel Tanken)</option>
                            <option value="user">👤 Standaard Gebruiker</option>
                          </select>
                        </td>
                        <td className="py-3 px-3 text-slate-500 dark:text-slate-400">
                          {formatDisplayDate(u.created_at)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u.id, u.email)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Gebruiker Verwijderen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* API Keys Management */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <KeyRound className="w-4 h-4 text-sky-500" />
              <span>Persoonlijke API-Sleutels (Home Assistant / Scripts)</span>
            </h2>

            {generatedKey && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block">
                  Kopieer je nieuwe API-sleutel nu!
                </span>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedKey}
                    className="flex-1 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(generatedKey)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Gekopieerd' : 'Kopiëren'}</span>
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateKey} className="flex gap-2">
              <input
                type="text"
                required
                placeholder="Naam sleutel (bijv. Home Assistant, Backup Script)"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Aanmaken</span>
              </button>
            </form>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 pt-2">
              {apiKeys.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">Nog geen API-sleutels aangemaakt.</p>
              ) : (
                apiKeys.map((k) => (
                  <div key={k.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">{k.name}</span>
                      <span className="font-mono text-slate-400 text-[11px]">{k.prefix}••••••••</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteKey(k.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: NOTIFICATIES & INTEGRATIES */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          {/* Notifications Provider Configuration */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Bell className="w-4 h-4 text-purple-500" />
                <span>Notificatiesysteem (APK &amp; Onderhoud Meldingen)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Ontvang automatische herinneringen op je telefoon wanneer een APK bijna verloopt (&lt; 30d, &lt; 7d) of een onderhoudsbeurt nodig is.
              </p>
            </div>

            {/* Provider Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'none', label: 'Uitgeschakeld' },
                { id: 'ntfy', label: 'Ntfy.sh / Self-Hosted' },
                { id: 'gotify', label: 'Gotify' },
                { id: 'webhook', label: 'Aangepaste Webhook' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setNotifProvider(p.id as any)}
                  className={`p-3 rounded-xl border text-xs font-bold transition text-center ${
                    notifProvider === p.id
                      ? 'border-purple-500 bg-purple-50/60 dark:bg-purple-950/40 text-slate-900 dark:text-white ring-1 ring-purple-500'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Provider Specific Inputs */}
            {notifProvider === 'ntfy' && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Ntfy Topic of Volledige URL *
                  </label>
                  <input
                    type="text"
                    value={ntfyUrl}
                    onChange={(e) => setNtfyUrl(e.target.value)}
                    placeholder="https://ntfy.sh/mijn-geheime-auto-notificaties"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Authenticatie Token (Optioneel voor privé ntfy servers)
                  </label>
                  <input
                    type="password"
                    value={ntfyToken}
                    onChange={(e) => setNtfyToken(e.target.value)}
                    placeholder="tk_..."
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>
            )}

            {notifProvider === 'gotify' && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Gotify Server URL *
                  </label>
                  <input
                    type="text"
                    value={gotifyUrl}
                    onChange={(e) => setGotifyUrl(e.target.value)}
                    placeholder="https://gotify.mijnnetwerk.nl"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Gotify App Token *
                  </label>
                  <input
                    type="password"
                    value={gotifyToken}
                    onChange={(e) => setGotifyToken(e.target.value)}
                    placeholder="A..."
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>
            )}

            {notifProvider === 'webhook' && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800/80 space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Webhook URL (POST) *
                  </label>
                  <input
                    type="text"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://webhook.site/..."
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>
            )}

            {/* Notification Triggers */}
            {notifProvider !== 'none' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2">
                <label className="flex items-center space-x-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifApk}
                    onChange={(e) => setNotifApk(e.target.checked)}
                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    APK Herinneringen (30d en 7d voor verloop)
                  </span>
                </label>

                <label className="flex items-center space-x-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifMaintenance}
                    onChange={(e) => setNotifMaintenance(e.target.checked)}
                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Onderhoud Overschreden Herinneringen
                  </span>
                </label>
              </div>
            )}

            {/* Test Result Message */}
            {notifTestResult && (
              <div
                className={`p-3.5 rounded-xl border flex items-start space-x-2.5 text-xs font-medium ${
                  notifTestResult.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                }`}
              >
                {notifTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                )}
                <span>{notifTestResult.message}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              {notifProvider !== 'none' ? (
                <button
                  type="button"
                  onClick={handleTestNotification}
                  disabled={notifTesting}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold inline-flex items-center space-x-2 transition disabled:opacity-50"
                >
                  {notifTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5 text-purple-500" />}
                  <span>{notifTesting ? 'Verzenden...' : 'Test Notificatie Verzenden'}</span>
                </button>
              ) : <div />}

              <div className="flex items-center space-x-2">
                {notifSaveSuccess && (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Opgeslagen</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleSaveNotifications}
                  disabled={notifSaving}
                  className="px-5 py-2 bg-slate-900 text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-sm"
                >
                  {notifSaving ? 'Opslaan...' : 'Notificaties Opslaan'}
                </button>
              </div>
            </div>
          </div>

          {/* Home Assistant Integration Guide (HACS & YAML) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Radio className="w-4 h-4 text-sky-500" />
                <span>Home Assistant Integratie</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Koppel VehicleVault in Home Assistant om kilometerstanden, APK status en verbruik in je dashboards weer te geven.
              </p>
            </div>

            {/* Option 1: HACS UI Integration */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-sky-50 to-indigo-50/50 dark:from-sky-950/30 dark:to-indigo-950/20 border border-sky-200/80 dark:border-sky-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded-full bg-sky-500 text-white text-[10px] font-black uppercase tracking-wider">
                    Aanbevolen
                  </span>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    HACS Custom Integration (Configuratie via HA Interface)
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
                Geen handmatige YAML configuratie nodig! Installeer de integratie via HACS en voeg VehicleVault met 1 klik toe via <strong>Instellingen → Apparaten & Diensten</strong>. Elk voertuig krijgt automatisch een eigen Apparaat en sensoren in Home Assistant.
              </p>

              <ol className="list-decimal list-inside text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pl-1">
                <li>Voeg <code className="px-1.5 py-0.5 bg-white dark:bg-slate-900 rounded font-mono text-[11px] border border-sky-200 dark:border-sky-800">https://github.com/TeeCodeDev/ha-vehiclevault</code> toe als Custom Repository in HACS.</li>
                <li>Download de integratie en herstart Home Assistant.</li>
                <li>Ga in Home Assistant naar <strong>Instellingen → Apparaten &amp; Diensten → Integratie toevoegen</strong> en kies <strong>VehicleVault</strong>.</li>
                <li>Vul je URL (<code className="px-1.5 py-0.5 bg-white dark:bg-slate-900 rounded font-mono text-[11px] border border-sky-200 dark:border-sky-800">{haHost}</code>) en optioneel je API-sleutel in.</li>
              </ol>
            </div>

            {/* Option 2: Manual YAML Configuration */}
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                  <Terminal className="w-3.5 h-3.5 text-slate-500" />
                  <span>Optie 2: Handmatige REST Sensor YAML (configuration.yaml)</span>
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
                  <span>{haCopied ? 'Gekopieerd!' : 'Kopieer YAML'}</span>
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800 max-h-60">
                  {haYamlConfig}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DATABASE & BACKUPS */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Database className="w-4 h-4 text-rose-500" />
                <span>1-Klik Database &amp; Bestanden Backup</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Download een compleet ZIP-archief met de SQLite database en alle geüploade tankbonnen en facturen.
              </p>
            </div>

            {/* Storage Stats Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Database Grootte</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                  {storageStats?.databaseSizeFormatted || '—'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Geüploade Bestanden</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                  {storageStats?.totalUploadsFormatted || '—'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Opslagpad</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-1 block truncate">
                  {storageStats?.dataDir || '/data'}
                </span>
              </div>
            </div>

            {/* Restore Notification Feedback */}
            {restoreMessage && (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>{restoreMessage}</span>
              </div>
            )}

            {restoreError && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl text-xs font-semibold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{restoreError}</span>
              </div>
            )}

            {/* Download & Restore Action Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center space-x-2">
                    <Download className="w-4 h-4 text-emerald-500" />
                    <span>Backup Exporteren</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Creëert een consistent ZIP-bestand van <span className="font-mono">vehiclevault.db</span> (via SQLite WAL checkpoint) en de mappen <span className="font-mono">receipts/</span> en <span className="font-mono">invoices/</span>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Volledige Backup (.zip)</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center space-x-2">
                    <Upload className="w-4 h-4 text-sky-500" />
                    <span>Backup Terugzetten</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Herstel VehicleVault vanaf een eerder gedownload ZIP-archief. Er wordt voor de veiligheid automatisch een <span className="font-mono">.bak</span> kopie gemaakt.
                  </p>
                </div>

                <label className={`w-full py-2.5 px-4 bg-slate-900 text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer shadow-sm ${
                  restoringBackup ? 'opacity-50 cursor-not-allowed' : ''
                }`}>
                  {restoringBackup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span>{restoringBackup ? 'Bezig met herstellen...' : 'Selecteer ZIP Backup Bestand'}</span>
                  <input
                    type="file"
                    accept=".zip"
                    disabled={restoringBackup}
                    onChange={handleRestoreFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: GEGEVENS IMPORTEREN (CSV / FUELIO / LUBELOGGER) */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <FileSpreadsheet className="w-4 h-4 text-sky-500" />
                <span>Gegevens Importeren (CSV / Fuelio / LubeLogger)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Importeer moeiteloos tankbeurten en onderhoudshistorie vanuit andere applicaties of handmatige CSV-bestanden.
              </p>
            </div>

            {importResultMessage && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 p-4 rounded-xl text-xs flex items-center space-x-2.5 font-medium shadow-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{importResultMessage}</span>
              </div>
            )}

            {importError && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-300 p-4 rounded-xl text-xs flex items-center space-x-2.5 font-medium shadow-sm">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{importError}</span>
              </div>
            )}

            {/* Target Vehicle & Format Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Doelvoertuig *
                </label>
                <select
                  value={targetVehicleId}
                  onChange={(e) => setImportVehicleId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
                >
                  {vehicles.length === 0 ? (
                    <option value="">Geen voertuigen beschikbaar</option>
                  ) : (
                    vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} {v.license_plate ? `(${v.license_plate})` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Bestandsformaat
                </label>
                <select
                  value={forcedFormat}
                  onChange={(e) => setForcedFormat(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 shadow-sm"
                >
                  <option value="auto">Automatisch detecteren (Aanbevolen)</option>
                  <option value="fuelio">Fuelio CSV Export</option>
                  <option value="lubelogger">LubeLogger CSV Export</option>
                  <option value="generic">Aangepast / Generiek CSV</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  CSV Bestand Selecteren *
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileChange}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-800 dark:file:text-slate-200 hover:file:bg-slate-200 cursor-pointer"
                />
              </div>
            </div>

            {/* Generic Column Mapper Wizard */}
            {showMapping && importPreview && (
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3 text-xs">
                <h4 className="font-bold text-slate-900 dark:text-white">Kolomtoewijzing Wizard</h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="text-slate-500 font-medium block mb-1">Type Data</label>
                    <select
                      value={recordType}
                      onChange={(e) => setRecordType(e.target.value as any)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-medium"
                    >
                      <option value="fuel">Brandstof / Tankbeurt</option>
                      <option value="service">Onderhoud / Service</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-500 font-medium block mb-1">Datum *</label>
                    <select
                      value={dateCol}
                      onChange={(e) => setDateCol(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-medium"
                    >
                      {importPreview.headers?.map((h: string) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-500 font-medium block mb-1">Kilometerstand *</label>
                    <select
                      value={odoCol}
                      onChange={(e) => setOdoCol(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-medium"
                    >
                      {importPreview.headers?.map((h: string) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-500 font-medium block mb-1">Kosten / Bedrag *</label>
                    <select
                      value={costCol}
                      onChange={(e) => setCostCol(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-medium"
                    >
                      {importPreview.headers?.map((h: string) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-500 font-medium block mb-1">Liters</label>
                    <select
                      value={litersCol}
                      onChange={(e) => setLitersCol(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-medium"
                    >
                      <option value="">(Geen)</option>
                      {importPreview.headers?.map((h: string) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-500 font-medium block mb-1">Notities</label>
                    <select
                      value={notesCol}
                      onChange={(e) => setNotesCol(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white font-medium"
                    >
                      <option value="">(Geen)</option>
                      {importPreview.headers?.map((h: string) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleImportPreview()}
                  className="mt-2 px-3.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 shadow-sm"
                >
                  Opnieuw berekenen met deze toewijzing
                </button>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => handleImportPreview()}
                disabled={importLoading || !csvFile || !targetVehicleId}
                className="px-5 py-2.5 bg-slate-900 text-white hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-xl font-bold text-xs inline-flex items-center space-x-2 transition disabled:opacity-50 shadow-sm"
              >
                {importLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Table className="w-4 h-4" />}
                <span>Gegevens Controleren &amp; Voorvertonen</span>
              </button>
            </div>
          </div>

          {/* Validation Preview Table */}
          {importPreview && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden space-y-3 shadow-sm transition-colors">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Gedetecteerd formaat: {importPreview.detectedFormat?.toUpperCase()}
                  </span>
                  <span className="text-slate-500 ml-3">
                    {importPreview.validRows} geldige rijen • {importPreview.errorRows} ongeldig
                  </span>
                </div>

                <button
                  onClick={handleExecuteImport}
                  disabled={importExecuting || importPreview.validRows === 0}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition disabled:opacity-50 shadow-sm"
                >
                  {importExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Import Uitvoeren ({importPreview.validRows} rijen)</span>
                </button>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 sticky top-0 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Datum</th>
                      <th className="py-2.5 px-3">Kilometerstand</th>
                      <th className="py-2.5 px-3">Liters / Omschrijving</th>
                      <th className="py-2.5 px-3">Kosten</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {importPreview.records?.slice(0, 50).map((r: any, idx: number) => (
                      <tr key={idx} className={r.isValid ? 'hover:bg-slate-50 dark:hover:bg-slate-800/20' : 'bg-rose-50/50 dark:bg-rose-950/20'}>
                        <td className="py-2.5 px-3 font-bold uppercase text-[10px] text-slate-500">
                          {r.type === 'fuel' ? 'Brandstof' : 'Onderhoud'}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-200">{r.date}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-300">
                          {r.odometer.toLocaleString()} km
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium">
                          {r.type === 'fuel' ? (r.liters ? `${r.liters} L` : '—') : r.serviceItem}
                        </td>
                        <td className="py-2.5 px-3 font-black text-slate-900 dark:text-white">€ {r.totalCost.toFixed(2)}</td>
                        <td className="py-2.5 px-3">
                          {r.isValid ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">Geldig</span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 font-medium text-[11px]">{r.error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create User Modal */}
      {isCreateUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-emerald-500" />
                <span>Nieuwe Gebruiker Toevoegen</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  E-mailadres / Pangolin Gebruiker *
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="bijv. test@romanas.nl of naam@domein.nl"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Moet overeenkomen met het e-mailadres waarmee in Pangolin wordt ingelogd.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Toegangsrol *
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-semibold"
                >
                  <option value="driver">🚗 Chauffeur (Aanbevolen: vereenvoudigde weergave, alleen tanken)</option>
                  <option value="admin">👑 Beheerder (Volledige toegang tot alles)</option>
                  <option value="user">👤 Standaard Gebruiker</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Wachtwoord (Optioneel)
                </label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Minimaal 6 tekens (alleen nodig bij inloggen zonder Pangolin)"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateUserModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition font-medium"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={creatingUser || !newUserEmail}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-black dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
                >
                  {creatingUser ? 'Bezig...' : 'Gebruiker Toevoegen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Link as LinkIcon,
  Copy,
  Check,
  ExternalLink,
  Download,
  Camera,
  Trash2,
  Star,
  Eye,
  EyeOff,
  ShieldCheck,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { useLanguage } from '../context/LanguageContext.js';

interface ShowcaseManagerModalProps {
  vehicleId: string;
  vehicleName: string;
  isOpen: boolean;
  onClose: () => void;
  onVehicleUpdated?: () => void;
}

export const ShowcaseManagerModal: React.FC<ShowcaseManagerModalProps> = ({
  vehicleId,
  vehicleName,
  isOpen,
  onClose,
  onVehicleUpdated,
}) => {
  const { lang } = useLanguage();
  const [activeTab, setActiveTab] = useState<'link' | 'photos' | 'content'>('link');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  // Showcase state
  const [showcase, setShowcase] = useState<any>(null);
  const [isActive, setIsActive] = useState(true);
  const [publicSlug, setPublicSlug] = useState('');
  const [askingPrice, setAskingPrice] = useState<string>('');
  const [priceLabel, setPriceLabel] = useState('Vraagprijs');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactLocation, setContactLocation] = useState('');
  const [transparencyNotes, setTransparencyNotes] = useState('');

  // Photos state
  const [photos, setPhotos] = useState<any[]>([]);
  const [uploadCategory, setUploadCategory] = useState<'exterieur' | 'interieur' | 'details' | 'gebruikssporen'>('exterieur');
  const [uploading, setUploading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!isOpen || !vehicleId) return;
    loadData();
  }, [isOpen, vehicleId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [showcaseRes, photosRes] = await Promise.all([
        apiFetch<{ showcase: any }>(`/api/vehicles/${vehicleId}/showcase`),
        apiFetch<{ photos: any[] }>(`/api/vehicles/${vehicleId}/photos`),
      ]);

      const sc = showcaseRes.showcase;
      setShowcase(sc);
      setIsActive(sc.is_active);
      setPublicSlug(sc.public_slug);
      setAskingPrice(sc.asking_price ? String(sc.asking_price) : '');
      setPriceLabel(sc.price_label || 'Vraagprijs');
      setTitle(sc.title || '');
      setSubtitle(sc.subtitle || '');
      setContactWhatsapp(sc.contact_whatsapp || '');
      setContactPhone(sc.contact_phone || '');
      setContactEmail(sc.contact_email || '');
      setContactLocation(sc.contact_location || '');
      setTransparencyNotes(sc.transparency_notes || '');

      setPhotos(photosRes.photos || []);
    } catch (err: any) {
      setError(err?.message || 'Fout bij het laden van showcase gegevens');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveShowcase = async () => {
    setLoading(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const payload = {
        is_active: isActive,
        public_slug: publicSlug,
        asking_price: askingPrice ? parseFloat(askingPrice) : null,
        price_label: priceLabel,
        title,
        subtitle,
        contact_whatsapp: contactWhatsapp,
        contact_phone: contactPhone,
        contact_email: contactEmail,
        contact_location: contactLocation,
        transparency_notes: transparencyNotes,
      };

      const res = await apiFetch<{ showcase: any }>(`/api/vehicles/${vehicleId}/showcase`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setShowcase(res.showcase);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      if (onVehicleUpdated) onVehicleUpdated();
      window.dispatchEvent(new CustomEvent('showcase:changed'));
      window.dispatchEvent(new CustomEvent('vehicle:refresh'));
    } catch (err: any) {
      setError(err?.message || 'Opslaan mislukt');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async () => {
    setTogglingActive(true);
    setError(null);
    const newStatus = !isActive;
    try {
      const res = await apiFetch<{ showcase: any }>(`/api/vehicles/${vehicleId}/showcase`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: newStatus }),
      });
      setIsActive(newStatus);
      setShowcase(res.showcase);
      if (onVehicleUpdated) onVehicleUpdated();
      window.dispatchEvent(new CustomEvent('showcase:changed'));
      window.dispatchEvent(new CustomEvent('vehicle:refresh'));
    } catch (err: any) {
      setError(err?.message || 'Status wijzigen mislukt');
    } finally {
      setTogglingActive(false);
    }
  };

  const handleUploadPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('photos', files[i]);
      }
      formData.append('category', uploadCategory);

      await apiFetch(`/api/vehicles/${vehicleId}/photos`, {
        method: 'POST',
        body: formData,
      });

      // Reload photos
      const updated = await apiFetch<{ photos: any[] }>(`/api/vehicles/${vehicleId}/photos`);
      setPhotos(updated.photos || []);
      if (onVehicleUpdated) onVehicleUpdated();
    } catch (err: any) {
      setError(err?.message || 'Fout bij het uploaden van foto\'s');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSetPrimaryPhoto = async (photoId: string) => {
    try {
      await apiFetch(`/api/vehicles/${vehicleId}/photos/${photoId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_primary: 1 }),
      });
      const updated = await apiFetch<{ photos: any[] }>(`/api/vehicles/${vehicleId}/photos`);
      setPhotos(updated.photos || []);
      if (onVehicleUpdated) onVehicleUpdated();
    } catch (err: any) {
      setError(err?.message || 'Hoofdfoto instellen mislukt');
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Weet je zeker dat je deze foto wilt verwijderen?')) return;
    try {
      await apiFetch(`/api/vehicles/${vehicleId}/photos/${photoId}`, {
        method: 'DELETE',
      });
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      if (onVehicleUpdated) onVehicleUpdated();
    } catch (err: any) {
      setError(err?.message || 'Foto verwijderen mislukt');
    }
  };

  const handleDownloadZip = () => {
    window.open(`/api/vehicles/${vehicleId}/showcase/export-zip`, '_blank');
  };

  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/showcase/${publicSlug || showcase?.public_slug || ''}`
    : `/showcase/${publicSlug}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-accent-100 dark:bg-accent-950/70 text-accent-600 dark:text-accent-400 flex items-center justify-center shrink-0 border border-accent-200/80 dark:border-accent-800 shadow-2xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                  {lang === 'nl' ? 'Verkooppagina & Showcase Dossier' : 'Sales Showcase & Vehicle Dossier'}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-50 text-accent-700 dark:bg-accent-950/60 dark:text-accent-300 border border-accent-200/70 dark:border-accent-800">
                  v2.0
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'nl'
                  ? `${vehicleName} • Beheer openbare pagina, multi-foto galerij en standalone website export`
                  : `${vehicleName} • Manage public page, photo gallery, and standalone website export`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
            title={lang === 'nl' ? 'Sluiten' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Navigation Tabs */}
        <div className="px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition ${
              activeTab === 'link'
                ? 'bg-accent-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>{lang === 'nl' ? 'Publieke Link & Verkoop' : 'Public Link & Status'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('photos')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition ${
              activeTab === 'photos'
                ? 'bg-accent-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{lang === 'nl' ? `Fotogalerij (${photos.length})` : `Photo Gallery (${photos.length})`}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('content')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition ${
              activeTab === 'content'
                ? 'bg-accent-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{lang === 'nl' ? 'Teksten & Transparantie' : 'Pricing & Transparency'}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 text-xs text-red-600 dark:text-red-400 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-600 dark:text-emerald-400 flex items-center space-x-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>Instellingen succesvol opgeslagen!</span>
            </div>
          )}

          {/* TAB 1: Publieke Link & Verkoop */}
          {activeTab === 'link' && (
            <div className="space-y-5">
              {/* Online / Offline Status Banner */}
              <div
                className={`p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border transition ${
                  isActive
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80'
                    : 'bg-slate-50 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center space-x-3.5">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                      isActive
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {isActive ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        Status: {isActive ? (lang === 'nl' ? 'Openbaar Online' : 'Publicly Online') : (lang === 'nl' ? 'Uitgeschakeld (Privé)' : 'Disabled (Private)')}
                      </h4>
                      {isActive && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>{lang === 'nl' ? 'Zichtbaar' : 'Live'}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isActive
                        ? (lang === 'nl'
                            ? 'Iedereen met de unieke link kan dit verkoopdossier zonder inlogaccount bekijken.'
                            : 'Anyone with this unique link can view this showcase dossier without logging in.')
                        : (lang === 'nl'
                            ? 'De pagina is momenteel niet toegankelijk voor bezoekers (geeft 404).'
                            : 'This public page is currently disabled.')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleToggleActive}
                    disabled={togglingActive || loading}
                    className={`h-10 px-4 rounded-xl text-xs font-bold transition shadow-xs flex items-center space-x-1.5 ${
                      isActive
                        ? 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-900/50'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20'
                    }`}
                  >
                    {togglingActive ? (
                      <span>Bezig...</span>
                    ) : isActive ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Offline Halen</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Nu Live Zetten</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Shareable Link Box */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Openbare Verkooppagina Link & Unieke URL
                </label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-accent-500/20 focus-within:border-accent-500 h-10 transition">
                    <span className="px-3 text-xs text-slate-400 dark:text-slate-500 font-mono select-none shrink-0 border-r border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800 h-full flex items-center">
                      {typeof window !== 'undefined' ? `${window.location.origin}/showcase/` : '/showcase/'}
                    </span>
                    <input
                      type="text"
                      value={publicSlug}
                      onChange={(e) => setPublicSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                      placeholder="unieke-naam"
                      className="flex-1 h-full px-3 text-xs font-mono font-bold text-slate-900 dark:text-white bg-transparent outline-none min-w-0"
                    />
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="h-10 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition border border-slate-200 dark:border-slate-700 shrink-0"
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedLink ? 'Gekopieerd!' : 'Kopiëren'}</span>
                    </button>
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-10 px-4 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition shrink-0 shadow-xs"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>{lang === 'nl' ? 'Bekijken' : 'View Public'}</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* 1-Click Standalone Website ZIP Download */}
              <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-blue-950 dark:text-blue-100 flex items-center space-x-2">
                    <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>{lang === 'nl' ? 'Standalone Website Exporteren (ZIP)' : 'Export Standalone Website (ZIP)'}</span>
                  </h4>
                  <p className="text-xs text-blue-800/80 dark:text-blue-300 mt-1 max-w-xl leading-relaxed">
                    {lang === 'nl'
                      ? "Download een kant-en-klaar HTML/CSS/JS pakket inclusief alle foto's. Direct geschikt om op een eigen domein, hosting of dealerportal te uploaden."
                      : "Download a static zero-dependency HTML/CSS/JS package including all photos. Ready to host on GitHub Pages or any web server."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition shrink-0 shadow-xs hover:scale-[1.02]"
                >
                  <Download className="w-4 h-4" />
                  <span>{lang === 'nl' ? 'Download ZIP Pakket' : 'Download Static Website (ZIP)'}</span>
                </button>
              </div>

              {/* Pricing & Contact Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Prijslabel
                  </label>
                  <select
                    value={priceLabel}
                    onChange={(e) => setPriceLabel(e.target.value)}
                    className="w-full h-10 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition"
                  >
                    <option value="Vraagprijs">Vraagprijs</option>
                    <option value="Bieden vanaf">Bieden vanaf</option>
                    <option value="Vaste meeneemprijs">Vaste meeneemprijs</option>
                    <option value="Inruilprijs">Inruilprijs</option>
                    <option value="Prijs op aanvraag">Prijs op aanvraag</option>
                    <option value="Geen prijs tonen">Geen prijs tonen (verbergen)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Vraagprijs (€)
                  </label>
                  <input
                    type="number"
                    value={priceLabel === 'Geen prijs tonen' ? '' : askingPrice}
                    onChange={(e) => setAskingPrice(e.target.value)}
                    disabled={priceLabel === 'Geen prijs tonen' || priceLabel === 'Prijs op aanvraag'}
                    placeholder={
                      priceLabel === 'Geen prijs tonen'
                        ? 'Geen prijs zichtbaar op pagina'
                        : priceLabel === 'Prijs op aanvraag'
                        ? 'Prijs op aanvraag'
                        : 'bijv. 8950 (leeg laten = geen prijs tonen)'
                    }
                    className="w-full h-10 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition disabled:opacity-50"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {priceLabel === 'Geen prijs tonen'
                      ? 'Er wordt geen vraagprijs of prijskaartje getoond (ideaal voor garage-inruil/taxatie).'
                      : 'Laat leeg of kies \'Geen prijs tonen\' om geen bedrag te tonen.'}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    WhatsApp Nummer (voor 1-klik chat)
                  </label>
                  <input
                    type="text"
                    value={contactWhatsapp}
                    onChange={(e) => setContactWhatsapp(e.target.value)}
                    placeholder="bijv. +31612345678"
                    className="w-full h-10 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Telefoonnummer
                  </label>
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="bijv. 06-12345678"
                    className="w-full h-10 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Contact E-mailadres
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="bijv. koper@domein.nl"
                    className="w-full h-10 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Locatie Bezichtiging
                  </label>
                  <input
                    type="text"
                    value={contactLocation}
                    onChange={(e) => setContactLocation(e.target.value)}
                    placeholder="bijv. Groningen / Nederland"
                    className="w-full h-10 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Fotogalerij (Multi-Foto Beheer) */}
          {activeTab === 'photos' && (
            <div className="space-y-6">
              {/* Upload Dropzone */}
              <div className="bg-slate-50 dark:bg-slate-950/70 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-6 text-center space-y-3">
                <div className="w-12 h-12 bg-accent-100 dark:bg-accent-950 text-accent-600 dark:text-accent-400 rounded-2xl flex items-center justify-center mx-auto">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Meerdere Voertuigfoto's Uploaden
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Selecteer één of meerdere foto's tegelijk (JPG, PNG, WEBP).
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Toewijzen aan categorie:</span>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value as any)}
                      className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-white"
                    >
                      <option value="exterieur">Exterieur</option>
                      <option value="interieur">Interieur</option>
                      <option value="details">Details & Opties</option>
                      <option value="gebruikssporen">Gebruikssporen</option>
                    </select>
                  </div>

                  <label className="cursor-pointer px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition shadow-xs">
                    <Plus className="w-4 h-4" />
                    <span>{uploading ? 'Uploaden...' : 'Foto\'s Selecteren'}</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleUploadPhotos}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Photo Cards Grid */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-3">
                  Aanwezige Foto's ({photos.length})
                </h4>

                {photos.length === 0 ? (
                  <div className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
                    Nog geen foto's geüpload voor dit voertuig.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {photos.map((p) => (
                      <div
                        key={p.id}
                        className={`bg-white dark:bg-slate-800 border rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between transition-all ${
                          p.is_primary === 1
                            ? 'border-accent-500 ring-2 ring-accent-500/20'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="aspect-[16/10] bg-slate-100 dark:bg-slate-900 relative group">
                          <img
                            src={`/uploads/vehicles/${p.file_path}`}
                            alt={p.title || 'Foto'}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-black/60 text-white">
                            {p.category}
                          </span>
                          {p.is_primary === 1 && (
                            <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 flex items-center space-x-0.5 shadow-xs">
                              <Star className="w-3 h-3 fill-slate-950" />
                              <span>Hoofdfoto</span>
                            </span>
                          )}
                        </div>

                        <div className="p-3 space-y-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                            {p.title || 'Voertuigfoto'}
                          </span>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60">
                            {p.is_primary !== 1 ? (
                              <button
                                type="button"
                                onClick={() => handleSetPrimaryPhoto(p.id)}
                                className="text-[11px] font-bold text-accent-600 dark:text-accent-400 hover:underline flex items-center space-x-1"
                              >
                                <Star className="w-3 h-3" />
                                <span>Als hoofdfoto</span>
                              </button>
                            ) : (
                              <span className="text-[11px] font-bold text-amber-500">Hoofdfoto</span>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeletePhoto(p.id)}
                              className="text-slate-400 hover:text-red-500 transition p-1"
                              title="Verwijderen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Teksten & Transparantie */}
          {activeTab === 'content' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Paginatitel
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="bijv. Toyota Auris 1.8 Hybrid Lease Plus"
                  className="w-full h-10 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Korte Samenvatting / Subtitel
                </label>
                <textarea
                  rows={2}
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Korte pakkende omschrijving van de staat en uitvoering van de auto..."
                  className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl p-3.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Eerlijke Transparantie & Gebruikssporen (Bouwt vertrouwen op bij kopers)
                </label>
                <textarea
                  rows={5}
                  value={transparencyNotes}
                  onChange={(e) => setTransparencyNotes(e.target.value)}
                  placeholder="Vermeld hier eerlijk eventuele lichte gebruikerssporen, de staat van onderhoud en dat facturen ter inzage liggen..."
                  className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl p-3.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center space-x-2">
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-accent-600 hover:text-accent-700 dark:text-accent-400 inline-flex items-center space-x-1.5 hover:underline"
            >
              <span>Live Verkooppagina Openen</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition"
            >
              Sluiten
            </button>
            <button
              type="button"
              onClick={handleSaveShowcase}
              disabled={loading}
              className="h-10 px-5 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center space-x-2"
            >
              {loading ? (
                <span>Opslaan...</span>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Wijzigingen Opslaan</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

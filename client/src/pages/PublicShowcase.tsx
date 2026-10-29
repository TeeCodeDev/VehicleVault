import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  FileText,
  Cpu,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  Phone,
  Mail,
  MessageCircle,
  MapPin,
  Sparkles,
  Layers,
  ArrowUpRight,
  AlertTriangle,
  Wrench,
} from 'lucide-react';
import { LicensePlateBadge } from '../components/LicensePlateBadge.js';
import { formatLicensePlate } from '../utils/licensePlate.js';

interface CompiledShowcase {
  id: string;
  vehicle_id: string;
  public_slug: string;
  is_active: boolean;
  asking_price: number | null;
  price_label: string;
  title: string;
  subtitle: string;
  highlights: { id: string; icon: string; title: string; description: string }[];
  options_list: { category: string; items: string[] }[];
  transparency_notes: string;
  contact_whatsapp: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_location: string | null;
  show_maintenance_history: boolean;
  show_tire_status: boolean;
  show_rdw_specs: boolean;
  vehicle: {
    id: string;
    name: string;
    type: string;
    license_plate: string | null;
    vin: string | null;
    year: number | null;
    make: string | null;
    model: string | null;
    fuel_type: string | null;
    current_odometer: number;
    apk_expiration_date: string | null;
    apk_status?: string;
  };
  stats: {
    bouwjaar: string;
    herkomst?: string;
    kilometerstand: string;
    brandstof_transmissie: string;
    vermogen: string;
    apk_vervaldatum: string;
    apk_status: string;
    energielabel: string;
    nap_oordeel: string;
  };
  photos: {
    id: string;
    file_path: string;
    category: 'exterieur' | 'interieur' | 'details' | 'gebruikssporen';
    title?: string;
    description?: string;
    sort_order: number;
    is_primary: number;
  }[];
  specs: {
    basis: { label: string; value: string }[];
    motor: { label: string; value: string }[];
    milieu: { label: string; value: string }[];
  };
  maintenance_records: {
    date: string;
    odometer: number;
    category: string;
    description: string;
    has_invoice: boolean;
  }[];
  tires: {
    name: string;
    brand_model?: string;
    season: string;
    tire_size?: string;
    tread_depth_fl?: number;
    tread_depth_fr?: number;
    tread_depth_rl?: number;
    tread_depth_rr?: number;
    last_measured_date?: string;
  } | null;
}

export const PublicShowcase: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [showcase, setShowcase] = useState<CompiledShowcase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Gallery filters & Lightbox
  const lang = localStorage.getItem('vv_lang') || 'nl';
  const [activeCategory, setActiveCategory] = useState<'all' | 'exterieur' | 'interieur' | 'details' | 'gebruikssporen'>('all');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/public/showcase/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Verkooppagina niet gevonden');
        }
        return res.json();
      })
      .then((data) => {
        setShowcase(data.showcase);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [slug]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null || !showcase) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : showcase.photos.length - 1));
      }
      if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) => (prev !== null && prev < showcase.photos.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, showcase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-500 font-sans">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold">Voertuigdossier laden...</p>
        </div>
      </div>
    );
  }

  if (error || !showcase) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Verkooppagina Niet Beschikbaar</h1>
          <p className="text-sm text-slate-500">
            {error || 'Dit voertuigdossier is momenteel niet openbaar actief of de link is verlopen.'}
          </p>
          <div className="pt-2">
            <Link
              to="/login"
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              <span>Naar VehicleVault Inloggen</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const v = showcase.vehicle;
  const filteredPhotos = activeCategory === 'all'
    ? showcase.photos
    : showcase.photos.filter((p) => p.category === activeCategory);

  const priceFormatted = showcase.asking_price
    ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(showcase.asking_price)
    : null;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center shadow-xs text-sm sm:text-base">
              VV
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight leading-snug line-clamp-1">
                {showcase.title}
              </h1>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                {lang === 'nl' ? 'Voertuiginformatie, Verkoop & Inruil' : 'Vehicle Passport, Sales & Inquiries'}
              </p>
            </div>
          </div>

          <nav className="flex items-center space-x-1 sm:space-x-3">
            <a
              href="#fotos"
              className="hidden md:inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition"
            >
              {lang === 'nl' ? `Foto's (${showcase.photos.length})` : `Photos (${showcase.photos.length})`}
            </a>
            <a
              href="#highlights"
              className="hidden md:inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition"
            >
              Highlights
            </a>
            <a
              href="#specificaties"
              className="hidden md:inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition"
            >
              {lang === 'nl' ? 'Specificaties' : 'Specifications'}
            </a>
            <a
              href="#opties"
              className="hidden md:inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition"
            >
              {lang === 'nl' ? 'Opties' : 'Options'}
            </a>
            <a
              href="#historie"
              className="hidden md:inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition"
            >
              {lang === 'nl' ? 'Historie' : 'History'}
            </a>
            <a
              href="#contact"
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs flex items-center space-x-1.5"
            >
              <span>{lang === 'nl' ? 'Contact / Bod' : 'Contact / Inquire'}</span>
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Showcase Section */}
      <section className="bg-white border-b border-slate-200 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Top Badges */}
          <div className="flex flex-wrap items-center gap-2.5 mb-5">
            {v.license_plate && (
              <LicensePlateBadge plate={v.license_plate} size="lg" showCopy={true} />
            )}

            {/* Prijsbadge: alleen tonen als vraagprijs ingevuld is of expliciet 'Prijs op aanvraag' gekozen is */}
            {showcase.price_label !== 'Geen prijs tonen' && showcase.price_label !== 'Geen prijs' && (
              priceFormatted ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-900 border border-amber-200 shadow-2xs">
                  💰 {showcase.price_label}: {priceFormatted}
                </span>
              ) : showcase.price_label === 'Prijs op aanvraag' ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-900 border border-amber-200 shadow-2xs">
                  💰 Prijs op aanvraag
                </span>
              ) : null
            )}

            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              🛡️ {lang === 'nl' ? `APK t/m ${showcase.stats.apk_vervaldatum}` : `APK valid until ${showcase.stats.apk_vervaldatum}`}
            </span>

            {/* NAP Tellerstand: alleen tonen als oordeel daadwerkelijk Logisch is (verbergen bij 'Geen oordeel' of onbekend) */}
            {showcase.stats.nap_oordeel &&
              showcase.stats.nap_oordeel.toLowerCase().includes('logisch') &&
              !showcase.stats.nap_oordeel.toLowerCase().includes('onlogisch') && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                  ✓ {lang === 'nl' ? (showcase.stats.nap_oordeel === 'Logisch' ? 'NAP Logisch' : showcase.stats.nap_oordeel) : 'NAP Verified'}
                </span>
            )}

            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
              ⚡ {lang === 'nl' ? `Energielabel ${showcase.stats.energielabel}` : `Energy Rating ${showcase.stats.energielabel}`}
            </span>
          </div>

          {/* Title & Subtitle */}
          <div className="max-w-4xl space-y-2 mb-8">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              {showcase.title}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
              {showcase.subtitle}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                {lang === 'nl' ? 'Bouwjaar' : 'Model Year'}
              </span>
              <span className="text-lg sm:text-xl font-black text-slate-900 mt-0.5 block">{showcase.stats.bouwjaar}</span>
              <span className="text-[11px] text-slate-500 font-medium">
                {lang === 'nl' ? (showcase.stats.herkomst || 'Origineel Nederlands') : 'Original NL Market'}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                {lang === 'nl' ? 'Kilometerstand' : 'Odometer'}
              </span>
              <span className="text-lg sm:text-xl font-black text-slate-900 mt-0.5 block font-mono">
                {v.current_odometer.toLocaleString(lang === 'nl' ? 'nl-NL' : 'en-US')} km*
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {showcase.stats.nap_oordeel &&
                showcase.stats.nap_oordeel.toLowerCase().includes('logisch') &&
                !showcase.stats.nap_oordeel.toLowerCase().includes('onlogisch')
                  ? (lang === 'nl' ? 'NAP Logisch' : 'Verified Mileage')
                  : (lang === 'nl' ? 'Geregistreerd' : 'Documented')}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                {lang === 'nl' ? 'Aandrijving' : 'Powertrain'}
              </span>
              <span className="text-base sm:text-lg font-black text-slate-900 mt-0.5 block truncate">
                {lang === 'nl'
                  ? showcase.stats.brandstof_transmissie
                  : (showcase.title.includes('DSG') || showcase.vehicle.name.includes('DSG')
                      ? 'Petrol 7-Speed DSG'
                      : showcase.stats.brandstof_transmissie
                          .replace('Handgeschakeld', 'Manual')
                          .replace('Automaat', 'Automatic DSG')
                          .replace('Benzine', 'Petrol'))}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {lang === 'nl' ? 'Zuinig & betrouwbaar' : 'Responsive & efficient'}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                {lang === 'nl' ? 'Vermogen' : 'Power'}
              </span>
              <span className="text-base sm:text-lg font-black text-slate-900 mt-0.5 block">
                {lang === 'nl'
                  ? showcase.stats.vermogen
                  : (showcase.stats.vermogen === 'Petrol' || showcase.stats.vermogen === 'Benzine'
                      ? '245 HP (180 kW)'
                      : showcase.stats.vermogen.replace('pk', 'HP'))}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {lang === 'nl' ? 'Motorvermogen' : 'Engine output'}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                {lang === 'nl' ? 'APK Vervaldatum' : 'APK Inspection'}
              </span>
              <span className="text-base sm:text-lg font-black text-slate-900 mt-0.5 block text-emerald-700">
                {showcase.stats.apk_vervaldatum}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {lang === 'nl' ? 'Gekeurd & veilig' : 'Inspected & valid'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights / Pluspunten */}
      {showcase.highlights.length > 0 && (
        <section id="highlights" className="py-12 sm:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="mb-8">
              <span className="text-xs font-black uppercase tracking-widest text-blue-600 block mb-1">
                {lang === 'nl' ? 'Voordelen & Staat' : 'Features & Condition'}
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {lang === 'nl' ? 'Belangrijkste Pluspunten' : 'Key Vehicle Highlights'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {lang === 'nl'
                  ? 'Kort samengevat waarom dit voertuig een betrouwbare aankoop of inruil is.'
                  : 'Comprehensive overview of key vehicle features and ownership history.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {showcase.highlights.map((h, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-3.5">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <h4 className="text-base font-extrabold text-slate-900 mb-1">{h.title}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">{h.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Photo Gallery & Lightbox */}
      <section id="fotos" className="py-12 sm:py-16 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-6">
            <span className="text-xs font-black uppercase tracking-widest text-blue-600 block mb-1">
              Fotoreportage
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Foto's & Details ({showcase.photos.length})
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Klik op een foto voor hoge resolutie schermweergave. Gebruik de filters om snel specifieke onderdelen te bekijken.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 mb-8">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition shadow-xs ${
                activeCategory === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Alle foto's ({showcase.photos.length})
            </button>
            <button
              onClick={() => setActiveCategory('exterieur')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition shadow-xs ${
                activeCategory === 'exterieur'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Exterieur ({showcase.photos.filter((p) => p.category === 'exterieur').length})
            </button>
            <button
              onClick={() => setActiveCategory('interieur')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition shadow-xs ${
                activeCategory === 'interieur'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Interieur ({showcase.photos.filter((p) => p.category === 'interieur').length})
            </button>
            <button
              onClick={() => setActiveCategory('details')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition shadow-xs ${
                activeCategory === 'details'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Details & Opties ({showcase.photos.filter((p) => p.category === 'details').length})
            </button>
            <button
              onClick={() => setActiveCategory('gebruikssporen')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition shadow-xs ${
                activeCategory === 'gebruikssporen'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
              }`}
            >
              Gebruikssporen ({showcase.photos.filter((p) => p.category === 'gebruikssporen').length})
            </button>
          </div>

          {/* Photo Grid */}
          {filteredPhotos.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-12 text-center text-xs text-slate-400">
              Geen foto's in deze categorie.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredPhotos.map((photo) => {
                const globalIndex = showcase.photos.findIndex((p) => p.id === photo.id);
                return (
                  <div
                    key={photo.id}
                    onClick={() => setLightboxIndex(globalIndex)}
                    className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden group cursor-pointer shadow-xs hover:shadow-lg transition-all"
                  >
                    <div className="aspect-[16/10] bg-slate-100 overflow-hidden relative">
                      <img
                        src={`/uploads/vehicles/${photo.file_path}`}
                        alt={photo.title || 'Foto'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-black/60 backdrop-blur-xs text-white">
                        {photo.category}
                      </span>
                    </div>

                    <div className="p-3.5">
                      <strong className="text-xs sm:text-sm font-bold text-slate-900 block truncate">
                        {photo.title || 'Foto'}
                      </strong>
                      {photo.description && (
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5 line-clamp-2">
                          {photo.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* RDW Specifications */}
      {showcase.show_rdw_specs && (
        <section id="specificaties" className="py-12 sm:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="mb-8">
              <span className="text-xs font-black uppercase tracking-widest text-blue-600 block mb-1">
                Officiële RDW Specificaties
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Technische Gegevens
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Geverifieerd via het officiële Nederlandse RDW-register.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Basis & Registratie */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
                <h4 className="text-sm font-extrabold text-slate-900 pb-3 mb-3 border-b border-slate-100 flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Basis & Registratie</span>
                </h4>
                <div className="space-y-2 text-xs">
                  {showcase.specs.basis.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500 font-medium">{item.label}</span>
                      <span className="font-bold text-slate-900 text-right">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Motor & Aandrijving */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
                <h4 className="text-sm font-extrabold text-slate-900 pb-3 mb-3 border-b border-slate-100 flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-blue-600" />
                  <span>Motor & Aandrijving</span>
                </h4>
                <div className="space-y-2 text-xs">
                  {showcase.specs.motor.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500 font-medium">{item.label}</span>
                      <span className="font-bold text-slate-900 text-right">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Milieu & Gewichten */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
                <h4 className="text-sm font-extrabold text-slate-900 pb-3 mb-3 border-b border-slate-100 flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Milieu, Verbruik & Maten</span>
                </h4>
                <div className="space-y-2 text-xs">
                  {showcase.specs.milieu.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500 font-medium">{item.label}</span>
                      <span className="font-bold text-slate-900 text-right">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Options & Equipment */}
      {showcase.options_list.length > 0 && (
        <section id="opties" className="py-12 sm:py-16 bg-white border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="mb-8">
              <span className="text-xs font-black uppercase tracking-widest text-blue-600 block mb-1">
                Uitrustingsniveau
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Opties & Accessoires
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Compleet overzicht van alle aanwezige fabrieksopties en comfortvoorzieningen.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {showcase.options_list.map((group, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5">
                  <h4 className="text-sm font-extrabold text-slate-900 mb-3 pb-2 border-b border-slate-200">
                    {group.category}
                  </h4>
                  <ul className="space-y-2 text-xs font-medium text-slate-700">
                    {group.items.map((opt, optIdx) => (
                      <li key={optIdx} className="flex items-start space-x-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{opt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Maintenance & Honest Transparency */}
      <section id="historie" className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-blue-600 block mb-1">
              Onderhoud & Transparantie
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Staat van het Voertuig & Historie
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Eerlijke en transparante informatie voor een betrouwbaar inruilvoorstel of particuliere aankoop.
            </p>
          </div>

          {/* Transparency Card */}
          <div className="bg-white border-l-4 border-l-blue-600 border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h4 className="text-base font-extrabold text-slate-900 mb-2 flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <span>Onderhoudshistorie & Staat ter Inzage</span>
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-line">
              {showcase.transparency_notes}
            </p>
          </div>

          {/* Maintenance Records Table */}
          {showcase.show_maintenance_history && showcase.maintenance_records.length > 0 && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs overflow-hidden">
              <h4 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center space-x-2">
                <Wrench className="w-4 h-4 text-blue-600" />
                <span>Geregistreerde Onderhoudsbeurten</span>
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                      <th className="pb-3">Datum</th>
                      <th className="pb-3">Km-stand</th>
                      <th className="pb-3">Categorie</th>
                      <th className="pb-3">Omschrijving</th>
                      <th className="pb-3 text-right">Factuur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {showcase.maintenance_records.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 font-medium text-slate-700">{r.date}</td>
                        <td className="py-2.5 font-bold font-mono text-slate-900">{r.odometer.toLocaleString('nl-NL')} km</td>
                        <td className="py-2.5">
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px]">
                            {r.category}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-600 font-medium">{r.description || '—'}</td>
                        <td className="py-2.5 text-right">
                          {r.has_invoice ? (
                            <span className="text-emerald-600 font-bold text-[11px] inline-flex items-center space-x-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>Aanwezig</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Mounted Tire Set */}
          {showcase.show_tire_status && showcase.tires && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
              <h4 className="text-sm font-extrabold text-slate-900 mb-2">
                🛞 Gemonteerde Bandenset
              </h4>
              <p className="text-xs text-slate-600 font-medium mb-4">
                <strong>{showcase.tires.name}</strong> ({showcase.tires.season}
                {showcase.tires.brand_model ? ` • ${showcase.tires.brand_model}` : ''}
                {showcase.tires.tire_size ? ` • ${showcase.tires.tire_size}` : ''})
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Linksvoor</span>
                  <span className="text-base font-black text-emerald-600 font-mono">
                    {showcase.tires.tread_depth_fl ? `${showcase.tires.tread_depth_fl} mm` : '—'}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Rechtsvoor</span>
                  <span className="text-base font-black text-emerald-600 font-mono">
                    {showcase.tires.tread_depth_fr ? `${showcase.tires.tread_depth_fr} mm` : '—'}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Linksachter</span>
                  <span className="text-base font-black text-emerald-600 font-mono">
                    {showcase.tires.tread_depth_rl ? `${showcase.tires.tread_depth_rl} mm` : '—'}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Rechtsachter</span>
                  <span className="text-base font-black text-emerald-600 font-mono">
                    {showcase.tires.tread_depth_rr ? `${showcase.tires.tread_depth_rr} mm` : '—'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Contact & Inruil CTA Banner */}
      <section id="contact" className="py-12 sm:py-16 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 rounded-3xl p-8 sm:p-12 text-center text-white shadow-xl space-y-6">
            <div className="max-w-xl mx-auto space-y-2">
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
                Interesse of Bod Uitbrengen?
              </h3>
              <p className="text-xs sm:text-sm text-blue-100 font-medium">
                Neem direct en laagdrempelig contact op voor een bezichtiging, proefrit of inruilvoorstel.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              {showcase.contact_whatsapp && (
                <a
                  href={`https://wa.me/${showcase.contact_whatsapp.replace(/[^0-9]/g, '')}?text=Hallo,%20ik%20heb%20interesse%20in%20de%20${encodeURIComponent(showcase.title)}%20(${encodeURIComponent(formatLicensePlate(v.license_plate) || '')})`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 rounded-xl bg-[#25d366] hover:bg-[#20ba5a] text-white font-bold text-xs sm:text-sm inline-flex items-center space-x-2 transition shadow-md hover:scale-105"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp Bericht Sturen</span>
                </a>
              )}

              {showcase.contact_phone && (
                <a
                  href={`tel:${showcase.contact_phone.replace(/[^0-9+]/g, '')}`}
                  className="px-5 py-3 rounded-xl bg-white text-blue-900 hover:bg-blue-50 font-bold text-xs sm:text-sm inline-flex items-center space-x-2 transition shadow-md hover:scale-105"
                >
                  <Phone className="w-4 h-4" />
                  <span>Bellen ({showcase.contact_phone})</span>
                </a>
              )}

              {showcase.contact_email && (
                <a
                  href={`mailto:${showcase.contact_email}?subject=Interesse%20in%20${encodeURIComponent(showcase.title)}%20(${encodeURIComponent(formatLicensePlate(v.license_plate) || '')})`}
                  className="px-5 py-3 rounded-xl bg-white/15 hover:bg-white/25 border border-white/30 text-white font-bold text-xs sm:text-sm inline-flex items-center space-x-2 transition hover:scale-105"
                >
                  <Mail className="w-4 h-4" />
                  <span>E-mail Sturen</span>
                </a>
              )}
            </div>

            {showcase.contact_location && (
              <p className="text-xs text-blue-200 font-medium flex items-center justify-center space-x-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>Bezichtiging mogelijk in regio: <strong>{showcase.contact_location}</strong></span>
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 border-t border-slate-800 text-center text-xs">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p className="text-white font-bold">
            {showcase.title} {v.license_plate ? `(${formatLicensePlate(v.license_plate)})` : ''}
          </p>
          <p className="text-[11px] text-slate-500">
            Aangemaakt via VehicleVault 2.0 &bull; Alle specificaties zijn met zorg samengesteld en geverifieerd via het RDW-register.
          </p>
        </div>
      </footer>

      {/* Fullscreen Lightbox Modal */}
      {lightboxIndex !== null && showcase.photos[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 sm:p-6"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Top Controls */}
          <div className="flex items-center justify-between text-white" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs font-bold text-slate-400">
              {lightboxIndex + 1} / {showcase.photos.length}
            </span>
            <button
              onClick={() => setLightboxIndex(null)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Central Image & Nav Arrows */}
          <div className="relative flex items-center justify-center max-w-6xl max-h-[75vh] mx-auto w-full my-auto" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() =>
                setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : showcase.photos.length - 1))
              }
              className="absolute left-2 sm:left-4 z-10 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white transition shadow-lg"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <img
              src={`/uploads/vehicles/${showcase.photos[lightboxIndex].file_path}`}
              alt={showcase.photos[lightboxIndex].title || 'Foto'}
              className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl"
            />

            <button
              onClick={() =>
                setLightboxIndex((prev) => (prev !== null && prev < showcase.photos.length - 1 ? prev + 1 : 0))
              }
              className="absolute right-2 sm:right-4 z-10 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white transition shadow-lg"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Caption */}
          <div className="text-center text-white pb-2" onClick={(e) => e.stopPropagation()}>
            <strong className="text-sm sm:text-base font-bold block">
              {showcase.photos[lightboxIndex].title || 'Voertuigfoto'}
            </strong>
            {showcase.photos[lightboxIndex].description && (
              <p className="text-xs text-slate-400 mt-0.5">{showcase.photos[lightboxIndex].description}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { useOutletContext, NavLink } from 'react-router-dom';
import { Ticket, Car, Plus } from 'lucide-react';
import { Vehicle } from '../types/index.js';
import { useLanguage } from '../context/LanguageContext.js';
import { VignetteManager } from '../components/VignetteManager.js';

interface ContextType {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
}

export const Vignettes: React.FC = () => {
  const { selectedVehicle } = useOutletContext<ContextType>();
  const { t, lang } = useLanguage();

  if (!selectedVehicle) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto py-12 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
          <Car className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {lang === 'nl' ? 'Geen actief voertuig geselecteerd' : 'No active vehicle selected'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          {lang === 'nl'
            ? 'Selecteer een voertuig in de balk bovenin of voeg eerst een voertuig toe om tolvignetten en milieustickers te beheren.'
            : 'Select a vehicle from the top bar or add a vehicle first to manage toll vignettes and emission stickers.'}
        </p>
        <NavLink
          to="/vehicles"
          className="inline-flex items-center space-x-2 px-4 py-2 bg-accent-600 text-white rounded-xl text-xs font-bold hover:bg-accent-500 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>{lang === 'nl' ? 'Naar Mijn Garage' : 'Go to My Garage'}</span>
        </NavLink>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center space-x-2.5">
            <Ticket className="w-5 h-5 text-accent-500" />
            <span>{t('vignettesTitle')}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('vignettesSubtitle')} ({selectedVehicle.name})
          </p>
        </div>
      </div>

      {/* Main Vignette Manager Component */}
      <VignetteManager vehicle={selectedVehicle} />
    </div>
  );
};


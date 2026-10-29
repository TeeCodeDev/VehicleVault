import React from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Landmark, Car, LineChart, Info } from 'lucide-react';
import { Vehicle } from '../types/index.js';
import { RecurringExpensesCard } from '../components/RecurringExpensesCard.js';
import { useLanguage } from '../context/LanguageContext.js';

interface ContextType {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
}

export const FixedExpenses: React.FC = () => {
  const { selectedVehicle } = useOutletContext<ContextType>();
  const { lang } = useLanguage();

  if (!selectedVehicle) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md mx-auto my-12">
        <Car className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
          {lang === 'nl' ? 'Geen voertuig geselecteerd' : 'No vehicle selected'}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {lang === 'nl'
            ? 'Selecteer een voertuig in de balk bovenin om vaste lasten te bekijken of te beheren.'
            : 'Select a vehicle from the top selector to manage its recurring expenses.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center space-x-2">
            <Landmark className="w-5 h-5 text-accent-500" />
            <span>{lang === 'nl' ? 'Vaste Lasten & Periodieke Kosten' : 'Fixed Recurring Expenses'}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {lang === 'nl'
              ? `Beheer wegenbelasting (MRB), verzekeringen, abonnementen en lease voor ${selectedVehicle.name} (${selectedVehicle.license_plate || 'Geen kenteken'}).`
              : `Manage road tax, insurance, subscriptions, and lease for ${selectedVehicle.name}.`}
          </p>
        </div>

        <Link
          to="/analytics"
          className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition border border-slate-200 dark:border-slate-700 shadow-sm"
        >
          <LineChart className="w-4 h-4 text-accent-500" />
          <span>{lang === 'nl' ? 'Bekijk TCO Impact' : 'View TCO Impact'}</span>
        </Link>
      </div>

      {/* Information Banner */}
      <div className="p-4 rounded-2xl bg-accent-50 dark:bg-accent-100/10 border border-accent-200 dark:border-accent-500/20 flex items-start space-x-3 text-xs">
        <Info className="w-5 h-5 text-accent-600 dark:text-accent-400 shrink-0 mt-0.5" />
        <div className="text-slate-700 dark:text-slate-300 space-y-1">
          <p className="font-bold text-slate-900 dark:text-white">
            {lang === 'nl' ? 'Automatische koppeling met Total Cost of Ownership (TCO)' : 'Integrated with Total Cost of Ownership (TCO)'}
          </p>
          <p className="text-[11px] leading-relaxed">
            {lang === 'nl'
              ? 'Alle actieve vaste lasten worden automatisch genormaliseerd naar een maandbedrag en meegenomen in de totale kilometerkostprijs. Op de Rapporten & TCO pagina kun je deze posten naar wens met één klik in- of uitschakelen.'
              : 'All active recurring expenses are normalized monthly and factored into your cost per kilometer. You can toggle them on or off anytime in the Reports & TCO page.'}
          </p>
        </div>
      </div>

      {/* Main Recurring Expenses Card Component */}
      <RecurringExpensesCard vehicleId={selectedVehicle.id} />
    </div>
  );
};


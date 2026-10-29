import React, { useEffect, useState, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import {
  Landmark,
  Shield,
  LifeBuoy,
  Smartphone,
  FileText,
  Tag,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  X,
  AlertCircle,
  Coins,
  Search,
  CalendarClock,
  TrendingUp,
  LineChart,
  Car,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Vehicle, RecurringExpense } from '../types/index.js';
import { apiFetch } from '../api/client.js';
import { DatePicker } from '../components/DatePicker.js';
import { useLanguage } from '../context/LanguageContext.js';
import { formatDisplayDate } from '../utils/format.js';

interface ContextType {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
}

interface PresetOption {
  label: string;
  name: string;
  category: RecurringExpense['category'];
  frequency: RecurringExpense['frequency'];
  icon: string;
}

const PRESETS: PresetOption[] = [
  {
    label: 'MRB / Wegenbelasting',
    name: 'Motorrijtuigenbelasting (MRB)',
    category: 'tax',
    frequency: 'quarterly',
    icon: '🏛️',
  },
  {
    label: 'Autoverzekering',
    name: 'Autoverzekering (All-Risk / WA+)',
    category: 'insurance',
    frequency: 'monthly',
    icon: '🛡️',
  },
  {
    label: 'ANWB Pechhulp',
    name: 'ANWB Wegenwacht Europa',
    category: 'roadside',
    frequency: 'yearly',
    icon: '🛟',
  },
  {
    label: 'Flitsmeister PRO',
    name: 'Flitsmeister PRO Abonnement',
    category: 'subscription',
    frequency: 'yearly',
    icon: '📱',
  },
  {
    label: 'Private Lease',
    name: 'Private Lease Maandtermijn',
    category: 'lease',
    frequency: 'monthly',
    icon: '📝',
  },
];

export const FixedExpenses: React.FC = () => {
  const { selectedVehicle } = useOutletContext<ContextType>();
  const { lang, t } = useLanguage();

  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState<number>(0);
  const [yearlyTotal, setYearlyTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'paused'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState<RecurringExpense['category']>('tax');
  const [frequency, setFrequency] = useState<RecurringExpense['frequency']>('monthly');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');

  // Delete Confirmation Modal
  const [expenseToDelete, setExpenseToDelete] = useState<RecurringExpense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchExpenses = async () => {
    if (!selectedVehicle) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch<{
        expenses: RecurringExpense[];
        monthlyTotal: number;
        yearlyTotal: number;
      }>(`/api/expenses?vehicleId=${selectedVehicle.id}`);
      setExpenses(res.expenses || []);
      setMonthlyTotal(res.monthlyTotal || 0);
      setYearlyTotal(res.yearlyTotal || 0);
    } catch (err: any) {
      setError(err?.message || 'Kon vaste lasten niet ophalen');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [selectedVehicle?.id]);

  // Derived KPI metrics
  const activeExpenses = useMemo(() => expenses.filter((e) => Boolean(e.is_active)), [expenses]);
  const inactiveExpenses = useMemo(() => expenses.filter((e) => !Boolean(e.is_active)), [expenses]);

  const uniqueCategoriesCount = useMemo(() => {
    return new Set(activeExpenses.map((e) => e.category)).size;
  }, [activeExpenses]);

  const highestExpense = useMemo(() => {
    if (activeExpenses.length === 0) return null;
    let max = activeExpenses[0];
    let maxMonthly =
      max.frequency === 'monthly'
        ? max.amount
        : max.frequency === 'quarterly'
        ? max.amount / 3
        : max.amount / 12;

    for (let i = 1; i < activeExpenses.length; i++) {
      const exp = activeExpenses[i];
      const m =
        exp.frequency === 'monthly'
          ? exp.amount
          : exp.frequency === 'quarterly'
          ? exp.amount / 3
          : exp.amount / 12;
      if (m > maxMonthly) {
        max = exp;
        maxMonthly = m;
      }
    }
    return {
      name: max.name,
      monthly: maxMonthly,
      category: max.category,
    };
  }, [activeExpenses]);

  // Filtered List
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      // Category filter
      if (selectedCategory !== 'all' && exp.category !== selectedCategory) {
        return false;
      }
      // Status filter
      if (selectedStatus === 'active' && !exp.is_active) return false;
      if (selectedStatus === 'paused' && exp.is_active) return false;
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = exp.name.toLowerCase().includes(q);
        const matchesNotes = exp.notes ? exp.notes.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesNotes) return false;
      }
      return true;
    });
  }, [expenses, selectedCategory, selectedStatus, searchQuery]);

  const openCreateModal = (preset?: PresetOption) => {
    setEditingExpense(null);
    setName(preset ? preset.name : '');
    setCategory(preset ? preset.category : 'tax');
    setFrequency(preset ? preset.frequency : 'monthly');
    setAmount('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setIsActive(true);
    setNotes('');
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (exp: RecurringExpense) => {
    setEditingExpense(exp);
    setName(exp.name);
    setCategory(exp.category);
    setFrequency(exp.frequency);
    setAmount(exp.amount.toString());
    setStartDate(exp.start_date);
    setEndDate(exp.end_date || '');
    setIsActive(Boolean(exp.is_active));
    setNotes(exp.notes || '');
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleApplyPreset = (preset: PresetOption) => {
    setName(preset.name);
    setCategory(preset.category);
    setFrequency(preset.frequency);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;

    const amt = parseFloat(amount);
    if (!name.trim() || isNaN(amt) || amt <= 0 || !startDate) {
      setModalError(
        lang === 'nl'
          ? 'Naam, een geldig positief bedrag (> € 0) en begindatum zijn verplicht.'
          : 'Name, positive amount and start date are required.'
      );
      return;
    }

    try {
      setSaving(true);
      setModalError(null);

      const payload = {
        name: name.trim(),
        category,
        frequency,
        amount: amt,
        startDate,
        endDate: endDate ? endDate : null,
        isActive: isActive ? 1 : 0,
        notes: notes.trim(),
      };

      if (editingExpense) {
        await apiFetch(`/api/expenses/${editingExpense.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/expenses', {
          method: 'POST',
          body: JSON.stringify({
            vehicleId: selectedVehicle.id,
            ...payload,
          }),
        });
      }

      setIsModalOpen(false);
      await fetchExpenses();
    } catch (err: any) {
      setModalError(err?.message || 'Fout bij opslaan vaste last');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (exp: RecurringExpense) => {
    try {
      const nextActive = exp.is_active ? 0 : 1;
      await apiFetch(`/api/expenses/${exp.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: nextActive }),
      });
      await fetchExpenses();
    } catch (err: any) {
      alert(err?.message || 'Kon status niet bijwerken');
    }
  };

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    try {
      setDeleting(true);
      await apiFetch(`/api/expenses/${expenseToDelete.id}`, { method: 'DELETE' });
      setExpenseToDelete(null);
      await fetchExpenses();
    } catch (err: any) {
      alert(err?.message || 'Kon vaste last niet verwijderen');
    } finally {
      setDeleting(false);
    }
  };

  const getCategoryIcon = (cat: RecurringExpense['category']) => {
    switch (cat) {
      case 'tax':
        return <Landmark className="w-3.5 h-3.5 text-amber-500" />;
      case 'insurance':
        return <Shield className="w-3.5 h-3.5 text-sky-500" />;
      case 'roadside':
        return <LifeBuoy className="w-3.5 h-3.5 text-emerald-500" />;
      case 'subscription':
        return <Smartphone className="w-3.5 h-3.5 text-purple-500" />;
      case 'lease':
        return <FileText className="w-3.5 h-3.5 text-indigo-500" />;
      case 'inspection':
        return <Search className="w-3.5 h-3.5 text-teal-500" />;
      default:
        return <Tag className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const getCategoryBadgeClass = (cat: RecurringExpense['category']) => {
    switch (cat) {
      case 'tax':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800/50';
      case 'insurance':
        return 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 border-sky-200 dark:border-sky-800/50';
      case 'roadside':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50';
      case 'subscription':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200 dark:border-purple-800/50';
      case 'lease':
        return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50';
      case 'inspection':
        return 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400 border-teal-200 dark:border-teal-800/50';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getCategoryLabel = (cat: RecurringExpense['category']) => {
    switch (cat) {
      case 'tax':
        return 'Wegenbelasting (MRB)';
      case 'insurance':
        return 'Autoverzekering';
      case 'roadside':
        return 'Pechhulp';
      case 'subscription':
        return 'Abonnement';
      case 'lease':
        return 'Lease / Financiering';
      case 'inspection':
        return 'Keuring / APK';
      default:
        return 'Overig';
    }
  };

  // Real-time calculation helper inside Modal
  const modalCalculatedMonthly = useMemo(() => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return null;
    if (frequency === 'monthly') return val;
    if (frequency === 'quarterly') return val / 3;
    if (frequency === 'yearly') return val / 12;
    return val;
  }, [amount, frequency]);

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent-50 dark:bg-accent-100/10 text-accent-600 dark:text-accent-400 flex items-center justify-center shrink-0 border border-accent-200/60 dark:border-accent-500/20">
              <Landmark className="w-4 h-4" />
            </div>
            <span>{lang === 'nl' ? 'Vaste Lasten' : 'Fixed Recurring Expenses'}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'nl'
              ? `${selectedVehicle.name} (${selectedVehicle.license_plate || 'Geen kenteken'}) • Beheer wegenbelasting (MRB), verzekering, abonnementen en lease.`
              : `${selectedVehicle.name} • Manage recurring vehicle taxes, insurance policies, and subscriptions.`}
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <Link
            to="/analytics"
            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold inline-flex items-center space-x-2 transition border border-slate-200 dark:border-slate-700 shadow-sm"
            title="Bekijk de impact van vaste lasten op je kilometerkostprijs en TCO"
          >
            <LineChart className="w-4 h-4 text-accent-500" />
            <span>{lang === 'nl' ? 'Bekijk in TCO' : 'View in TCO'}</span>
          </Link>

          <button
            onClick={() => openCreateModal()}
            className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-2 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'nl' ? 'Vaste Last Toevoegen' : 'Add Fixed Expense'}</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Maandelijkse Vaste Lasten */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {lang === 'nl' ? 'Maandlasten' : 'Monthly Cost'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-accent-50 dark:bg-accent-100/10 text-accent-600 dark:text-accent-400 flex items-center justify-center">
              <CalendarClock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-mono">
            € {monthlyTotal.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/ mnd</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            € {yearlyTotal.toFixed(2)} {lang === 'nl' ? 'per jaar' : 'per year'}
          </div>
        </div>

        {/* KPI 2: Actieve Contracten */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {lang === 'nl' ? 'Actieve Posten' : 'Active Items'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {activeExpenses.length}{' '}
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              van {expenses.length}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {inactiveExpenses.length > 0
              ? `${inactiveExpenses.length} ${lang === 'nl' ? 'gepauzeerd' : 'paused'}`
              : lang === 'nl'
              ? 'Alle geregistreerde posten actief'
              : 'All registered items active'}
          </div>
        </div>

        {/* KPI 3: Grootste Kostenpost */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {lang === 'nl' ? 'Grootste Kostenpost' : 'Largest Expense'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-mono truncate">
            {highestExpense ? (
              <>
                € {highestExpense.monthly.toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/ mnd</span>
              </>
            ) : (
              '—'
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate">
            {highestExpense ? highestExpense.name : lang === 'nl' ? 'Geen actieve posten' : 'None'}
          </div>
        </div>

        {/* KPI 4: Categorieën */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {lang === 'nl' ? 'Categorieën' : 'Categories'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {uniqueCategoriesCount}{' '}
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              {lang === 'nl' ? 'actief' : 'active'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {lang === 'nl' ? 'MRB, verzekering, abonnementen' : 'Tax, insurance, subs'}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={lang === 'nl' ? 'Zoek op omschrijving of notitie...' : 'Search by description or notes...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline mr-1">
              Status:
            </span>
            <button
              onClick={() => setSelectedStatus('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                selectedStatus === 'all'
                  ? 'bg-accent-600 text-white shadow-sm font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {lang === 'nl' ? 'Alle' : 'All'}
            </button>
            <button
              onClick={() => setSelectedStatus('active')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                selectedStatus === 'active'
                  ? 'bg-accent-600 text-white shadow-sm font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {lang === 'nl' ? 'Actief' : 'Active'} ({activeExpenses.length})
            </button>
            <button
              onClick={() => setSelectedStatus('paused')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                selectedStatus === 'paused'
                  ? 'bg-accent-600 text-white shadow-sm font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {lang === 'nl' ? 'Gepauzeerd' : 'Paused'} ({inactiveExpenses.length})
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-thin pt-1 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {lang === 'nl' ? 'Alle Categorieën' : 'All Categories'} ({expenses.length})
          </button>
          <button
            onClick={() => setSelectedCategory('tax')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition flex items-center space-x-1 ${
              selectedCategory === 'tax'
                ? 'bg-amber-600 text-white font-bold'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>🏛️</span>
            <span>MRB / Belasting</span>
          </button>
          <button
            onClick={() => setSelectedCategory('insurance')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition flex items-center space-x-1 ${
              selectedCategory === 'insurance'
                ? 'bg-sky-600 text-white font-bold'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>🛡️</span>
            <span>Verzekering</span>
          </button>
          <button
            onClick={() => setSelectedCategory('roadside')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition flex items-center space-x-1 ${
              selectedCategory === 'roadside'
                ? 'bg-emerald-600 text-white font-bold'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>🛟</span>
            <span>Pechhulp</span>
          </button>
          <button
            onClick={() => setSelectedCategory('subscription')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition flex items-center space-x-1 ${
              selectedCategory === 'subscription'
                ? 'bg-purple-600 text-white font-bold'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>📱</span>
            <span>Abonnementen</span>
          </button>
          <button
            onClick={() => setSelectedCategory('lease')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition flex items-center space-x-1 ${
              selectedCategory === 'lease'
                ? 'bg-indigo-600 text-white font-bold'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>📝</span>
            <span>Lease &amp; Financiering</span>
          </button>
          <button
            onClick={() => setSelectedCategory('other')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition flex items-center space-x-1 ${
              selectedCategory === 'other'
                ? 'bg-slate-700 text-white font-bold'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>🏷️</span>
            <span>Overig</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-mono">
            {lang === 'nl' ? 'Vaste lasten laden...' : 'Loading recurring expenses...'}
          </p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : expenses.length === 0 ? (
        /* Full Page Empty State with Quick Presets */
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-8 md:p-12 text-center shadow-sm max-w-3xl mx-auto space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-accent-50 dark:bg-accent-100/10 text-accent-600 dark:text-accent-400 flex items-center justify-center mx-auto border border-accent-200 dark:border-accent-500/20 shadow-sm">
            <Coins className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              {lang === 'nl'
                ? 'Nog geen vaste lasten geregistreerd'
                : 'No recurring expenses configured'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {lang === 'nl'
                ? 'Voeg terugkerende kosten toe zoals motorrijtuigenbelasting (MRB), autoverzekering, pechhulp of abonnementen. Deze worden automatisch genormaliseerd en meegenomen in je Total Cost of Ownership (TCO).'
                : 'Add recurring costs like road tax (MRB), auto insurance, roadside assistance, or subscriptions to calculate your true Total Cost of Ownership.'}
            </p>
          </div>

          {/* Quick Preset Buttons */}
          <div className="pt-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-accent-500" />
              <span>{lang === 'nl' ? 'Snel toevoegen met standaardsjabloon' : 'Quick add with template'}</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => openCreateModal(p)}
                  className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center space-x-2 transition shadow-sm hover:scale-[1.02]"
                >
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => openCreateModal()}
              className="px-5 py-2.5 bg-accent-600 hover:bg-accent-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-2 shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'nl' ? 'Aangepaste Vaste Last Toevoegen' : 'Add Custom Expense'}</span>
            </button>
          </div>
        </div>
      ) : filteredExpenses.length === 0 ? (
        /* Filter Empty State */
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-10 text-center shadow-sm">
          <Search className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {lang === 'nl' ? 'Geen resultaten gevonden' : 'No results found'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'nl'
              ? 'Er zijn geen vaste lasten die voldoen aan je huidige zoekopdracht en filters.'
              : 'No recurring expenses match your current filters.'}
          </p>
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSelectedStatus('all');
              setSearchQuery('');
            }}
            className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition"
          >
            {lang === 'nl' ? 'Filters wissen' : 'Clear filters'}
          </button>
        </div>
      ) : (
        /* Full Data Table */
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                  <th className="py-3 px-4">{lang === 'nl' ? 'Omschrijving' : 'Description'}</th>
                  <th className="py-3 px-3">{lang === 'nl' ? 'Categorie' : 'Category'}</th>
                  <th className="py-3 px-3">{lang === 'nl' ? 'Frequentie' : 'Frequency'}</th>
                  <th className="py-3 px-3 text-right">{lang === 'nl' ? 'Bruto Bedrag' : 'Amount'}</th>
                  <th className="py-3 px-3 text-right">{lang === 'nl' ? 'Per Maand' : 'Per Month'}</th>
                  <th className="py-3 px-3">{lang === 'nl' ? 'Looptijd' : 'Duration'}</th>
                  <th className="py-3 px-3 text-center">{lang === 'nl' ? 'Status' : 'Status'}</th>
                  <th className="py-3 px-4 text-center">{lang === 'nl' ? 'Acties' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredExpenses.map((exp) => {
                  const normMonthly =
                    exp.frequency === 'monthly'
                      ? exp.amount
                      : exp.frequency === 'quarterly'
                      ? exp.amount / 3
                      : exp.amount / 12;

                  return (
                    <tr
                      key={exp.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition ${
                        !exp.is_active ? 'opacity-60 bg-slate-50/30 dark:bg-slate-950/20' : ''
                      }`}
                    >
                      {/* Name & Notes */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white text-xs">
                          {exp.name}
                        </div>
                        {exp.notes && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                            {exp.notes}
                          </div>
                        )}
                      </td>

                      {/* Category Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${getCategoryBadgeClass(
                            exp.category
                          )}`}
                        >
                          {getCategoryIcon(exp.category)}
                          <span>{getCategoryLabel(exp.category)}</span>
                        </span>
                      </td>

                      {/* Frequency */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
                        {exp.frequency === 'monthly'
                          ? lang === 'nl'
                            ? 'Maandelijks (1 mnd)'
                            : 'Monthly'
                          : exp.frequency === 'quarterly'
                          ? lang === 'nl'
                            ? 'Per kwartaal (3 mnd)'
                            : 'Quarterly'
                          : lang === 'nl'
                          ? 'Jaarlijks (12 mnd)'
                          : 'Yearly'}
                      </td>

                      {/* Gross Amount */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        € {exp.amount.toFixed(2)}
                      </td>

                      {/* Normalized Monthly */}
                      <td className="py-3 px-3 text-right font-mono font-black text-accent-600 dark:text-accent-400 whitespace-nowrap">
                        € {normMonthly.toFixed(2)}{' '}
                        <span className="text-[10px] font-normal text-slate-400">/ mnd</span>
                      </td>

                      {/* Duration / Dates */}
                      <td className="py-3 px-3 text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <div>
                          <span className="text-slate-400 font-normal">
                            {lang === 'nl' ? 'Sinds' : 'From'}:{' '}
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {formatDisplayDate(exp.start_date)}
                          </span>
                        </div>
                        {exp.end_date ? (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Tot: {formatDisplayDate(exp.end_date)}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {lang === 'nl' ? 'Doorlopend' : 'Ongoing'}
                          </div>
                        )}
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleToggleActive(exp)}
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition shadow-sm ${
                            exp.is_active
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                          }`}
                          title={
                            exp.is_active
                              ? lang === 'nl'
                                ? 'Klik om deze vaste last te pauzeren'
                                : 'Click to pause this expense'
                              : lang === 'nl'
                              ? 'Klik om deze vaste last te activeren'
                              : 'Click to activate this expense'
                          }
                        >
                          {exp.is_active ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>
                            {exp.is_active
                              ? lang === 'nl'
                                ? 'Actief'
                                : 'Active'
                              : lang === 'nl'
                              ? 'Gepauzeerd'
                              : 'Paused'}
                          </span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            onClick={() => openEditModal(exp)}
                            className="p-1.5 text-slate-400 hover:text-accent-600 dark:hover:text-accent-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                            title={lang === 'nl' ? 'Bewerken' : 'Edit'}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setExpenseToDelete(exp)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                            title={lang === 'nl' ? 'Verwijderen' : 'Delete'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer info */}
          <div className="p-3 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
            <div>
              {lang === 'nl' ? 'Totaal zichtbaar:' : 'Showing:'}{' '}
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {filteredExpenses.length}
              </span>{' '}
              {lang === 'nl' ? 'posten' : 'items'}
            </div>
            <div className="flex items-center space-x-3">
              <span>
                {lang === 'nl' ? 'Actieve TCO maandlasten:' : 'Active monthly TCO impact:'}{' '}
                <span className="font-mono font-bold text-accent-600 dark:text-accent-400">
                  € {monthlyTotal.toFixed(2)}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <div className="w-6 h-6 rounded-lg bg-accent-50 dark:bg-accent-100/10 text-accent-600 dark:text-accent-400 flex items-center justify-center">
                  <Landmark className="w-3.5 h-3.5" />
                </div>
                <span>
                  {editingExpense
                    ? lang === 'nl'
                      ? 'Vaste Last Bewerken'
                      : 'Edit Recurring Expense'
                    : lang === 'nl'
                    ? 'Nieuwe Vaste Last Toevoegen'
                    : 'Add Recurring Expense'}
                </span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Preset Selector for New Expense */}
            {!editingExpense && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 text-accent-500" />
                  <span>{lang === 'nl' ? 'Snelkiezer / Vooringestelde sjablonen' : 'Quick templates'}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className="px-2.5 py-1 bg-white dark:bg-slate-700 hover:bg-accent-50 hover:text-accent-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-lg text-[11px] font-medium transition"
                    >
                      {p.icon} {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveExpense} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'nl' ? 'Omschrijving van de vaste last *' : 'Description *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    lang === 'nl'
                      ? 'bijv. Motorrijtuigenbelasting (MRB) of Univé All-Risk'
                      : 'e.g. Road tax or Auto Insurance'
                  }
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'nl' ? 'Categorie' : 'Category'}
                  </label>
                  <select
                    value={category}
                    onChange={(e: any) => setCategory(e.target.value)}
                    className="w-full font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                  >
                    <option value="tax">🏛️ Wegenbelasting (MRB)</option>
                    <option value="insurance">🛡️ Autoverzekering</option>
                    <option value="roadside">🛟 Pechhulp / ANWB</option>
                    <option value="subscription">📱 Abonnement / App</option>
                    <option value="lease">📝 Lease / Financiering</option>
                    <option value="inspection">🔍 Keuring / APK</option>
                    <option value="other">🏷️ Overig</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'nl' ? 'Frequentie' : 'Frequency'}
                  </label>
                  <select
                    value={frequency}
                    onChange={(e: any) => setFrequency(e.target.value)}
                    className="w-full font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                  >
                    <option value="monthly">{lang === 'nl' ? 'Maandelijks (1 mnd)' : 'Monthly'}</option>
                    <option value="quarterly">
                      {lang === 'nl' ? 'Per kwartaal (3 mnd)' : 'Quarterly'}
                    </option>
                    <option value="yearly">{lang === 'nl' ? 'Jaarlijks (12 mnd)' : 'Yearly'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'nl' ? 'Bedrag (€) *' : 'Amount (€) *'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="bijv. 65.50"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                />

                {/* Normalized preview */}
                {modalCalculatedMonthly !== null && (
                  <p className="text-[11px] text-accent-600 dark:text-accent-400 font-mono mt-1 font-semibold flex items-center space-x-1">
                    <span>💡</span>
                    <span>
                      {lang === 'nl'
                        ? `Dit komt neer op € ${modalCalculatedMonthly.toFixed(2)} per maand in de TCO.`
                        : `Normalized: € ${modalCalculatedMonthly.toFixed(2)} / month.`}
                    </span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'nl' ? 'Ingangsdatum *' : 'Start Date *'}
                  </label>
                  <DatePicker value={startDate} onChange={setStartDate} required />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">
                      {lang === 'nl' ? 'Einddatum (optioneel)' : 'End Date (optional)'}
                    </label>
                    {endDate && (
                      <button
                        type="button"
                        onClick={() => setEndDate('')}
                        className="text-[10px] text-slate-400 hover:text-rose-500"
                      >
                        {lang === 'nl' ? 'Wissen' : 'Clear'}
                      </button>
                    )}
                  </div>
                  <DatePicker
                    value={endDate}
                    onChange={setEndDate}
                    placeholder={lang === 'nl' ? 'Geen einddatum (doorlopend)' : 'Ongoing'}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'nl'
                    ? 'Notities / Polisnummer / Betalingskenmerk'
                    : 'Notes / Policy Number / Reference'}
                </label>
                <textarea
                  rows={2}
                  placeholder={
                    lang === 'nl'
                      ? 'bijv. Polisnummer POL-92812 bij Univé, no-claim korting 75%'
                      : 'Optional policy reference, insurance details or notes'
                  }
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="activeExpenseCheckbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-accent-600 focus:ring-accent-500 cursor-pointer"
                />
                <label
                  htmlFor="activeExpenseCheckbox"
                  className="font-bold text-slate-800 dark:text-slate-200 cursor-pointer text-xs"
                >
                  {lang === 'nl'
                    ? 'Deze vaste last is momenteel actief en meenemen in TCO'
                    : 'This recurring expense is currently active'}
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 font-bold bg-accent-600 hover:bg-accent-700 text-white rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {saving
                    ? t('saving')
                    : editingExpense
                    ? lang === 'nl'
                      ? 'Wijzigingen Opslaan'
                      : 'Save Changes'
                    : lang === 'nl'
                    ? 'Vaste Last Opslaan'
                    : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {lang === 'nl' ? 'Vaste last verwijderen?' : 'Delete recurring expense?'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'nl'
                  ? `Weet je zeker dat je "${expenseToDelete.name}" wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`
                  : `Are you sure you want to delete "${expenseToDelete.name}"? This cannot be undone.`}
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="w-1/2 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDeleteExpense}
                className="w-1/2 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm transition disabled:opacity-50"
              >
                {deleting ? t('saving') : lang === 'nl' ? 'Verwijderen' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

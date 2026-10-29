import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { RecurringExpense } from '../types/index.js';
import { apiFetch } from '../api/client.js';
import { DatePicker } from './DatePicker.js';

interface RecurringExpensesCardProps {
  vehicleId: string;
  onExpenseChange?: () => void;
}

export const RecurringExpensesCard: React.FC<RecurringExpensesCardProps> = ({
  vehicleId,
  onExpenseChange,
}) => {
  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState<number>(0);
  const [yearlyTotal, setYearlyTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch<{
        expenses: RecurringExpense[];
        monthlyTotal: number;
        yearlyTotal: number;
      }>(`/api/expenses?vehicleId=${vehicleId}`);
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
  }, [vehicleId]);

  const openCreateModal = () => {
    setEditingExpense(null);
    setName('');
    setCategory('tax');
    setFrequency('monthly');
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

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!name.trim() || isNaN(amt) || amt <= 0 || !startDate) {
      setModalError('Naam, geldig bedrag (> 0) en begindatum zijn verplicht.');
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
            vehicleId,
            ...payload,
          }),
        });
      }

      setIsModalOpen(false);
      await fetchExpenses();
      if (onExpenseChange) onExpenseChange();
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
      if (onExpenseChange) onExpenseChange();
    } catch (err: any) {
      alert(err?.message || 'Kon status niet bijwerken');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm('Weet je zeker dat je deze vaste last wilt verwijderen?')) return;
    try {
      await apiFetch(`/api/expenses/${id}`, { method: 'DELETE' });
      await fetchExpenses();
      if (onExpenseChange) onExpenseChange();
    } catch (err: any) {
      alert(err?.message || 'Kon vaste last niet verwijderen');
    }
  };

  const getCategoryIcon = (cat: RecurringExpense['category']) => {
    switch (cat) {
      case 'tax':
        return <Landmark className="w-3.5 h-3.5 text-indigo-500" />;
      case 'insurance':
        return <Shield className="w-3.5 h-3.5 text-sky-500" />;
      case 'roadside':
        return <LifeBuoy className="w-3.5 h-3.5 text-amber-500" />;
      case 'subscription':
        return <Smartphone className="w-3.5 h-3.5 text-emerald-500" />;
      case 'lease':
        return <FileText className="w-3.5 h-3.5 text-purple-500" />;
      default:
        return <Tag className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const getCategoryLabel = (cat: RecurringExpense['category']) => {
    switch (cat) {
      case 'tax':
        return 'Wegenbelasting (MRB)';
      case 'insurance':
        return 'Verzekering';
      case 'roadside':
        return 'Pechhulp (ANWB)';
      case 'subscription':
        return 'Abonnement / App';
      case 'lease':
        return 'Lease / Financiering';
      case 'inspection':
        return 'Keuring / APK';
      default:
        return 'Overig';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
            <Landmark className="w-4 h-4 text-indigo-500" />
            <span>Vaste Lasten &amp; Wegenbelasting</span>
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Terugkerende kostenposten zoals motorrijtuigenbelasting (MRB), autoverzekering en pechhulp.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <div className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-right">
            <div className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">Vaste Kosten</div>
            <div className="text-xs font-black font-mono text-indigo-950 dark:text-indigo-200">
              € {monthlyTotal.toFixed(2)} <span className="text-[10px] font-normal text-slate-500">/ mnd</span>
              <span className="text-[10px] text-slate-400 font-normal ml-1">
                (€ {yearlyTotal.toFixed(2)}/jr)
              </span>
            </div>
          </div>

          <button
            onClick={openCreateModal}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Vaste Last Toevoegen</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-4 text-center text-xs text-slate-500 font-mono">Vaste lasten laden...</div>
      ) : error ? (
        <div className="p-4 text-center text-xs text-rose-500">{error}</div>
      ) : expenses.length === 0 ? (
        <div className="p-6 text-center bg-slate-50/50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
          <Coins className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-1.5" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Geen vaste lasten geconfigureerd</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Voeg je motorrijtuigenbelasting of verzekering toe om een 100% kloppende TCO te berekenen.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="py-2 px-3">Omschrijving</th>
                <th className="py-2 px-3">Categorie</th>
                <th className="py-2 px-3">Frequentie</th>
                <th className="py-2 px-3 text-right">Bedrag</th>
                <th className="py-2 px-3 text-right">Per maand</th>
                <th className="py-2 px-3 text-center">Actief</th>
                <th className="py-2 px-3 text-center">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {expenses.map((exp) => {
                const normMonthly =
                  exp.frequency === 'monthly'
                    ? exp.amount
                    : exp.frequency === 'quarterly'
                    ? exp.amount / 3
                    : exp.amount / 12;

                return (
                  <tr
                    key={exp.id}
                    className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition ${
                      !exp.is_active ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      <div>{exp.name}</div>
                      {exp.notes && <div className="text-[10px] text-slate-400 font-normal">{exp.notes}</div>}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {getCategoryIcon(exp.category)}
                        <span>{getCategoryLabel(exp.category)}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 capitalize">
                      {exp.frequency === 'monthly'
                        ? 'Maandelijks'
                        : exp.frequency === 'quarterly'
                        ? 'Per kwartaal'
                        : 'Jaarlijks'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                      € {exp.amount.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      € {normMonthly.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => handleToggleActive(exp)}
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition ${
                          exp.is_active
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {exp.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        <span>{exp.is_active ? 'Actief' : 'Gepauzeerd'}</span>
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="inline-flex items-center space-x-1">
                        <button
                          onClick={() => openEditModal(exp)}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Landmark className="w-4 h-4 text-indigo-500" />
                <span>{editingExpense ? 'Vaste Last Bewerken' : 'Nieuwe Vaste Last Toevoegen'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveExpense} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Omschrijving</label>
                <input
                  type="text"
                  required
                  placeholder="bijv. Motorrijtuigenbelasting (MRB) of Univé All-Risk"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Categorie</label>
                  <select
                    value={category}
                    onChange={(e: any) => setCategory(e.target.value)}
                    className="w-full font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="tax">🏛️ Wegenbelasting (MRB)</option>
                    <option value="insurance">🛡️ Verzekering</option>
                    <option value="roadside">🛟 Pechhulp / ANWB</option>
                    <option value="subscription">📱 Abonnement / App</option>
                    <option value="lease">📝 Lease / Financiering</option>
                    <option value="inspection">🔍 Keuring / APK</option>
                    <option value="other">🏷️ Overig</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Frequentie</label>
                  <select
                    value={frequency}
                    onChange={(e: any) => setFrequency(e.target.value)}
                    className="w-full font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="monthly">Maandelijks</option>
                    <option value="quarterly">Per kwartaal</option>
                    <option value="yearly">Jaarlijks</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Bedrag (€)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="bijv. 65.50"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Ingangsdatum</label>
                <DatePicker value={startDate} onChange={setStartDate} />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="activeExpenseCheckbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="activeExpenseCheckbox" className="font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  Deze vaste last is momenteel actief
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {saving ? 'Opslaan...' : 'Vaste Last Opslaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

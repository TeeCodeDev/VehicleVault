import React, { useMemo, useState, useEffect } from 'react';
import { GitCompareArrows, TrendingDown, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { useLanguage } from '../../context/LanguageContext.js';

interface MonthlyRow {
  month: string;
  fuel?: number;
  regularMaintenance?: number;
  unscheduledRepairs?: number;
  fixedExpenses?: number;
  total: number;
}

interface PeriodComparisonCardProps {
  monthlyBreakdown: MonthlyRow[];
}

const MONTH_LABELS: Record<'nl' | 'en' | 'de', string[]> = {
  nl: ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
};

export const PeriodComparisonCard: React.FC<PeriodComparisonCardProps> = ({ monthlyBreakdown }) => {
  const { t, lang } = useLanguage();

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    for (const row of monthlyBreakdown || []) {
      if (row.month && row.month.length >= 4) {
        years.add(row.month.slice(0, 4));
      }
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [monthlyBreakdown]);

  const [yearA, setYearA] = useState<string>('');
  const [yearB, setYearB] = useState<string>('');

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(yearA)) {
      setYearA(availableYears[0]);
    }
    if (availableYears.length > 1 && (!yearB || !availableYears.includes(yearB))) {
      setYearB(availableYears[1]);
    } else if (availableYears.length <= 1) {
      setYearB('');
    }
  }, [availableYears, yearA, yearB]);

  if (!monthlyBreakdown || monthlyBreakdown.length === 0 || availableYears.length === 0) {
    return null;
  }

  const labels = MONTH_LABELS[lang === 'de' ? 'de' : lang === 'en' ? 'en' : 'nl'];
  const byMonthKey = new Map<string, number>();
  for (const row of monthlyBreakdown) {
    byMonthKey.set(row.month, Number(row.total || 0));
  }

  const chartData = labels.map((label, idx) => {
    const mm = String(idx + 1).padStart(2, '0');
    const valA = yearA ? byMonthKey.get(`${yearA}-${mm}`) || 0 : 0;
    const valB = yearB ? byMonthKey.get(`${yearB}-${mm}`) || 0 : 0;
    return {
      month: label,
      [yearA || 'A']: Number(valA.toFixed(2)),
      ...(yearB ? { [yearB]: Number(valB.toFixed(2)) } : {}),
    };
  });

  const totalYearA = yearA
    ? monthlyBreakdown
        .filter((m) => m.month.startsWith(`${yearA}-`))
        .reduce((sum, m) => sum + Number(m.total || 0), 0)
    : 0;
  const totalYearB = yearB
    ? monthlyBreakdown
        .filter((m) => m.month.startsWith(`${yearB}-`))
        .reduce((sum, m) => sum + Number(m.total || 0), 0)
    : 0;

  const sortedMonths = [...monthlyBreakdown].sort((a, b) => a.month.localeCompare(b.month));
  const latestMonth = sortedMonths[sortedMonths.length - 1];
  const prevMonth = sortedMonths.length > 1 ? sortedMonths[sortedMonths.length - 2] : null;

  const diffAmount = yearB ? totalYearA - totalYearB : prevMonth ? latestMonth.total - prevMonth.total : 0;
  const baseAmount = yearB ? totalYearB : prevMonth ? prevMonth.total : 0;
  const diffPct = baseAmount > 0 ? (diffAmount / baseAmount) * 100 : null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
            <GitCompareArrows className="w-4 h-4 text-sky-500" />
            <span>{t('periodComparisonTitle')}</span>
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {t('periodComparisonSubtitle')}
          </p>
        </div>

        {availableYears.length > 1 && (
          <div className="flex items-center space-x-2 text-xs">
            <select
              value={yearA}
              onChange={(e) => setYearA(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold text-slate-800 dark:text-slate-200"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <span className="text-slate-400 font-semibold">vs.</span>
            <select
              value={yearB}
              onChange={(e) => setYearB(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold text-slate-800 dark:text-slate-200"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Summary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">
            {yearB ? yearA : latestMonth?.month}
          </span>
          <span className="text-base font-black font-mono text-slate-900 dark:text-white mt-0.5 block">
            € {(yearB ? totalYearA : latestMonth?.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">
            {yearB ? yearB : prevMonth ? prevMonth.month : t('previousMonthLabel')}
          </span>
          <span className="text-base font-black font-mono text-slate-700 dark:text-slate-300 mt-0.5 block">
            € {(yearB ? totalYearB : prevMonth?.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">
            {t('periodDeltaLabel')}
          </span>
          <div className="flex items-center space-x-1.5 mt-0.5">
            {diffAmount <= 0 ? (
              <TrendingDown className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <TrendingUp className="w-4 h-4 text-rose-500 shrink-0" />
            )}
            <span
              className={`text-base font-black font-mono ${
                diffAmount <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {diffAmount > 0 ? '+' : ''}€ {diffAmount.toFixed(2)}
              {diffPct !== null && (
                <span className="text-[11px] font-semibold ml-1">
                  ({diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%)
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Grouped Bar Chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.15} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
            <Tooltip
              formatter={(value: any) => [`€ ${Number(value || 0).toFixed(2)}`, '']}
              contentStyle={{ fontSize: '12px', borderRadius: '10px' }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            {yearA && <Bar dataKey={yearA} fill="#0284c7" radius={[4, 4, 0, 0]} />}
            {yearB && <Bar dataKey={yearB} fill="#94a3b8" radius={[4, 4, 0, 0]} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

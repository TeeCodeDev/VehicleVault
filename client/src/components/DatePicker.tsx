import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.js';

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
}

const MONTH_NAMES = {
  nl: [
    'januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december'
  ],
  en: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ],
};

const WEEKDAYS = {
  nl: ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'],
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
};

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder,
  label,
  required = false,
}) => {
  const { lang, t } = useLanguage();
  const defaultPlaceholder = lang === 'nl' ? 'Selecteer datum...' : 'Select date...';
  const effectivePlaceholder = placeholder || defaultPlaceholder;

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize view year & month from value or today
  const initialDate = value ? new Date(value) : new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear() || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(
    !isNaN(initialDate.getMonth()) ? initialDate.getMonth() : new Date().getMonth()
  );

  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    onChange(`${viewYear}-${mm}-${dd}`);
    setIsOpen(false);
  };

  const handleQuickSelect = (offsetDays: number) => {
    const target = new Date();
    target.setDate(target.getDate() + offsetDays);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    onChange(`${yyyy}-${mm}-${dd}`);
    setIsOpen(false);
  };

  // Generate calendar grid
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  const startDay = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const monthList = MONTH_NAMES[lang] || MONTH_NAMES.nl;
  const weekdayList = WEEKDAYS[lang] || WEEKDAYS.nl;

  // Format display string
  const formatDisplay = (iso: string) => {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[2], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      const year = parts[0];
      return `${day} ${monthList[monthIdx] || ''} ${year}`;
    }
    return iso;
  };

  const todayIso = new Date().toISOString().split('T')[0];

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1 text-xs">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 flex items-center justify-between cursor-pointer transition shadow-sm"
      >
        <div className="flex items-center space-x-2 truncate">
          <CalendarIcon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
          <span className={value ? 'font-medium' : 'text-slate-400 dark:text-slate-600'}>
            {value ? formatDisplay(value) : effectivePlaceholder}
          </span>
        </div>

        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
            title={lang === 'nl' ? 'Wissen' : 'Clear'}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl p-3 text-xs animate-in fade-in-50 zoom-in-95">
          {/* Header navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={lang === 'nl' ? 'Vorige maand' : 'Previous month'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="font-semibold text-slate-800 dark:text-slate-100 capitalize">
              {monthList[viewMonth]} {viewYear}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={lang === 'nl' ? 'Volgende maand' : 'Next month'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center font-medium text-slate-400 dark:text-slate-500 text-[11px] mb-1">
            {weekdayList.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {Array.from({ length: startDay }).map((_, idx) => (
              <span key={`empty-${idx}`} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const currentIso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = value === currentIso;
              const isToday = todayIso === currentIso;

              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => handleSelectDay(day)}
                  className={`h-7 w-7 mx-auto rounded flex items-center justify-center text-xs transition font-medium ${
                    isSelected
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 font-bold shadow-sm'
                      : isToday
                      ? 'border border-sky-500 text-sky-600 dark:text-sky-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Quick selectors footer */}
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2 mt-2 text-[10px]">
            <button
              type="button"
              onClick={() => handleQuickSelect(0)}
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium hover:underline"
            >
              {t('today')}
            </button>
            <button
              type="button"
              onClick={() => handleQuickSelect(-1)}
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium hover:underline"
            >
              {t('yesterday')}
            </button>
            <button
              type="button"
              onClick={() => handleQuickSelect(-7)}
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium hover:underline"
            >
              {lang === 'nl' ? '-7 dagen' : '-7 days'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { formatLicensePlate } from '../utils/licensePlate.js';
import { useLanguage } from '../context/LanguageContext.js';

interface LicensePlateBadgeProps {
  plate?: string | null;
  country?: 'NL' | 'BE' | 'DE' | 'EU' | 'OTHER' | string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showCopy?: boolean;
  className?: string;
}

export const LicensePlateBadge: React.FC<LicensePlateBadgeProps> = ({
  plate,
  country = 'NL',
  size = 'sm',
  showCopy = false,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);
  let lang = 'nl';
  try {
    const langContext = useLanguage();
    if (langContext?.lang) lang = langContext.lang;
  } catch {
    lang = localStorage.getItem('vv_lang') || 'nl';
  }

  if (!plate) return null;
  const c = (country || 'NL').toUpperCase();
  const formatted = formatLicensePlate(plate, c);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(formatted).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Typography & padding styles per size
  const sizeStyles = {
    xs: {
      container: 'text-[9px]',
      platePad: 'px-1.5 py-0.5',
      flagPad: 'px-1 py-0.2 mr-1',
      flagText: 'text-[7px]',
      btnPad: 'px-2 py-0.5 text-[10px]',
      iconSize: 'w-3 h-3',
    },
    sm: {
      container: 'text-[11px]',
      platePad: 'px-2 py-0.5',
      flagPad: 'px-1 py-0.2 mr-1.5',
      flagText: 'text-[8px]',
      btnPad: 'px-2.5 py-0.5 text-xs',
      iconSize: 'w-3.5 h-3.5',
    },
    md: {
      container: 'text-xs sm:text-sm',
      platePad: 'px-2.5 py-0.5',
      flagPad: 'px-1.5 py-0.5 mr-1.5',
      flagText: 'text-[9px]',
      btnPad: 'px-3 py-1 text-xs',
      iconSize: 'w-3.5 h-3.5',
    },
    lg: {
      container: 'text-sm sm:text-base',
      platePad: 'px-3 py-1 sm:py-1.5',
      flagPad: 'px-1.5 py-0.5 mr-2',
      flagText: 'text-[9px] sm:text-[10px]',
      btnPad: 'px-3.5 py-1 sm:py-1.5 text-xs sm:text-sm',
      iconSize: 'w-4 h-4',
    },
  }[size];

  // Country-specific styling:
  // NL: Iconic yellow plate (#f5c518) with black text, blue band with NL
  // BE: Clean white plate with Belgian ruby red text (#9a0026), blue band with B
  // DE: Clean white plate with black DIN font, blue band with D
  // EU / OTHER: Crisp neutral white plate with dark slate text, blue EU band
  let plateBg = 'bg-[#f5c518] text-slate-950';
  let plateBorder = 'border-amber-500/80';
  let copyBorder = 'border-amber-500';
  let flagCode = 'NL';

  if (c === 'BE') {
    plateBg = 'bg-white text-[#9a0026]';
    plateBorder = 'border-[#9a0026]/40 dark:border-[#9a0026]/70 shadow-2xs';
    copyBorder = 'border-[#9a0026]/50';
    flagCode = 'B';
  } else if (c === 'DE') {
    plateBg = 'bg-white text-slate-950';
    plateBorder = 'border-slate-300 dark:border-slate-600 shadow-2xs';
    copyBorder = 'border-slate-400 dark:border-slate-600';
    flagCode = 'D';
  } else if (c === 'EU' || c === 'OTHER') {
    plateBg = 'bg-white text-slate-900 dark:bg-slate-100 dark:text-slate-950';
    plateBorder = 'border-slate-300 dark:border-slate-600 shadow-2xs';
    copyBorder = 'border-slate-300 dark:border-slate-600';
    flagCode = 'EU';
  }

  if (showCopy) {
    return (
      <div
        className={`inline-flex items-stretch rounded-md border ${copyBorder} shadow-xs overflow-hidden ${className}`}
      >
        <div
          className={`inline-flex items-center font-black font-mono tracking-wider ${plateBg} ${sizeStyles.container} ${sizeStyles.platePad}`}
        >
          <span
            className={`bg-[#003399] text-white font-sans font-bold rounded-2xs leading-none select-none ${sizeStyles.flagText} ${sizeStyles.flagPad}`}
          >
            {flagCode}
          </span>
          <span>{formatted}</span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className={`inline-flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-bold border-l border-slate-300 dark:border-slate-700 transition select-none ${sizeStyles.btnPad}`}
          title={lang === 'nl' ? 'Kopieer kenteken' : 'Copy license plate'}
        >
          {copied ? (
            <>
              <Check className={`${sizeStyles.iconSize} text-emerald-600 dark:text-emerald-400`} />
              <span>{lang === 'nl' ? 'Gekopieerd!' : 'Copied!'}</span>
            </>
          ) : (
            <>
              <Copy className={sizeStyles.iconSize} />
              <span>{lang === 'nl' ? 'Kopieer' : 'Copy'}</span>
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center font-black font-mono tracking-wider rounded border ${plateBorder} ${plateBg} ${sizeStyles.container} ${sizeStyles.platePad} ${className}`}
    >
      <span
        className={`bg-[#003399] text-white font-sans font-bold rounded-2xs leading-none select-none ${sizeStyles.flagText} ${sizeStyles.flagPad}`}
      >
        {flagCode}
      </span>
      <span>{formatted}</span>
    </span>
  );
};

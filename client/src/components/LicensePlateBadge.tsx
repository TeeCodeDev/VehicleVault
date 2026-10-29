import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { formatLicensePlate } from '../utils/licensePlate.js';

interface LicensePlateBadgeProps {
  plate?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showCopy?: boolean;
  className?: string;
}

export const LicensePlateBadge: React.FC<LicensePlateBadgeProps> = ({
  plate,
  size = 'sm',
  showCopy = false,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  if (!plate) return null;
  const formatted = formatLicensePlate(plate);

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

  if (showCopy) {
    return (
      <div
        className={`inline-flex items-stretch rounded-md border border-amber-500 shadow-xs overflow-hidden ${className}`}
      >
        <div
          className={`inline-flex items-center bg-[#f5c518] text-slate-950 font-black font-mono tracking-wider ${sizeStyles.container} ${sizeStyles.platePad}`}
        >
          <span
            className={`bg-[#003399] text-white font-sans font-bold rounded-2xs leading-none select-none ${sizeStyles.flagText} ${sizeStyles.flagPad}`}
          >
            NL
          </span>
          <span>{formatted}</span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className={`inline-flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-bold border-l border-amber-500/40 transition select-none ${sizeStyles.btnPad}`}
          title="Kopieer kenteken"
        >
          {copied ? (
            <>
              <Check className={`${sizeStyles.iconSize} text-emerald-600 dark:text-emerald-400`} />
              <span>Gekopieerd!</span>
            </>
          ) : (
            <>
              <Copy className={sizeStyles.iconSize} />
              <span>Kopieer</span>
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center bg-[#f5c518] text-slate-950 font-black font-mono tracking-wider rounded border border-amber-500/80 shadow-2xs ${sizeStyles.container} ${sizeStyles.platePad} ${className}`}
    >
      <span
        className={`bg-[#003399] text-white font-sans font-bold rounded-2xs leading-none select-none ${sizeStyles.flagText} ${sizeStyles.flagPad}`}
      >
        NL
      </span>
      <span>{formatted}</span>
    </span>
  );
};


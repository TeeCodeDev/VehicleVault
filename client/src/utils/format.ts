/**
 * Format an ISO date string (YYYY-MM-DD or full ISO timestamp) to Dutch display format (DD-MM-YYYY).
 * Returns fallback (default '—') if null/undefined/empty.
 */
export function formatDisplayDate(dateStr?: string | null, fallback = '—'): string {
  if (!dateStr || typeof dateStr !== 'string') return fallback;
  const clean = dateStr.trim();
  if (!clean) return fallback;

  // If already in DD-MM-YYYY format
  if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) {
    return clean;
  }

  // Handle YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ
  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [_, year, month, day] = isoMatch;
    return `${day}-${month}-${year}`;
  }

  // Handle other parseable date strings
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}-${month}-${year}`;
  }

  return clean;
}

/**
 * Format an ISO date or timestamp into Dutch display format with time (DD-MM-YYYY HH:mm).
 */
export function formatDisplayDateTime(dateStr?: string | null, fallback = '—'): string {
  if (!dateStr || typeof dateStr !== 'string') return fallback;
  const clean = dateStr.trim();
  if (!clean) return fallback;

  const d = new Date(clean);
  if (isNaN(d.getTime())) return clean;

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year} ${hours}:${minutes}`;
}

/**
 * Formats a date into a human-friendly relative time string in Dutch (e.g. 'Zojuist', '2u geleden', 'Gisteren', '5d geleden').
 */
export function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return 'Nooit';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Onbekend';

  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return 'Zojuist';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m geleden`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}u geleden`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Gisteren';
  if (diffDays < 30) return `${diffDays}d geleden`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} mnd geleden`;
  return `${Math.floor(diffDays / 365)} jr geleden`;
}


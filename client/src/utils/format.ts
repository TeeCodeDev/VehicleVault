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

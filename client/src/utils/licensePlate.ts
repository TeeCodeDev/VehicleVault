/**
 * Utility functions for Dutch (RDW) license plate formatting and normalization.
 */

/**
 * Formats a raw license plate (e.g. "NBL41K" or "12AB34") into official Dutch sidecode format with hyphens (e.g. "NBL-41-K", "12-AB-34").
 * Supports all 14 official RDW sidecode patterns.
 */
export function formatLicensePlate(plate?: string | null): string {
  if (!plate) return '';
  const clean = plate.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');

  // If not standard 6-character Dutch plate, return original trimmed
  if (clean.length !== 6) {
    return plate.trim().toUpperCase();
  }

  // Sidecode 1: XX-99-99 (2 letters, 2 digits, 2 digits)
  if (/^[A-Z]{2}[0-9]{2}[0-9]{2}$/.test(clean)) {
    return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
  }
  // Sidecode 2: 99-99-XX (2 digits, 2 digits, 2 letters)
  if (/^[0-9]{2}[0-9]{2}[A-Z]{2}$/.test(clean)) {
    return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
  }
  // Sidecode 3: 99-XX-99 (2 digits, 2 letters, 2 digits)
  if (/^[0-9]{2}[A-Z]{2}[0-9]{2}$/.test(clean)) {
    return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
  }
  // Sidecode 4: XX-99-XX (2 letters, 2 digits, 2 letters)
  if (/^[A-Z]{2}[0-9]{2}[A-Z]{2}$/.test(clean)) {
    return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
  }
  // Sidecode 5: XX-XX-99 (2 letters, 2 letters, 2 digits)
  if (/^[A-Z]{2}[A-Z]{2}[0-9]{2}$/.test(clean)) {
    return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
  }
  // Sidecode 6: 99-XX-XX (2 digits, 2 letters, 2 letters)
  if (/^[0-9]{2}[A-Z]{2}[A-Z]{2}$/.test(clean)) {
    return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
  }
  // Sidecode 7: 99-XXX-9 (2 digits, 3 letters, 1 digit)
  if (/^[0-9]{2}[A-Z]{3}[0-9]{1}$/.test(clean)) {
    return `${clean.slice(0, 2)}-${clean.slice(2, 5)}-${clean.slice(5, 6)}`;
  }
  // Sidecode 8: 9-XXX-99 (1 digit, 3 letters, 2 digits)
  if (/^[0-9]{1}[A-Z]{3}[0-9]{2}$/.test(clean)) {
    return `${clean.slice(0, 1)}-${clean.slice(1, 4)}-${clean.slice(4, 6)}`;
  }
  // Sidecode 9: XX-999-X (2 letters, 3 digits, 1 letter, e.g. NK-956-Z)
  if (/^[A-Z]{2}[0-9]{3}[A-Z]{1}$/.test(clean)) {
    return `${clean.slice(0, 2)}-${clean.slice(2, 5)}-${clean.slice(5, 6)}`;
  }
  // Sidecode 10: X-999-XX (1 letter, 3 digits, 2 letters, e.g. G-001-BB)
  if (/^[A-Z]{1}[0-9]{3}[A-Z]{2}$/.test(clean)) {
    return `${clean.slice(0, 1)}-${clean.slice(1, 4)}-${clean.slice(4, 6)}`;
  }
  // Sidecode 11: XXX-99-X (3 letters, 2 digits, 1 letter, e.g. NBL-41-K)
  if (/^[A-Z]{3}[0-9]{2}[A-Z]{1}$/.test(clean)) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5, 6)}`;
  }
  // Sidecode 12: X-99-XXX (1 letter, 2 digits, 3 letters)
  if (/^[A-Z]{1}[0-9]{2}[A-Z]{3}$/.test(clean)) {
    return `${clean.slice(0, 1)}-${clean.slice(1, 3)}-${clean.slice(3, 6)}`;
  }
  // Sidecode 13: 9-XX-999 (1 digit, 2 letters, 3 digits)
  if (/^[0-9]{1}[A-Z]{2}[0-9]{3}$/.test(clean)) {
    return `${clean.slice(0, 1)}-${clean.slice(1, 3)}-${clean.slice(3, 6)}`;
  }
  // Sidecode 14: 999-XX-9 (3 digits, 2 letters, 1 digit)
  if (/^[0-9]{3}[A-Z]{2}[0-9]{1}$/.test(clean)) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5, 6)}`;
  }

  // Fallback 2-2-2
  return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
}

import { db } from '../db/database.js';

/**
 * Helper to format a date string (YYYY-MM-DD) into iCalendar DATE format (YYYYMMDD).
 */
function formatIcsDate(dateStr: string): string {
  return dateStr.replace(/[^0-9]/g, '').slice(0, 8);
}

/**
 * Calculates a future date in YYYY-MM-DD format by adding days to a date string.
 */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Escapes characters for iCalendar text fields.
 */
function escapeIcsText(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export class CalendarService {
  /**
   * Generates an RFC 5545 compliant .ics calendar file containing:
   * 1. Vehicle APK / Inspection expiration dates with 30-day and 7-day alarms
   * 2. Maintenance interval service due dates with alarms
   * 3. Vehicle document expiration dates (e.g. green card, insurance policies)
   */
  public static generateIcs(vehicleId?: string, userId?: string): string {
    const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    let sql = "SELECT * FROM vehicles WHERE status = 'active'";
    const params: any[] = [];

    if (vehicleId) {
      sql += ' AND id = ?';
      params.push(vehicleId);
    } else if (userId) {
      sql += ' AND (user_id = ? OR id IN (SELECT vehicle_id FROM vehicle_shares WHERE user_id = ?))';
      params.push(userId, userId);
    }

    const vehicles = db.query<any>(sql, params);
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//VehicleVault//Vehicle Management Platform//NL',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:VehicleVault Voertuigenkalender',
      'X-WR-TIMEZONE:Europe/Amsterdam',
    ];

    for (const v of vehicles) {
      const plateLabel = v.license_plate ? ` (${v.license_plate})` : '';
      const country = (v.plate_country || 'NL').toUpperCase();
      const inspTerm = country === 'BE' ? 'Autokeuring' : country === 'DE' ? 'TÜV' : country === 'UK' ? 'MOT' : 'APK';

      // 1. APK / Inspection Event
      if (v.apk_expiration_date && /^\d{4}-\d{2}-\d{2}$/.test(v.apk_expiration_date)) {
        const startDate = formatIcsDate(v.apk_expiration_date);
        const endDate = formatIcsDate(addDays(v.apk_expiration_date, 1));
        const uid = `apk-${v.id}-${startDate}@vehiclevault`;

        lines.push(
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `DTSTAMP:${nowStamp}`,
          `DTSTART;VALUE=DATE:${startDate}`,
          `DTEND;VALUE=DATE:${endDate}`,
          `SUMMARY:${escapeIcsText(`🛡️ ${inspTerm}: ${v.name}${plateLabel}`)}`,
          `DESCRIPTION:${escapeIcsText(`Vervaldatum van de ${inspTerm} keuring voor ${v.name}${plateLabel}. Plan tijdig een afspraak bij je garage!`)}`,
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          `DESCRIPTION:${escapeIcsText(`Herinnering: ${inspTerm} voor ${v.name} verloopt over 30 dagen!`)}`,
          'TRIGGER:-P30D',
          'END:VALARM',
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          `DESCRIPTION:${escapeIcsText(`Dringend: ${inspTerm} voor ${v.name} verloopt over 7 dagen!`)}`,
          'TRIGGER:-P7D',
          'END:VALARM',
          'END:VEVENT'
        );
      }

      // 2. Upcoming Maintenance Intervals
      const intervals = db.query<any>(
        `SELECT mi.*, sc.name as category_name
         FROM maintenance_intervals mi
         JOIN service_categories sc ON sc.id = mi.category_id
         WHERE mi.vehicle_id = ?`,
        [v.id]
      );

      for (const item of intervals) {
        if (item.interval_months && (item.last_service_date || v.purchase_date || v.created_at)) {
          const baseDate = new Date(item.last_service_date || v.purchase_date || v.created_at);
          if (!isNaN(baseDate.getTime())) {
            const dueDate = new Date(baseDate);
            dueDate.setMonth(dueDate.getMonth() + Number(item.interval_months));
            const dueStr = dueDate.toISOString().slice(0, 10);
            const startDate = formatIcsDate(dueStr);
            const endDate = formatIcsDate(addDays(dueStr, 1));
            const itemName = item.custom_name || item.category_name;
            const uid = `maint-${item.id}-${startDate}@vehiclevault`;

            lines.push(
              'BEGIN:VEVENT',
              `UID:${uid}`,
              `DTSTAMP:${nowStamp}`,
              `DTSTART;VALUE=DATE:${startDate}`,
              `DTEND;VALUE=DATE:${endDate}`,
              `SUMMARY:${escapeIcsText(`🔧 Onderhoud: ${v.name} — ${itemName}`)}`,
              `DESCRIPTION:${escapeIcsText(`Periodiek onderhoud (${item.interval_km ? `${item.interval_km} km / ` : ''}${item.interval_months} maanden) voor ${v.name}${plateLabel}.`)}`,
              'BEGIN:VALARM',
              'ACTION:DISPLAY',
              `DESCRIPTION:${escapeIcsText(`Onderhoudsherinnering: ${itemName} voor ${v.name} is gepland voor over 14 dagen.`)}`,
              'TRIGGER:-P14D',
              'END:VALARM',
              'END:VEVENT'
            );
          }
        }
      }

      // 3. Document Expirations (e.g. Green card, insurance policy, warranty)
      const docs = db.query<any>(
        "SELECT * FROM vehicle_documents WHERE vehicle_id = ? AND expires_at IS NOT NULL AND expires_at != ''",
        [v.id]
      );

      for (const doc of docs) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(doc.expires_at)) {
          const startDate = formatIcsDate(doc.expires_at);
          const endDate = formatIcsDate(addDays(doc.expires_at, 1));
          const uid = `doc-${doc.id}-${startDate}@vehiclevault`;

          lines.push(
            'BEGIN:VEVENT',
            `UID:${uid}`,
            `DTSTAMP:${nowStamp}`,
            `DTSTART;VALUE=DATE:${startDate}`,
            `DTEND;VALUE=DATE:${endDate}`,
            `SUMMARY:${escapeIcsText(`📑 Document vervalt: ${doc.name} (${v.name})`)}`,
            `DESCRIPTION:${escapeIcsText(`Het document "${doc.name}" voor ${v.name}${plateLabel} verloopt op ${doc.expires_at}.`)}`,
            'BEGIN:VALARM',
            'ACTION:DISPLAY',
            `DESCRIPTION:${escapeIcsText(`Document herinnering: "${doc.name}" (${v.name}) verloopt over 14 dagen!`)}`,
            'TRIGGER:-P14D',
            'END:VALARM',
            'END:VEVENT'
          );
        }
      }
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }
}

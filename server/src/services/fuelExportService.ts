import ExcelJS from 'exceljs';

export interface FuelExportVehicle {
  name: string;
  license_plate?: string | null;
  make?: string | null;
  model?: string | null;
  fuel_type?: string | null;
  initial_odometer?: number;
}

export interface FuelExportRecord {
  id: string;
  date: string;
  odometer: number;
  liters: number;
  price_per_liter: number;
  total_cost: number;
  is_full_tank: number;
  missed_previous: number;
  notes?: string | null;
  station_name?: string | null;
  station_address?: string | null;
  energy_type?: string;
  kwh?: number | null;
  price_per_kwh?: number | null;
}

export class FuelExportService {
  /**
   * Generates a formatted Excel (.xlsx) workbook for fuel entries.
   */
  public static async generateExcel(
    vehicle: FuelExportVehicle,
    entries: FuelExportRecord[]
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'VehicleVault';
    workbook.lastModifiedBy = 'VehicleVault';
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheet = workbook.addWorksheet('Tankhistorie', {
      views: [{ showGridLines: true }],
    });

    // Sort entries chronologically
    const sorted = [...entries].sort((a, b) => a.odometer - b.odometer);

    // Calculate totals
    let totalSpend = 0;
    let totalLiters = 0;
    let totalKwh = 0;
    for (const e of sorted) {
      totalSpend += e.total_cost || 0;
      if (e.energy_type === 'electric') {
        totalKwh += e.kwh || 0;
      } else {
        totalLiters += e.liters || 0;
      }
    }

    // Average consumption calculation
    let avgConsumptionL100 = '—';
    let avgConsumptionKmL = '—';
    if (sorted.length >= 2) {
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const deltaOdo = last.odometer - first.odometer;
      const consumedLiters = sorted.slice(1).reduce((acc, cur) => acc + (cur.liters || 0), 0);
      if (deltaOdo > 0 && consumedLiters > 0) {
        avgConsumptionL100 = (Math.round((consumedLiters / deltaOdo) * 100 * 100) / 100).toFixed(2);
        avgConsumptionKmL = (Math.round((deltaOdo / consumedLiters) * 100) / 100).toFixed(2);
      }
    }

    const avgPricePerLiter =
      totalLiters > 0 ? (totalSpend / totalLiters).toFixed(3) : '—';

    // 1. Title Banner
    sheet.mergeCells('A1:L1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'VEHICLEVAULT — TANKHISTORIE & VERBRUIK';
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    titleCell.alignment = { vertical: 'middle', indent: 1 };
    sheet.getRow(1).height = 32;

    // 2. Vehicle Subtitle
    sheet.mergeCells('A2:L2');
    const subCell = sheet.getCell('A2');
    const plateStr = vehicle.license_plate ? ` [${vehicle.license_plate}]` : '';
    const descStr = [vehicle.make, vehicle.model, vehicle.fuel_type].filter(Boolean).join(' • ');
    subCell.value = `Voertuig: ${vehicle.name}${plateStr}${descStr ? ` (${descStr})` : ''} | Gegenereerd op: ${new Date().toLocaleDateString('nl-NL')}`;
    subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    subCell.alignment = { vertical: 'middle', indent: 1 };
    sheet.getRow(2).height = 20;

    sheet.addRow([]); // Blank row 3

    // 3. KPI Summary Box
    const kpiHeaders = [
      'Totaal Brandstofkosten',
      'Totale Hoeveelheid',
      'Gemiddeld Verbruik',
      'Gemiddelde Literprijs',
      'Aantal Tankbeurten',
    ];
    const kpiValues = [
      `€ ${totalSpend.toFixed(2)}`,
      totalKwh > 0 ? `${totalLiters.toFixed(1)} L + ${totalKwh.toFixed(1)} kWh` : `${totalLiters.toFixed(1)} L`,
      avgConsumptionL100 !== '—' ? `${avgConsumptionL100} L/100km (${avgConsumptionKmL} km/L)` : '—',
      avgPricePerLiter !== '—' ? `€ ${avgPricePerLiter} / L` : '—',
      `${sorted.length} registraties`,
    ];

    const kpiRowStart = 4;
    sheet.addRow(kpiHeaders);
    sheet.addRow(kpiValues);

    const kpiHeadRow = sheet.getRow(kpiRowStart);
    kpiHeadRow.height = 18;
    for (let c = 1; c <= 5; c++) {
      const cell = kpiHeadRow.getCell(c);
      cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF475569' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    }

    const kpiValRow = sheet.getRow(kpiRowStart + 1);
    kpiValRow.height = 24;
    for (let c = 1; c <= 5; c++) {
      const cell = kpiValRow.getCell(c);
      cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    }

    sheet.addRow([]); // Blank row 6

    // 4. Data Table Headers
    const headers = [
      'Datum',
      'Kilometerstand (km)',
      'Afstand (km)',
      'Liters / kWh',
      'Type',
      'Prijs per Eenheid (€)',
      'Totaalbedrag (€)',
      'Verbruik (L/100km)',
      'Volle Tank',
      'Tankstation',
      'Locatie / Adres',
      'Notities',
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF0F172A' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      };
    });

    // 5. Data Rows
    let prevOdo: number | null = vehicle.initial_odometer || null;
    let prevFullOdo: number | null = null;
    let accumulatedLiters = 0;

    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      const deltaKm = prevOdo !== null && e.odometer >= prevOdo ? e.odometer - prevOdo : null;
      prevOdo = e.odometer;

      // Calculate consumption for full tanks
      let consumption: string = '—';
      if (e.is_full_tank && !e.missed_previous) {
        if (prevFullOdo !== null && e.odometer > prevFullOdo) {
          const distanceSinceFull = e.odometer - prevFullOdo;
          const totalLitersSinceFull = accumulatedLiters + (e.liters || 0);
          if (distanceSinceFull > 0 && totalLitersSinceFull > 0) {
            consumption = ((totalLitersSinceFull / distanceSinceFull) * 100).toFixed(2);
          }
        }
        prevFullOdo = e.odometer;
        accumulatedLiters = 0;
      } else {
        accumulatedLiters += e.liters || 0;
      }

      const qty = e.energy_type === 'electric' ? e.kwh || 0 : e.liters || 0;
      const unitPrice = e.energy_type === 'electric' ? e.price_per_kwh || 0 : e.price_per_liter || 0;

      const row = sheet.addRow([
        e.date,
        e.odometer,
        deltaKm !== null ? deltaKm : '—',
        qty,
        e.energy_type === 'electric' ? 'Stroom' : 'Brandstof',
        unitPrice,
        e.total_cost,
        consumption !== '—' ? Number(consumption) : '—',
        e.is_full_tank ? 'Ja' : 'Nee',
        e.station_name || '—',
        e.station_address || '—',
        e.notes || '',
      ]);

      row.height = 20;

      // Zebra striping
      const isEven = i % 2 === 0;
      const bgColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        // Alignments & Formats
        if (colNumber === 1 || colNumber === 5 || colNumber === 9) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if ([2, 3, 4, 6, 7, 8].includes(colNumber)) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (colNumber === 6) cell.numFmt = '€ #,##0.000';
          else if (colNumber === 7) cell.numFmt = '€ #,##0.00';
          else if (colNumber === 4 || colNumber === 8) cell.numFmt = '#,##0.00';
          else if (colNumber === 2 || colNumber === 3) cell.numFmt = '#,##0';
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    }

    // Auto-fit column widths
    sheet.columns.forEach((col, idx) => {
      let maxLen = 10;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const valStr = cell.value ? String(cell.value) : '';
        if (valStr.length > maxLen && valStr.length < 50) {
          maxLen = valStr.length;
        }
      });
      col.width = Math.max(maxLen + 3, 12);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Generates a Belastingdienst & Excel friendly UTF-8 BOM CSV with semicolon delimiter.
   */
  public static generateCsv(
    vehicle: FuelExportVehicle,
    entries: FuelExportRecord[]
  ): Buffer {
    const sorted = [...entries].sort((a, b) => a.odometer - b.odometer);

    const headers = [
      'Datum',
      'Kilometerstand',
      'Afstand (km)',
      'Liters/kWh',
      'Type',
      'Prijs per Eenheid',
      'Totaalbedrag',
      'Volle Tank',
      'Tankstation',
      'Adres',
      'Notities',
    ];

    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += headers.join(';') + '\r\n';

    let prevOdo: number | null = vehicle.initial_odometer || null;

    for (const e of sorted) {
      const deltaKm = prevOdo !== null && e.odometer >= prevOdo ? e.odometer - prevOdo : '';
      prevOdo = e.odometer;

      const qty = e.energy_type === 'electric' ? e.kwh || 0 : e.liters || 0;
      const unitPrice = e.energy_type === 'electric' ? e.price_per_kwh || 0 : e.price_per_liter || 0;

      const cleanNotes = (e.notes || '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ');
      const cleanStation = (e.station_name || '').replace(/"/g, '""');
      const cleanAddress = (e.station_address || '').replace(/"/g, '""');

      const row = [
        e.date,
        e.odometer.toString(),
        deltaKm.toString(),
        qty.toFixed(2).replace('.', ','),
        e.energy_type === 'electric' ? 'Stroom' : 'Brandstof',
        unitPrice.toFixed(3).replace('.', ','),
        e.total_cost.toFixed(2).replace('.', ','),
        e.is_full_tank ? 'Ja' : 'Nee',
        `"${cleanStation}"`,
        `"${cleanAddress}"`,
        `"${cleanNotes}"`,
      ];

      csvContent += row.join(';') + '\r\n';
    }

    return Buffer.from(csvContent, 'utf-8');
  }
}

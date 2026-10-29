import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { RdwService } from './rdwService.js';

export interface TripExportVehicle {
  name: string;
  license_plate?: string;
  vin?: string;
  type?: string;
  initial_odometer?: number;
}

export interface TripRecord {
  id: string;
  date: string;
  start_odometer: number;
  end_odometer: number;
  distance_km: number;
  from_location: string;
  to_location: string;
  purpose: 'business' | 'commute' | 'private';
  description?: string | null;
  is_return_trip?: number | boolean;
}

export class TripExportService {
  /**
   * Generates a Belastingdienst & fiscal compliant Excel spreadsheet (.xlsx).
   */
  public static async generateExcel(
    vehicle: TripExportVehicle,
    trips: TripRecord[],
    year?: string
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'VehicleVault';
    workbook.lastModifiedBy = 'VehicleVault';
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheet = workbook.addWorksheet('Ritregistratie', {
      views: [{ showGridLines: true }],
    });

    // Calculate metrics
    let totalKm = 0;
    let businessKm = 0;
    let commuteKm = 0;
    let privateKm = 0;

    for (const t of trips) {
      const d = Number(t.distance_km) || 0;
      totalKm += d;
      if (t.purpose === 'business') businessKm += d;
      else if (t.purpose === 'commute') commuteKm += d;
      else if (t.purpose === 'private') privateKm += d;
    }
    const businessPct = totalKm > 0 ? Math.round(((businessKm + commuteKm) / totalKm) * 100) : 0;

    // Header styling
    const titleFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    const kpiHeaderFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    const kpiBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };

    // 1. Title Block
    sheet.mergeCells('A1:I1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'VehicleVault - Fiscale Ritregistratie (Belastingdienst)';
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    titleCell.fill = titleFill;
    sheet.getRow(1).height = 36;

    sheet.mergeCells('A2:I2');
    const subCell = sheet.getCell('A2');
    subCell.value = `Voertuig: ${vehicle.name} (${RdwService.formatPlate(vehicle.license_plate) || 'Geen kenteken'})  |  Periode: ${year || 'Alle jaren'}  |  Exportdatum: ${new Date().toLocaleDateString('nl-NL')}`;
    subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
    subCell.alignment = { vertical: 'middle', indent: 1 };
    sheet.getRow(2).height = 22;

    // 2. Summary KPI Box
    sheet.getRow(3).height = 10; // spacing

    sheet.getCell('A4').value = 'Totaal Afstand:';
    sheet.getCell('B4').value = `${totalKm.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
    sheet.getCell('C4').value = 'Zakelijk:';
    sheet.getCell('D4').value = `${businessKm.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
    sheet.getCell('E4').value = 'Woon-werk:';
    sheet.getCell('F4').value = `${commuteKm.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
    sheet.getCell('G4').value = 'Privé:';
    sheet.getCell('H4').value = `${privateKm.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
    sheet.getCell('I4').value = `Zakelijk: ${businessPct}%`;

    const kpiRow = sheet.getRow(4);
    kpiRow.height = 24;
    for (let col = 1; col <= 9; col++) {
      const cell = kpiRow.getCell(col);
      cell.fill = kpiHeaderFill;
      cell.border = kpiBorder;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      if (col % 2 === 1 && col !== 9) {
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF475569' } };
      } else {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      }
    }

    sheet.getRow(5).height = 12; // spacing

    // 3. Table Column Headers
    const headers = [
      'Datum',
      'Vertrekadres',
      'Aankomstadres',
      'Beginstand (km)',
      'Eindstand (km)',
      'Afstand (km)',
      'Karakter rit',
      'Toelichting / Omschrijving',
      'Retourrit',
    ];

    const headerRow = sheet.getRow(6);
    headerRow.height = 26;
    headers.forEach((h, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = titleFill;
      cell.alignment = {
        vertical: 'middle',
        horizontal: idx >= 3 && idx <= 5 ? 'right' : idx === 0 || idx === 6 || idx === 8 ? 'center' : 'left',
      };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF0F172A' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      };
    });

    // 4. Rows
    const dataBorder: Partial<ExcelJS.Borders> = {
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };

    const zebraFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8FAFC' },
    };

    let startRowIndex = 7;
    trips.forEach((t, i) => {
      const row = sheet.getRow(startRowIndex + i);
      row.height = 20;

      const purposeLabel =
        t.purpose === 'business' ? 'Zakelijk' : t.purpose === 'commute' ? 'Woon-werk' : 'Privé';
      const isReturn = t.is_return_trip ? 'Ja' : 'Nee';

      row.getCell(1).value = t.date;
      row.getCell(2).value = t.from_location;
      row.getCell(3).value = t.to_location;
      row.getCell(4).value = Number(t.start_odometer);
      row.getCell(5).value = Number(t.end_odometer);
      row.getCell(6).value = Number(t.distance_km);
      row.getCell(7).value = purposeLabel;
      row.getCell(8).value = t.description || '';
      row.getCell(9).value = isReturn;

      // Styling per cell
      for (let col = 1; col <= 9; col++) {
        const cell = row.getCell(col);
        cell.font = { name: 'Calibri', size: 9 };
        cell.border = dataBorder;
        if (i % 2 === 1) {
          cell.fill = zebraFill;
        }

        if (col === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (col >= 4 && col <= 6) {
          cell.numFmt = '#,##0.0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (col === 7 || col === 9) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          if (col === 7) {
            cell.font = {
              name: 'Calibri',
              size: 9,
              bold: true,
              color: {
                argb: t.purpose === 'business' ? 'FF4F46E5' : t.purpose === 'commute' ? 'FF0284C7' : 'FF64748B',
              },
            };
          }
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      }
    });

    // 5. Total Row
    const endRowIndex = startRowIndex + trips.length;
    const totalRow = sheet.getRow(endRowIndex);
    totalRow.height = 24;

    sheet.mergeCells(`A${endRowIndex}:E${endRowIndex}`);
    const totalLabelCell = totalRow.getCell(1);
    totalLabelCell.value = 'Totale geregistreerde afstand:';
    totalLabelCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    totalLabelCell.alignment = { vertical: 'middle', horizontal: 'right' };

    const totalValCell = totalRow.getCell(6);
    if (trips.length > 0) {
      totalValCell.value = { formula: `SUM(F${startRowIndex}:F${endRowIndex - 1})` };
    } else {
      totalValCell.value = 0;
    }
    totalValCell.numFmt = '#,##0.0';
    totalValCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF4F46E5' } };
    totalValCell.alignment = { vertical: 'middle', horizontal: 'right' };

    for (let col = 1; col <= 9; col++) {
      const cell = totalRow.getCell(col);
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF1E293B' } },
        bottom: { style: 'double', color: { argb: 'FF1E293B' } },
      };
      cell.fill = kpiHeaderFill;
    }

    // Auto Column Widths
    const colWidths = [14, 28, 28, 16, 16, 15, 14, 32, 12];
    colWidths.forEach((w, idx) => {
      sheet.getColumn(idx + 1).width = w;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Generates a sleek, fiscal compliant PDF dossier (Landscape A4) for the Belastingdienst.
   */
  public static async generatePdf(
    vehicle: TripExportVehicle,
    trips: TripRecord[],
    year?: string
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 30,
        info: {
          Title: `Ritregistratie - ${vehicle.name}`,
          Author: 'VehicleVault Fiscaal Dossier',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Calculate totals
      let totalKm = 0;
      let businessKm = 0;
      let commuteKm = 0;
      let privateKm = 0;

      for (const t of trips) {
        const d = Number(t.distance_km) || 0;
        totalKm += d;
        if (t.purpose === 'business') businessKm += d;
        else if (t.purpose === 'commute') commuteKm += d;
        else if (t.purpose === 'private') privateKm += d;
      }
      const businessPct = totalKm > 0 ? Math.round(((businessKm + commuteKm) / totalKm) * 100) : 0;

      const pageWidth = 841.89;
      const leftMargin = 30;
      const contentWidth = pageWidth - leftMargin * 2; // ~781.89

      const renderHeader = (isFirstPage: boolean) => {
        // Banner
        doc.rect(leftMargin, 25, contentWidth, 44).fill('#0f172a');
        doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold').text('VEHICLEVAULT • FISCALE RITREGISTRATIE', leftMargin + 15, 34);
        doc.fontSize(8.5).font('Helvetica').fillColor('#94a3b8').text('Sluitende kilometeradministratie conform eisen Belastingdienst', leftMargin + 15, 52);

        doc.fillColor('#38bdf8').fontSize(10).font('Helvetica-Bold').text(
          `${vehicle.name} (${RdwService.formatPlate(vehicle.license_plate) || 'Geen kenteken'})`,
          leftMargin,
          34,
          { align: 'right', width: contentWidth - 15 }
        );
        doc.fillColor('#cbd5e1').fontSize(8).font('Helvetica').text(
          `Periode: ${year || 'Alle ritten'}  |  Datum: ${new Date().toLocaleDateString('nl-NL')}`,
          leftMargin,
          52,
          { align: 'right', width: contentWidth - 15 }
        );

        if (isFirstPage) {
          // KPI Summary Strip
          const kpiY = 76;
          doc.rect(leftMargin, kpiY, contentWidth, 26).lineWidth(1).strokeColor('#cbd5e1').fillAndStroke('#f8fafc', '#cbd5e1');
          
          const kpiCols = [
            { label: 'Totaal Afstand', val: `${totalKm.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km` },
            { label: 'Zakelijk', val: `${businessKm.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km` },
            { label: 'Woon-werk', val: `${commuteKm.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km` },
            { label: 'Privé', val: `${privateKm.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km` },
            { label: 'Zakelijk Aandeel', val: `${businessPct}%` },
          ];

          const segWidth = contentWidth / kpiCols.length;
          kpiCols.forEach((col, idx) => {
            const x = leftMargin + idx * segWidth;
            doc.fillColor('#64748b').fontSize(7.5).font('Helvetica-Bold').text(col.label.toUpperCase(), x, kpiY + 4, {
              width: segWidth,
              align: 'center',
            });
            doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold').text(col.val, x, kpiY + 14, {
              width: segWidth,
              align: 'center',
            });
          });
        }
      };

      // Table columns definition
      const colWidths = {
        date: 60,
        from: 145,
        to: 145,
        startOdo: 60,
        endOdo: 60,
        dist: 55,
        purpose: 65,
        returnTrip: 35,
        desc: 156,
      };

      const renderTableHeaders = (y: number) => {
        doc.rect(leftMargin, y, contentWidth, 20).fill('#1e293b');
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');

        let curX = leftMargin;
        doc.text('Datum', curX + 4, y + 6, { width: colWidths.date - 8, align: 'center' });
        curX += colWidths.date;

        doc.text('Vertrekadres', curX + 6, y + 6, { width: colWidths.from - 12 });
        curX += colWidths.from;

        doc.text('Aankomstadres', curX + 6, y + 6, { width: colWidths.to - 12 });
        curX += colWidths.to;

        doc.text('Beginstand', curX, y + 6, { width: colWidths.startOdo - 6, align: 'right' });
        curX += colWidths.startOdo;

        doc.text('Eindstand', curX, y + 6, { width: colWidths.endOdo - 6, align: 'right' });
        curX += colWidths.endOdo;

        doc.text('Afstand', curX, y + 6, { width: colWidths.dist - 6, align: 'right' });
        curX += colWidths.dist;

        doc.text('Karakter', curX, y + 6, { width: colWidths.purpose, align: 'center' });
        curX += colWidths.purpose;

        doc.text('Retour', curX, y + 6, { width: colWidths.returnTrip, align: 'center' });
        curX += colWidths.returnTrip;

        doc.text('Toelichting / Omschrijving', curX + 6, y + 6, { width: colWidths.desc - 12 });
      };

      // Initial page setup
      renderHeader(true);
      let curY = 110;
      renderTableHeaders(curY);
      curY += 20;

      const rowHeight = 17;
      const maxY = 540;

      trips.forEach((t, i) => {
        if (curY + rowHeight > maxY) {
          doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 });
          renderHeader(false);
          curY = 76;
          renderTableHeaders(curY);
          curY += 20;
        }

        // Zebra striping
        if (i % 2 === 1) {
          doc.rect(leftMargin, curY, contentWidth, rowHeight).fill('#f8fafc');
        }

        // Thin row bottom border
        doc.rect(leftMargin, curY + rowHeight, contentWidth, 0.5).fill('#e2e8f0');

        let x = leftMargin;

        // Datum
        doc.fillColor('#334155').fontSize(7.5).font('Helvetica').text(t.date, x, curY + 4, {
          width: colWidths.date,
          align: 'center',
        });
        x += colWidths.date;

        // From
        doc.text(t.from_location, x + 6, curY + 4, {
          width: colWidths.from - 12,
          lineBreak: false,
          ellipsis: true,
        });
        x += colWidths.from;

        // To
        doc.text(t.to_location, x + 6, curY + 4, {
          width: colWidths.to - 12,
          lineBreak: false,
          ellipsis: true,
        });
        x += colWidths.to;

        // Start odo
        doc.text(Number(t.start_odometer).toLocaleString('nl-NL'), x, curY + 4, {
          width: colWidths.startOdo - 6,
          align: 'right',
        });
        x += colWidths.startOdo;

        // End odo
        doc.text(Number(t.end_odometer).toLocaleString('nl-NL'), x, curY + 4, {
          width: colWidths.endOdo - 6,
          align: 'right',
        });
        x += colWidths.endOdo;

        // Distance
        doc.fillColor('#0f172a').font('Helvetica-Bold').text(Number(t.distance_km).toFixed(1), x, curY + 4, {
          width: colWidths.dist - 6,
          align: 'right',
        });
        x += colWidths.dist;

        // Karakter (colored text)
        const purposeLabel =
          t.purpose === 'business' ? 'Zakelijk' : t.purpose === 'commute' ? 'Woon-werk' : 'Privé';
        const purposeColor =
          t.purpose === 'business' ? '#4338ca' : t.purpose === 'commute' ? '#0369a1' : '#64748b';
        doc.fillColor(purposeColor).font('Helvetica-Bold').text(purposeLabel, x, curY + 4, {
          width: colWidths.purpose,
          align: 'center',
        });
        x += colWidths.purpose;

        // Retour
        doc.fillColor('#475569').font('Helvetica').text(t.is_return_trip ? 'Ja' : 'Nee', x, curY + 4, {
          width: colWidths.returnTrip,
          align: 'center',
        });
        x += colWidths.returnTrip;

        // Description
        doc.fillColor('#64748b').text(t.description || '-', x + 6, curY + 4, {
          width: colWidths.desc - 12,
          lineBreak: false,
          ellipsis: true,
        });

        curY += rowHeight;
      });

      // Bottom Total Summary Line on the last page
      if (curY + 24 > maxY) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 });
        renderHeader(false);
        curY = 76;
      }

      doc.rect(leftMargin, curY + 2, contentWidth, 22).lineWidth(1).strokeColor('#0f172a').fillAndStroke('#f1f5f9', '#0f172a');
      doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('TOTALE AFSTAND:', leftMargin + 10, curY + 8);
      doc.fillColor('#4338ca').fontSize(9.5).font('Helvetica-Bold').text(
        `${totalKm.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`,
        leftMargin + 120,
        curY + 7
      );
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text(
        `Waarvan ${businessKm.toFixed(1)} km zakelijk en ${commuteKm.toFixed(1)} km woon-werk (${businessPct}% fiscaal declarabel / aftrekbaar)`,
        leftMargin + 250,
        curY + 8
      );

      // Add page numbers at the bottom of all pages
      const range = doc.bufferedPageRange();
      for (let p = 0; p < range.count; p++) {
        doc.switchToPage(p);
        doc.fillColor('#94a3b8').fontSize(7).font('Helvetica').text(
          `VehicleVault Fiscaal Dossier • Pagina ${p + 1} van ${range.count} • Document gegenereerd op ${new Date().toLocaleString('nl-NL')}`,
          leftMargin,
          565,
          { align: 'center', width: contentWidth }
        );
      }

      doc.end();
    });
  }
}


import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { db } from '../db/database.js';
import { DATA_PATHS } from '../config/env.js';

export interface PdfDossierOptions {
  vehicleId: string;
  includeFuel?: boolean;
  includeReceipts?: boolean;
  startDate?: string;
  endDate?: string;
}

export class PdfService {
  /**
   * Generates a sleek, professional "Digital Service Booklet" PDF in Dutch.
   */
  public static async generateDossier(options: PdfDossierOptions): Promise<Buffer> {
    const { vehicleId, includeFuel = true, includeReceipts = false, startDate, endDate } = options;

    const vehicle = db.get<any>('SELECT * FROM vehicles WHERE id = ?', [vehicleId]);
    if (!vehicle) {
      throw new Error('Voertuig niet gevonden');
    }

    // Fetch service records
    let serviceSql = `SELECT s.*, c.name as category_name 
                      FROM service_records s
                      LEFT JOIN service_categories c ON c.id = s.category_id
                      WHERE s.vehicle_id = ?`;
    const serviceParams: any[] = [vehicleId];
    if (startDate) {
      serviceSql += ' AND s.date >= ?';
      serviceParams.push(startDate);
    }
    if (endDate) {
      serviceSql += ' AND s.date <= ?';
      serviceParams.push(endDate);
    }
    serviceSql += ' ORDER BY s.date DESC';
    const services = db.query<any>(serviceSql, serviceParams);

    // Fetch fuel records if requested
    let fuels: any[] = [];
    if (includeFuel) {
      let fuelSql = 'SELECT * FROM fuel_entries WHERE vehicle_id = ?';
      const fuelParams: any[] = [vehicleId];
      if (startDate) {
        fuelSql += ' AND date >= ?';
        fuelParams.push(startDate);
      }
      if (endDate) {
        fuelSql += ' AND date <= ?';
        fuelParams.push(endDate);
      }
      fuelSql += ' ORDER BY date DESC';
      fuels = db.query<any>(fuelSql, fuelParams);
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `Onderhoudspaspoort - ${vehicle.name}`,
          Author: 'VehicleVault Digitaal Voertuigpaspoort',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // --- Header / Cover Banner ---
      doc.rect(40, 40, 515, 80).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('VEHICLEVAULT', 60, 56);
      doc.fontSize(10).font('Helvetica').fillColor('#94a3b8').text('OFFICIEEL DIGITAAL SERVICEPASPOORT & DOSSIER', 60, 84);
      doc.fillColor('#38bdf8').fontSize(11).text('VERKOOPDOSSIER', 410, 65, { align: 'right', width: 125 });
      doc.fillColor('#cbd5e1').fontSize(8).text(`Datum: ${new Date().toLocaleDateString('nl-NL')}`, 410, 85, { align: 'right', width: 125 });

      doc.moveDown(4);

      // --- Vehicle Info Card ---
      const startY = 140;
      doc.rect(40, startY, 515, 100).lineWidth(1).strokeColor('#e2e8f0').fillAndStroke('#f8fafc', '#cbd5e1');

      doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text(vehicle.name, 55, startY + 12);
      doc.fontSize(10).font('Helvetica').fillColor('#475569');

      const col1X = 55;
      const col2X = 220;
      const col3X = 390;

      doc.text(`Kenteken: ${vehicle.license_plate || 'Niet ingesteld'}`, col1X, startY + 36);
      doc.text(`VIN (Chassis): ${vehicle.vin || 'Onbekend'}`, col1X, startY + 54);
      doc.text(`Type: ${vehicle.type?.toUpperCase() || 'AUTO'}`, col1X, startY + 72);

      doc.text(`Merk: ${vehicle.make || 'Onbekend'}`, col2X, startY + 36);
      doc.text(`Model: ${vehicle.model || 'Onbekend'}`, col2X, startY + 54);
      doc.text(`Bouwjaar: ${vehicle.year || 'Onbekend'}`, col2X, startY + 72);

      doc.text(`Brandstof: ${vehicle.fuel_type || 'Onbekend'}`, col3X, startY + 36);
      doc.text(`APK Vervaldatum: ${vehicle.apk_expiration_date || 'Niet bekend'}`, col3X, startY + 54);
      doc.text(`Beginstand: ${(vehicle.initial_odometer || 0).toLocaleString()} km`, col3X, startY + 72);

      // --- Section: Maintenance & Service History ---
      let curY = startY + 120;
      doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text('Onderhouds- & Reparatiehistorie', 40, curY);
      curY += 22;

      // Table Header
      doc.rect(40, curY, 515, 20).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('DATUM', 48, curY + 6);
      doc.text('KM-STAND', 115, curY + 6);
      doc.text('WERKZAAMHEDEN / ONDERDEEL', 185, curY + 6);
      doc.text('UITGEVOERD DOOR', 370, curY + 6);
      doc.text('BEDRAG', 485, curY + 6, { align: 'right', width: 60 });
      curY += 20;

      if (services.length === 0) {
        doc.fillColor('#64748b').fontSize(9).font('Helvetica-Oblique').text('Geen onderhoudsrecords gevonden in deze periode.', 48, curY + 10);
        curY += 30;
      } else {
        services.forEach((s: any, idx: number) => {
          if (curY > 740) {
            doc.addPage();
            curY = 50;
          }
          const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
          doc.rect(40, curY, 515, 24).fill(rowBg);

          doc.fillColor('#334155').fontSize(8).font('Helvetica');
          doc.text(s.date, 48, curY + 7);
          doc.text(`${s.odometer.toLocaleString()} km`, 115, curY + 7);
          doc.font('Helvetica-Bold').text(s.service_item, 185, curY + 7, { width: 175, lineBreak: false });
          doc.font('Helvetica').text(s.performing_party === 'self' ? 'ZELF (DIY)' : 'GARAGE / DEALER', 370, curY + 7);
          doc.text(`€ ${s.cost.toFixed(2)}`, 485, curY + 7, { align: 'right', width: 60 });

          curY += 24;
        });
      }

      // --- Section: Fuel Records (if selected) ---
      if (includeFuel && fuels.length > 0) {
        curY += 20;
        if (curY > 700) {
          doc.addPage();
          curY = 50;
        }

        doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text('Tankbeurtenregister', 40, curY);
        curY += 22;

        doc.rect(40, curY, 515, 20).fill('#334155');
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
        doc.text('DATUM', 48, curY + 6);
        doc.text('KM-STAND', 120, curY + 6);
        doc.text('LITERS', 210, curY + 6);
        doc.text('LITERPRIJS', 320, curY + 6);
        doc.text('TOTAALBEDRAG', 480, curY + 6, { align: 'right', width: 65 });
        curY += 20;

        fuels.slice(0, 30).forEach((f: any, idx: number) => {
          if (curY > 740) {
            doc.addPage();
            curY = 50;
          }
          const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
          doc.rect(40, curY, 515, 20).fill(rowBg);

          doc.fillColor('#334155').fontSize(8).font('Helvetica');
          doc.text(f.date, 48, curY + 6);
          doc.text(`${f.odometer.toLocaleString()} km`, 120, curY + 6);
          doc.text(`${f.liters.toFixed(2)} L`, 210, curY + 6);
          doc.text(`€ ${f.price_per_liter.toFixed(3)}`, 320, curY + 6);
          doc.text(`€ ${f.total_cost.toFixed(2)}`, 480, curY + 6, { align: 'right', width: 65 });

          curY += 20;
        });
      }

      // --- Section: Attached Receipts & Invoices ---
      if (includeReceipts) {
        const recordsWithImages = services.filter((s: any) => s.invoice_path && fs.existsSync(path.join(DATA_PATHS.invoices, s.invoice_path)));
        if (recordsWithImages.length > 0) {
          doc.addPage();
          curY = 50;
          doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text('Gekoppelde Werkbonnen & Facturen', 40, curY);
          curY += 30;

          for (const rec of recordsWithImages) {
            const filePath = path.join(DATA_PATHS.invoices, rec.invoice_path);
            if (filePath.endsWith('.jpg') || filePath.endsWith('.png') || filePath.endsWith('.jpeg')) {
              try {
                if (curY > 500) {
                  doc.addPage();
                  curY = 50;
                }
                doc.fontSize(10).font('Helvetica-Bold').fillColor('#334155').text(`${rec.date} — ${rec.service_item} (€${rec.cost})`, 40, curY);
                curY += 15;
                doc.image(filePath, 40, curY, { fit: [300, 200] });
                curY += 220;
              } catch {
                // skip if corrupt
              }
            }
          }
        }
      }

      // --- Footer ---
      doc.fontSize(7).fillColor('#94a3b8').text(
        'Gegenereerd via VehicleVault — Het Privacy-First Voertuigbeheer & TCO Platform',
        40,
        790,
        { align: 'center', width: 515 }
      );

      doc.end();
    });
  }
}

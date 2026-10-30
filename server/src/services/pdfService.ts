import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { PDFDocument as PdfLibDocument, rgb, StandardFonts } from 'pdf-lib';
import sharp from 'sharp';
import { db } from '../db/database.js';
import { DATA_PATHS } from '../config/env.js';

export interface PdfDossierOptions {
  vehicleId: string;
  includeTires?: boolean;
  includeFuel?: boolean;
  includeReceipts?: boolean;
  startDate?: string;
  endDate?: string;
}

function formatNlDate(val?: string | null): string {
  if (!val) return 'Onbekend';
  const trimmed = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const [y, m, d] = trimmed.slice(0, 10).split('-');
    return `${d}-${m}-${y}`;
  }
  return trimmed;
}

function sanitizeWinAnsi(text?: string | null): string {
  if (!text) return '';
  return String(text)
    .replace(/€/g, 'EUR ')
    .replace(/[—–]/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

export class PdfService {
  /**
   * Generates a sleek, professional "Digital Service Booklet" PDF in Dutch,
   * including optional Tire Status and full-page merged PDF/image Invoice Attachments.
   */
  public static async generateDossier(options: PdfDossierOptions): Promise<Buffer> {
    const {
      vehicleId,
      includeTires = true,
      includeFuel = true,
      includeReceipts = false,
      startDate,
      endDate,
    } = options;

    const vehicle = db.get<any>('SELECT * FROM vehicles WHERE id = ?', [vehicleId]);
    if (!vehicle) {
      throw new Error('Voertuig niet gevonden');
    }

    // Compute current vehicle odometer
    const vehOdoRow = db.get<any>(
      `SELECT 
        MAX(
          COALESCE((SELECT MAX(odometer) FROM fuel_entries WHERE vehicle_id = ?), 0),
          COALESCE((SELECT MAX(odometer) FROM service_records WHERE vehicle_id = ?), 0),
          COALESCE((SELECT MAX(odometer) FROM odometer_logs WHERE vehicle_id = ?), 0),
          COALESCE((SELECT initial_odometer FROM vehicles WHERE id = ?), 0)
        ) as current_odometer`,
      [vehicleId, vehicleId, vehicleId, vehicleId]
    );
    const currentOdometer = vehOdoRow?.current_odometer || vehicle.initial_odometer || 0;

    // Fetch tire sets if requested
    let tireSets: any[] = [];
    if (includeTires) {
      const rawSets = db.query<any>(
        "SELECT * FROM tire_sets WHERE vehicle_id = ? AND status != 'retired' ORDER BY CASE WHEN status = 'mounted' THEN 0 ELSE 1 END, created_at DESC",
        [vehicleId]
      );
      tireSets = rawSets.map((set) => {
        let currentKm = set.total_km || 0;
        if (set.status === 'mounted' && set.mounted_odometer !== null && set.mounted_odometer !== undefined) {
          currentKm += Math.max(0, currentOdometer - set.mounted_odometer);
        }
        return {
          ...set,
          current_km: currentKm,
        };
      });
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
    serviceSql += ' ORDER BY s.date DESC, s.odometer DESC';
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
      fuelSql += ' ORDER BY date DESC, odometer DESC';
      fuels = db.query<any>(fuelSql, fuelParams);
    }

    // Pre-convert any .webp images to PNG buffers so PDFKit can embed them
    const preparedImageBuffers = new Map<string, Buffer>();
    if (includeReceipts) {
      for (const s of services) {
        if (s.invoice_path) {
          const full = path.join(DATA_PATHS.invoices, s.invoice_path);
          const ext = path.extname(full).toLowerCase();
          if (fs.existsSync(full) && (ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp')) {
            try {
              const buf = ext === '.webp' ? await sharp(full).png().toBuffer() : fs.readFileSync(full);
              preparedImageBuffers.set(full, buf);
            } catch {}
          }
        }
      }
      for (const f of fuels) {
        if (f.receipt_path) {
          const full = path.join(DATA_PATHS.receipts, f.receipt_path);
          const ext = path.extname(full).toLowerCase();
          if (fs.existsSync(full) && (ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp')) {
            try {
              const buf = ext === '.webp' ? await sharp(full).png().toBuffer() : fs.readFileSync(full);
              preparedImageBuffers.set(full, buf);
            } catch {}
          }
        }
      }
    }

    const pdfAttachmentsToAppend: Array<{
      filePath: string;
      headerTitle: string;
      headerSubtitle: string;
    }> = [];

    const basePdfBuffer = await new Promise<Buffer>((resolve, reject) => {
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
      doc.fontSize(10).font('Helvetica').fillColor('#94a3b8').text('VOERTUIGHISTORIE & ONDERHOUDSDOSSIER', 60, 84);
      doc.fillColor('#38bdf8').fontSize(11).text('DOSSIER', 410, 65, { align: 'right', width: 125 });
      doc.fillColor('#cbd5e1').fontSize(8).text(`Datum: ${new Date().toLocaleDateString('nl-NL')}`, 410, 85, { align: 'right', width: 125 });

      // --- Vehicle Info Card ---
      const startY = 136;
      doc.rect(40, startY, 515, 100).lineWidth(1).strokeColor('#e2e8f0').fillAndStroke('#f8fafc', '#cbd5e1');

      doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text(vehicle.name, 55, startY + 12);
      doc.fontSize(9.5).font('Helvetica').fillColor('#475569');

      const col1X = 55;
      const col2X = 220;
      const col3X = 385;

      doc.text(`Kenteken: ${vehicle.license_plate || 'Niet ingesteld'}`, col1X, startY + 36);
      doc.text(`VIN (Chassis): ${vehicle.vin || 'Onbekend'}`, col1X, startY + 54);
      doc.text(`Type: ${vehicle.type?.toUpperCase() || 'AUTO'}`, col1X, startY + 72);

      doc.text(`Merk: ${vehicle.make || 'Onbekend'}`, col2X, startY + 36);
      doc.text(`Model: ${vehicle.model || 'Onbekend'}`, col2X, startY + 54);
      doc.text(`Bouwjaar: ${vehicle.year || 'Onbekend'}`, col2X, startY + 72);

      doc.text(`Brandstof: ${vehicle.fuel_type || 'Onbekend'}`, col3X, startY + 36);
      doc.text(`APK Geldig tot: ${formatNlDate(vehicle.apk_expiration_date)}`, col3X, startY + 54);
      doc.text(`Huidige stand: ${currentOdometer.toLocaleString('nl-NL')} km`, col3X, startY + 72);

      let curY = startY + 116;

      // --- Section: Tire Sets & Tread Depth (Optional) ---
      if (includeTires && tireSets.length > 0) {
        doc.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold').text('Banden & Profieldiepte', 40, curY);
        curY += 20;

        for (const set of tireSets) {
          if (curY > 700) {
            doc.addPage();
            curY = 50;
          }

          const isMounted = set.status === 'mounted';
          const boxBg = isMounted ? '#f0fdf4' : '#f8fafc';
          const boxBorder = isMounted ? '#86efac' : '#cbd5e1';

          doc.rect(40, curY, 515, 58).lineWidth(1).fillAndStroke(boxBg, boxBorder);

          const seasonLabel =
            set.season === 'winter'
              ? 'Winterbanden'
              : set.season === 'all_season'
                ? '4-Seizoenenbanden'
                : 'Zomerbanden';
          const statusLabel = isMounted ? 'MOMENTEEL GEMONTEERD' : 'IN OPSLAG';
          const brandModel =
            [set.brand, set.model].filter(Boolean).join(' ') || set.brand_model || set.name || 'Bandenset';

          doc.fillColor(isMounted ? '#166534' : '#475569').fontSize(8).font('Helvetica-Bold');
          doc.text(`${statusLabel}  •  ${seasonLabel.toUpperCase()}`, 52, curY + 8);

          doc.fillColor('#0f172a').fontSize(10.5).font('Helvetica-Bold');
          doc.text(
            `${brandModel}${set.name && set.name !== brandModel ? ` (${set.name})` : ''}`,
            52,
            curY + 21
          );

          const specsParts: string[] = [];
          if (set.tire_size) specsParts.push(`Maat: ${set.tire_size}`);
          if (set.rim_size) specsParts.push(`${String(set.rim_size).replace(/"/g, '')}" velgen`);
          if (set.speed_index) specsParts.push(`Index: ${set.speed_index}`);
          if (set.dot_code) specsParts.push(`DOT ${set.dot_code}`);
          specsParts.push(`Gereden: ${(set.current_km || 0).toLocaleString('nl-NL')} km`);

          doc.fillColor('#475569').fontSize(8.5).font('Helvetica');
          doc.text(specsParts.join('  •  '), 52, curY + 38);

          // Tread depths on the right side
          const fl = set.tread_depth_fl != null ? `${Number(set.tread_depth_fl).toFixed(1)} mm` : '—';
          const fr = set.tread_depth_fr != null ? `${Number(set.tread_depth_fr).toFixed(1)} mm` : '—';
          const rl = set.tread_depth_rl != null ? `${Number(set.tread_depth_rl).toFixed(1)} mm` : '—';
          const rr = set.tread_depth_rr != null ? `${Number(set.tread_depth_rr).toFixed(1)} mm` : '—';

          doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold');
          doc.text('PROFIELDIEPTE:', 360, curY + 10, { width: 180, align: 'right' });
          doc.font('Helvetica').fillColor('#1e293b').fontSize(8.5);
          doc.text(`LV: ${fl}   |   RV: ${fr}`, 360, curY + 24, { width: 180, align: 'right' });
          doc.text(`LA: ${rl}   |   RA: ${rr}`, 360, curY + 38, { width: 180, align: 'right' });

          curY += 66;
        }

        curY += 8;
      }

      // --- Section: Maintenance & Service History ---
      if (curY > 680) {
        doc.addPage();
        curY = 50;
      }
      doc.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold').text('Onderhouds- & Reparatiehistorie', 40, curY);
      curY += 20;

      // Table Header
      doc.rect(40, curY, 515, 20).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('DATUM', 48, curY + 6);
      doc.text('KM-STAND', 112, curY + 6);
      doc.text('WERKZAAMHEDEN / ONDERDEEL', 180, curY + 6);
      doc.text('UITGEVOERD DOOR', 365, curY + 6);
      doc.text('BEDRAG', 485, curY + 6, { align: 'right', width: 60 });
      curY += 20;

      if (services.length === 0) {
        doc.fillColor('#64748b').fontSize(9).font('Helvetica-Oblique').text('Geen onderhoudsrecords gevonden in deze periode.', 48, curY + 10);
        curY += 30;
      } else {
        services.forEach((s: any, idx: number) => {
          if (curY > 735) {
            doc.addPage();
            curY = 50;
          }
          const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
          doc.rect(40, curY, 515, 24).fill(rowBg);

          const partyLabel =
            s.performing_party === 'self'
              ? 'Zelf uitgevoerd'
              : s.garage_name || 'Garage / Dealer';

          doc.fillColor('#334155').fontSize(8).font('Helvetica');
          doc.text(formatNlDate(s.date), 48, curY + 7);
          doc.text(`${Number(s.odometer || 0).toLocaleString('nl-NL')} km`, 112, curY + 7);
          doc.font('Helvetica-Bold').text(s.service_item, 180, curY + 7, { width: 178, lineBreak: false, ellipsis: true });
          doc.font('Helvetica').text(partyLabel, 365, curY + 7, { width: 115, lineBreak: false, ellipsis: true });
          doc.text(`€ ${Number(s.cost || 0).toFixed(2)}`, 485, curY + 7, { align: 'right', width: 60 });

          curY += 24;
        });
      }

      // --- Section: Fuel Records (if selected) ---
      if (includeFuel && fuels.length > 0) {
        curY += 20;
        if (curY > 680) {
          doc.addPage();
          curY = 50;
        }

        doc.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold').text('Tankbeurtenregister', 40, curY);
        curY += 20;

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
          doc.text(formatNlDate(f.date), 48, curY + 6);
          doc.text(`${Number(f.odometer || 0).toLocaleString('nl-NL')} km`, 120, curY + 6);
          doc.text(`${Number(f.liters || 0).toFixed(2)} L`, 210, curY + 6);
          doc.text(`€ ${Number(f.price_per_liter || 0).toFixed(3)}`, 320, curY + 6);
          doc.text(`€ ${Number(f.total_cost || 0).toFixed(2)}`, 480, curY + 6, { align: 'right', width: 65 });

          curY += 20;
        });
      }

      // --- Footer on overview page ---
      doc.fontSize(7).fillColor('#94a3b8').text(
        'Gegenereerd met VehicleVault — Voertuigbeheer & Historie',
        40,
        790,
        { align: 'center', width: 515 }
      );

      // --- Section: Attached Receipts & Invoices as Separate Attachments ---
      if (includeReceipts) {
        const serviceReceipts = services.filter(
          (s: any) => s.invoice_path && fs.existsSync(path.join(DATA_PATHS.invoices, s.invoice_path))
        );
        const fuelReceipts = fuels.filter(
          (f: any) => f.receipt_path && fs.existsSync(path.join(DATA_PATHS.receipts, f.receipt_path))
        );

        // 1. Fuel receipts (compact images on receipt attachment page(s))
        const imageFuelReceipts = fuelReceipts.filter((rec: any) => {
          const full = path.join(DATA_PATHS.receipts, rec.receipt_path);
          return preparedImageBuffers.has(full);
        });
        const pdfFuelReceipts = fuelReceipts.filter((rec: any) => {
          const full = path.join(DATA_PATHS.receipts, rec.receipt_path);
          return path.extname(full).toLowerCase() === '.pdf';
        });

        if (imageFuelReceipts.length > 0) {
          doc.addPage();
          curY = 50;
          doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text('Bijlage: Gekoppelde Tankbonnen', 40, curY);
          curY += 25;

          for (const rec of imageFuelReceipts) {
            const filePath = path.join(DATA_PATHS.receipts, rec.receipt_path);
            const imgBuf = preparedImageBuffers.get(filePath);
            if (!imgBuf) continue;
            try {
              if (curY > 520) {
                doc.addPage();
                curY = 50;
              }
              doc
                .fontSize(10)
                .font('Helvetica-Bold')
                .fillColor('#1e293b')
                .text(
                  `Tankbon: ${formatNlDate(rec.date)} — ${Number(rec.liters || 0).toFixed(2)} L @ € ${Number(rec.price_per_liter || 0).toFixed(3)}/L (€ ${Number(rec.total_cost || 0).toFixed(2)})`,
                  40,
                  curY
                );
              curY += 15;
              doc.image(imgBuf, 40, curY, { fit: [280, 210] });
              curY += 225;
            } catch {
              // skip if corrupt image
            }
          }
        }

        // 2. Maintenance invoices — each invoice as a dedicated separate attachment!
        for (const rec of serviceReceipts) {
          const filePath = path.join(DATA_PATHS.invoices, rec.invoice_path);
          const ext = path.extname(filePath).toLowerCase();
          const imgBuf = preparedImageBuffers.get(filePath);

          if (imgBuf) {
            // Render image invoice on its own full attachment page
            doc.addPage();
            doc.rect(40, 35, 515, 42).fill('#0f172a');
            doc
              .fillColor('#38bdf8')
              .fontSize(8.5)
              .font('Helvetica-Bold')
              .text(
                `BIJLAGE ONDERHOUDSFACTUUR  •  ${formatNlDate(rec.date)}  •  ${Number(rec.odometer || 0).toLocaleString('nl-NL')} km  •  € ${Number(rec.cost || 0).toFixed(2)}`,
                52,
                44
              );
            doc
              .fillColor('#ffffff')
              .fontSize(10.5)
              .font('Helvetica-Bold')
              .text(
                `${rec.service_item}${rec.garage_name ? ` — ${rec.garage_name}` : ''}`,
                52,
                58,
                { width: 490, lineBreak: false, ellipsis: true }
              );

            try {
              doc.image(imgBuf, 40, 88, { fit: [515, 690], align: 'center' });
            } catch {
              // skip if corrupt image
            }
          } else if (ext === '.pdf') {
            // Queue PDF invoice to be appended as full separate attachment pages via pdf-lib
            pdfAttachmentsToAppend.push({
              filePath,
              headerTitle: `BIJLAGE ONDERHOUDSFACTUUR  -  ${formatNlDate(rec.date)}  |  ${Number(rec.odometer || 0).toLocaleString('nl-NL')} km  |  EUR ${Number(rec.cost || 0).toFixed(2)}`,
              headerSubtitle: `${rec.service_item}${rec.garage_name ? ` - ${rec.garage_name}` : ''}`,
            });
          }
        }

        // Also queue any PDF fuel receipts
        for (const rec of pdfFuelReceipts) {
          const filePath = path.join(DATA_PATHS.receipts, rec.receipt_path);
          pdfAttachmentsToAppend.push({
            filePath,
            headerTitle: `BIJLAGE TANKBON  -  ${formatNlDate(rec.date)}  |  ${Number(rec.liters || 0).toFixed(2)} L`,
            headerSubtitle: `Totaalbedrag: EUR ${Number(rec.total_cost || 0).toFixed(2)}`,
          });
        }
      }

      doc.end();
    });

    // If there are PDF invoices/receipts to attach as separate pages, merge them with pdf-lib
    if (pdfAttachmentsToAppend.length === 0) {
      return basePdfBuffer;
    }

    try {
      const mergedPdf = await PdfLibDocument.load(basePdfBuffer);
      const boldFont = await mergedPdf.embedFont(StandardFonts.HelveticaBold);
      const regularFont = await mergedPdf.embedFont(StandardFonts.Helvetica);

      for (const att of pdfAttachmentsToAppend) {
        try {
          const pdfBytes = fs.readFileSync(att.filePath);
          const attachmentPdf = await PdfLibDocument.load(pdfBytes, { ignoreEncryption: true });
          const pageIndices = attachmentPdf.getPageIndices();
          const copiedPages = await mergedPdf.copyPages(attachmentPdf, pageIndices);

          copiedPages.forEach((page, pageIdx) => {
            mergedPdf.addPage(page);
            const { width, height } = page.getSize();

            // Draw a sleek attachment identification banner at the top of each appended PDF page
            const bannerHeight = 22;
            page.drawRectangle({
              x: 0,
              y: height - bannerHeight,
              width,
              height: bannerHeight,
              color: rgb(0.06, 0.09, 0.16),
              opacity: 0.92,
            });

            const pageCounter =
              copiedPages.length > 1 ? ` (Pagina ${pageIdx + 1}/${copiedPages.length})` : '';
            const safeTitle = sanitizeWinAnsi(`${att.headerTitle}${pageCounter}`);
            const safeSub = sanitizeWinAnsi(att.headerSubtitle);

            page.drawText(safeTitle, {
              x: 14,
              y: height - 14,
              size: 7.5,
              font: boldFont,
              color: rgb(0.22, 0.74, 0.97),
            });

            if (safeSub) {
              const rightText = safeSub.length > 55 ? safeSub.slice(0, 52) + '...' : safeSub;
              const textWidth = regularFont.widthOfTextAtSize(rightText, 7.5);
              if (width - textWidth - 14 > 260) {
                page.drawText(rightText, {
                  x: width - textWidth - 14,
                  y: height - 14,
                  size: 7.5,
                  font: regularFont,
                  color: rgb(0.95, 0.96, 0.98),
                });
              }
            }
          });
        } catch (err) {
          console.warn('Could not append PDF invoice attachment:', att.filePath, err);
        }
      }

      const finalPdfBytes = await mergedPdf.save();
      return Buffer.from(finalPdfBytes);
    } catch (err) {
      console.warn('Fallback to base PDF buffer after pdf-lib merge error:', err);
      return basePdfBuffer;
    }
  }
}

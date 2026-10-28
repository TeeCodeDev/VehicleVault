import { createWorker } from 'tesseract.js';
import { AiReceiptService, extractDutchAddress, formatStationName } from './aiReceiptService.js';

export interface OcrParseResult {
  date: string | null;
  liters: number | null;
  pricePerLiter: number | null;
  totalCost: number | null;
  station?: string | null;
  stationAddress?: string | null;
  fuelType?: string | null;
  rawText: string;
  confidence: number;
  engine?: 'gemini' | 'openai' | 'tesseract';
  aiError?: string | null;
}

export class OcrService {
  /**
   * Performs AI Vision extraction (Gemini / OpenAI) if configured, with graceful fallback to local Tesseract OCR.
   */
  public static async processReceipt(imagePath: string): Promise<OcrParseResult> {
    let aiError: string | null = null;

    // 1. Attempt AI Vision extraction if an API key (Gemini / OpenAI) is configured
    if (AiReceiptService.isConfigured()) {
      try {
        const aiResult = await AiReceiptService.analyzeReceipt(imagePath);
        if (aiResult && (aiResult.liters || aiResult.totalCost || aiResult.date || aiResult.pricePerLiter)) {
          return {
            date: aiResult.date,
            liters: aiResult.liters,
            pricePerLiter: aiResult.pricePerLiter,
            totalCost: aiResult.totalCost,
            station: aiResult.station,
            stationAddress: aiResult.stationAddress,
            fuelType: aiResult.fuelType,
            rawText: `AI Vision Analysis (${aiResult.engine.toUpperCase()} • ${aiResult.model})`,
            confidence: aiResult.confidence,
            engine: aiResult.engine,
            aiError: null,
          };
        }
      } catch (aiErr: any) {
        aiError = aiErr?.message || String(aiErr);
        console.warn('AI Receipt Vision encountered an error, falling back to local Tesseract OCR:', aiError);
      }
    }

    // 2. Local Tesseract OCR fallback
    let worker;
    try {
      worker = await createWorker('nld+eng');
      const ret = await worker.recognize(imagePath);
      const text = ret.data.text;
      const confidence = ret.data.confidence;
      await worker.terminate();

      const parsed = this.parseReceiptText(text, confidence);
      return {
        ...parsed,
        engine: 'tesseract',
        aiError,
      };
    } catch (err: any) {
      if (worker) {
        try {
          await worker.terminate();
        } catch {
          // ignore cleanup error
        }
      }
      return {
        date: null,
        liters: null,
        pricePerLiter: null,
        totalCost: null,
        rawText: `OCR processing note: ${err?.message || 'Failed to parse image'}`,
        confidence: 0,
        engine: 'tesseract',
        aiError,
      };
    }
  }

  /**
   * Parse extracted OCR text using targeted regex patterns.
   */
  public static parseReceiptText(text: string, confidence = 0): OcrParseResult {
    let date: string | null = null;
    let liters: number | null = null;
    let pricePerLiter: number | null = null;
    let totalCost: number | null = null;

    const normalized = text.replace(/\r/g, '\n');

    // 1. Date extraction: "Datum 19-10-2026", "19/10/2026", "19.10.2026", "2026-10-19"
    const dateRegex = /(?:datum|date)?\s*[:\s]*(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/i;
    const isoDateRegex = /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/;
    let dateMatch = normalized.match(dateRegex);
    if (dateMatch) {
      const [_, d, m, y] = dateMatch;
      date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    } else {
      dateMatch = normalized.match(isoDateRegex);
      if (dateMatch) {
        const [_, y, m, d] = dateMatch;
        date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }

    // 2. Liters: prefer keyword volume/liters or explicit unit
    const litersKeywordRegex = /(?:volume|liters?|ltr|hoeveelheid|aantal)\s*[:\s]*(\d{1,3}[.,]\d{2,3})\b/i;
    const litersSuffixRegex = /\b(\d{1,3}[.,]\d{2})\s*(?:[lL\u2113]|ltr|liter)\b/i;
    const lMatch = normalized.match(litersKeywordRegex) || normalized.match(litersSuffixRegex);
    if (lMatch && lMatch[1]) {
      liters = parseFloat(lMatch[1].replace(',', '.'));
    }

    // 3. Unit price: keyword or suffix or 3-decimals
    const priceKeywordRegex = /(?:prijs\/[l\u2113]|price\/[l\u2113]|€\/[l\u2113]|eur\/[l\u2113]|prijs|price|rijs)\s*[:\s]*(?:€|eur)?\s*([0-2][.,]\d{2,3})\b/i;
    const priceSuffixRegex = /(?:€|eur)?\s*([0-2][.,]\d{2,3})\s*(?:\/[l\u2113]|\/ltr|\/liter)\b/i;
    const price3DecRegex = /\b([0-2][.,]\d{3})\b/;
    const pMatch = normalized.match(priceKeywordRegex) || normalized.match(priceSuffixRegex) || normalized.match(price3DecRegex);
    if (pMatch && pMatch[1]) {
      pricePerLiter = parseFloat(pMatch[1].replace(',', '.'));
    }

    // 4. Total amount paid from TOTAAL / BEDRAG / TOTAL
    const totalRegex = /(?:totaal|total|bedrag|te betalen)\s*[:\s]*(?:€|eur|e)?\s*(\d{1,4}[.,]\d{2})\b/i;
    const tMatch = normalized.match(totalRegex);
    if (tMatch && tMatch[1]) {
      totalCost = parseFloat(tMatch[1].replace(',', '.'));
    }

    // 5. Total fallback from Netto + BTW (common on Dutch receipts where TOTAAL has dot-matrix noise)
    const nettoRegex = /(?:netto|excl\.?\s*btw|subtotaal)\s*[:\s]*(?:€|eur)?\s*(\d{1,4}[.,]\d{2})\b/i;
    const btwRegex = /(?:btw|vat)\s*(?:\d{1,2}(?:\.\d{1,2})?\s*%)?\s*[:\s]*(?:€|eur)?\s*(\d{1,3}[.,]\d{2})\b/i;
    const nettoMatch = normalized.match(nettoRegex);
    const btwMatch = normalized.match(btwRegex);
    if (nettoMatch && btwMatch) {
      const netto = parseFloat(nettoMatch[1].replace(',', '.'));
      const btw = parseFloat(btwMatch[1].replace(',', '.'));
      const calculatedTotal = Math.round((netto + btw) * 100) / 100;
      if (!totalCost || Math.abs(totalCost - calculatedTotal) > 3) {
        totalCost = calculatedTotal;
      }
    }

    // 6. Mathematical reconciliation: If two are known, infer the third accurately
    if (liters && pricePerLiter && !totalCost) {
      totalCost = Math.round(liters * pricePerLiter * 100) / 100;
    } else if (totalCost && liters && !pricePerLiter && liters > 0) {
      pricePerLiter = Math.round((totalCost / liters) * 1000) / 1000;
    } else if (totalCost && pricePerLiter && (!liters || liters < 1) && pricePerLiter > 0) {
      liters = Math.round((totalCost / pricePerLiter) * 100) / 100;
    }

    // 7. Station brand & Dutch address extraction from OCR text
    const stationAddress = extractDutchAddress(normalized);
    const commonStations = ['Fieten Olie', 'Shell', 'Esso', 'BP', 'TotalEnergies', 'Total', 'Texaco', 'Avia', 'Tamoil', 'Argos', 'TinQ', 'Tango', 'Firezone', 'Gulf', 'Neste', 'OK'];
    let station: string | null = null;
    for (const s of commonStations) {
      const reg = new RegExp(`\\b${s}\\b`, 'i');
      if (reg.test(normalized)) {
        station = formatStationName(s);
        break;
      }
    }

    return {
      date,
      liters,
      pricePerLiter,
      totalCost,
      station,
      stationAddress,
      rawText: text,
      confidence,
      engine: 'tesseract',
    };
  }
}

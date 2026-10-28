import { createWorker } from 'tesseract.js';

export interface OcrParseResult {
  liters: number | null;
  pricePerLiter: number | null;
  totalCost: number | null;
  rawText: string;
  confidence: number;
}

export class OcrService {
  /**
   * Performs OCR recognition and regex extraction on a receipt image.
   */
  public static async processReceipt(imagePath: string): Promise<OcrParseResult> {
    let worker;
    try {
      worker = await createWorker('nld+eng');
      const ret = await worker.recognize(imagePath);
      const text = ret.data.text;
      const confidence = ret.data.confidence;
      await worker.terminate();

      return this.parseReceiptText(text, confidence);
    } catch (err: any) {
      if (worker) {
        try {
          await worker.terminate();
        } catch {
          // ignore cleanup error
        }
      }
      // If language pack or worker fails, return empty result gracefully
      return {
        liters: null,
        pricePerLiter: null,
        totalCost: null,
        rawText: `OCR processing note: ${err?.message || 'Failed to parse image'}`,
        confidence: 0,
      };
    }
  }

  /**
   * Parse extracted OCR text using targeted regex patterns.
   */
  public static parseReceiptText(text: string, confidence = 0): OcrParseResult {
    let liters: number | null = null;
    let pricePerLiter: number | null = null;
    let totalCost: number | null = null;

    const normalized = text.replace(/\r/g, '\n');

    // 1. Liters extraction: e.g. "45.50 L", "45,50 ltr", "Volume: 50.12 liter"
    const litersRegex = /(?:volume|liters?|ltr|l)?\s*[:\s]*(\d{1,3}[.,]\d{2,3})\s*(?:l|ltr|liter)\b/i;
    const litersAltRegex = /\b(\d{1,3}[.,]\d{2})\s*(?:L|ltr)\b/i;
    
    let match = normalized.match(litersRegex) || normalized.match(litersAltRegex);
    if (match && match[1]) {
      liters = parseFloat(match[1].replace(',', '.'));
    }

    // 2. Unit price per liter: e.g. "1.929 EUR/L", "2,059 €/L", "Prijs/L: 1.899"
    const priceRegex = /(?:prijs\/l|price\/l|€\/l|eur\/l)?\s*[:\s]*([0-2][.,]\d{2,3})\s*(?:€|eur|\/l|\/ liter)\b/i;
    const priceAltRegex = /\b([1-2][.,]\d{3})\b/; // standard 3-decimal gas price
    
    match = normalized.match(priceRegex) || normalized.match(priceAltRegex);
    if (match && match[1]) {
      pricePerLiter = parseFloat(match[1].replace(',', '.'));
    }

    // 3. Total amount paid: e.g. "Totaal: 87.50", "Total EUR 95.00", "BEDRAG € 45,20"
    const totalRegex = /(?:totaal|total|bedrag|amount|eur|€)\s*[:\s]*(\d{1,4}[.,]\d{2})\b/i;
    match = normalized.match(totalRegex);
    if (match && match[1]) {
      totalCost = parseFloat(match[1].replace(',', '.'));
    }

    // Mathematical reconciliation: If two are known, infer the third
    if (liters && pricePerLiter && !totalCost) {
      totalCost = Math.round(liters * pricePerLiter * 100) / 100;
    } else if (totalCost && liters && !pricePerLiter && liters > 0) {
      pricePerLiter = Math.round((totalCost / liters) * 1000) / 1000;
    } else if (totalCost && pricePerLiter && !liters && pricePerLiter > 0) {
      liters = Math.round((totalCost / pricePerLiter) * 100) / 100;
    }

    return {
      liters,
      pricePerLiter,
      totalCost,
      rawText: text,
      confidence,
    };
  }
}


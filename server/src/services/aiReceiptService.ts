import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/database.js';

export interface AiReceiptExtraction {
  date: string | null;
  liters: number | null;
  pricePerLiter: number | null;
  totalCost: number | null;
  station: string | null;
  stationAddress: string | null;
  fuelType: string | null;
  confidence: number;
  engine: 'gemini' | 'openai';
  model: string;
}

export interface AiInvoiceLineItem {
  originalDescription: string;
  translatedDescription: string;
  category: 'parts' | 'labor' | 'other';
  quantity?: string | null;
  totalPrice: number | null;
}

export interface AiInvoiceExtraction {
  date: string | null;
  odometer: number | null;
  serviceTitle: string | null;
  garageName: string | null;
  garageAddress: string | null;
  detectedLanguage: string | null;
  totalCost: number | null;
  partsCost: number | null;
  laborCost: number | null;
  lineItems: AiInvoiceLineItem[];
  translatedNotes: string | null;
  engine: 'gemini' | 'openai';
  model: string;
}

export interface AiSettings {
  provider: 'gemini' | 'openai' | 'none';
  geminiApiKey?: string;
  geminiModel: string;
  openaiApiKey?: string;
  openaiModel: string;
  openaiBaseUrl?: string;
}

export function getSystemSetting(key: string): string | null {
  try {
    const row = db.get<{ value: string }>('SELECT value FROM system_settings WHERE key = ?', [key]);
    return row ? row.value : null;
  } catch {
    return null;
  }
}

export function setSystemSetting(key: string, value: string): void {
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, now]
  );
}

export function maskApiKey(key?: string | null): string | null {
  if (!key || key.trim().length === 0) return null;
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '••••••••';
  const prefix = trimmed.slice(0, 6);
  const suffix = trimmed.slice(-4);
  return `${prefix}...${suffix}`;
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.heic':
    case '.heif':
      return 'image/heic';
    default:
      return 'image/jpeg';
  }
}

/**
 * Build the `user` content part that carries the scanned document for an OpenAI chat completion.
 *
 * OpenAI's `image_url` part only accepts images (png/jpeg/webp/gif). A PDF sent that way is rejected with
 * `400 Invalid MIME type. Only image types are supported.`, so PDFs go in as a `file` part instead
 * (supported by vision-capable models such as gpt-4o and gpt-4o-mini).
 */
export function buildOpenAiMediaPart(base64Data: string, mimeType: string): Record<string, unknown> {
  const dataUrl = `data:${mimeType};base64,${base64Data}`;
  if (mimeType === 'application/pdf') {
    return { type: 'file', file: { filename: 'document.pdf', file_data: dataUrl } };
  }
  return { type: 'image_url', image_url: { url: dataUrl } };
}

/** Extra hint appended to an OpenAI error when a PDF was sent, since not every model/endpoint accepts PDF input. */
export function openAiPdfHint(mimeType: string): string {
  return mimeType === 'application/pdf'
    ? ' (Tip: PDF-invoer werkt alleen met OpenAI-modellen die bestanden ondersteunen, zoals gpt-4o of gpt-4o-mini op api.openai.com. Upload anders een foto of schermafbeelding van de factuur.)'
    : '';
}

/**
 * OpenAI only understands png/jpeg/webp/gif images and PDFs. Convert anything else (HEIC/HEIF from an
 * iPhone) to JPEG first. Gemini accepts HEIC natively, so this is only used on the OpenAI path.
 */
export async function prepareMediaForOpenAi(
  fileBuffer: Buffer,
  mimeType: string
): Promise<{ base64Data: string; mimeType: string }> {
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    try {
      const { default: sharp } = await import('sharp');
      const jpeg = await sharp(fileBuffer).rotate().jpeg({ quality: 90 }).toBuffer();
      return { base64Data: jpeg.toString('base64'), mimeType: 'image/jpeg' };
    } catch {
      throw new Error(
        'OpenAI ondersteunt geen HEIC-afbeeldingen en de conversie naar JPEG is mislukt. Maak een JPEG/PNG-foto of upload een PDF.'
      );
    }
  }
  return { base64Data: fileBuffer.toString('base64'), mimeType };
}

/**
 * Format petrol station brand/name to clean Title Case (e.g. "FIETEN OLIE" -> "Fieten Olie")
 */
export function formatStationName(val?: string | null): string | null {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;

  // Well-known brands/acronyms to keep uppercase
  const acronyms = new Set(['BP', 'OK', 'Q8', 'AVIA', 'AVIF', 'TAMOIL', 'ESSO', 'ARGOS', 'NRA']);

  return trimmed
    .split(/\s+/)
    .map((word) => {
      if (!word) return '';
      const upper = word.toUpperCase();
      if (acronyms.has(upper)) return upper;
      // If word or entire string is ALL CAPS, convert to Title Case
      if (trimmed === trimmed.toUpperCase() || word === word.toUpperCase()) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word;
    })
    .join(' ');
}

/**
 * Format address to clean casing while keeping Dutch postal codes uppercase (e.g. "8332 VN")
 */
export function formatAddress(val?: string | null): string | null {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;

  if (trimmed === trimmed.toUpperCase()) {
    return trimmed
      .split(/\s+/)
      .map((word) => {
        if (!word) return '';
        // Dutch postal code letters e.g. "VN", "AB", "VN,"
        if (/^[a-zA-Z]{2}[,.]?$/.test(word)) {
          return word.toUpperCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }
  return trimmed;
}

/**
 * Algorithmic safety net to extract Dutch addresses from receipt text or raw AI output:
 * Pattern: Street + number, followed by 4 digits + 2 letters (postal code) and city/town.
 * e.g. "Eeser Gaard 2, 8332 VN Steenwijk"
 */
export function extractDutchAddress(text?: string | null): string | null {
  if (!text || typeof text !== 'string') return null;

  // Clean quotes/json brackets from text
  const cleanText = text.replace(/["'{}]/g, ' ');

  // 1. Multi-line: Street + nr on one line, postal code + city on next line
  const multiLineRegex = /(?:^|[\r\n])\s*([^\r\n,;:|]+?\s+\d+[a-zA-Z]?(?:\s*-\s*\d+)?)[,\s]*[\r\n]+\s*(\d{4}\s?[A-Za-z]{2})\s+([^\r\n,;:|]+?)(?:[\r\n;,|]|$)/;
  const m1 = cleanText.match(multiLineRegex);
  if (m1) {
    const street = m1[1].trim();
    const postal = m1[2].replace(/\s+/g, ' ').toUpperCase().trim();
    const city = m1[3].trim();
    if (!/^(pomp|datum|bon|tank|volume|teller|factuur|transactie)/i.test(street)) {
      return formatAddress(`${street}, ${postal} ${city}`);
    }
  }

  // 2. Single-line: "Street 123, 1234 AB City" or "Street 123 1234 AB City"
  const singleLineRegex = /(?:^|[\r\n;,|:])\s*([^\r\n,;:|]+?\s+\d+[a-zA-Z]?(?:\s*-\s*\d+)?)[,\s]+(\d{4}\s?[A-Za-z]{2})\s+([^\r\n,;:|]+?)(?:[\r\n;,|]|$)/;
  const m2 = cleanText.match(singleLineRegex);
  if (m2) {
    const street = m2[1].trim();
    const postal = m2[2].replace(/\s+/g, ' ').toUpperCase().trim();
    const city = m2[3].trim();
    if (!/^(pomp|datum|bon|tank|volume|teller|factuur|transactie)/i.test(street)) {
      return formatAddress(`${street}, ${postal} ${city}`);
    }
  }

  // 3. Postal code + city only (e.g. "8332 VN Steenwijk")
  const postalCityRegex = /\b(\d{4}\s?[A-Za-z]{2})\s+([A-Za-z\u00C0-\u017F'-]+)\b/;
  const m3 = cleanText.match(postalCityRegex);
  if (m3) {
    const postal = m3[1].replace(/\s+/g, ' ').toUpperCase().trim();
    const city = m3[2].trim();
    return formatAddress(`${postal} ${city}`);
  }

  return null;
}

/**
 * Filter available Gemini models to only multimodal text/vision models, excluding specialized non-chat endpoints.
 */
export function filterVisionModels(models: string[]): string[] {
  const isExcluded = (name: string) => {
    const lower = name.toLowerCase();
    return (
      lower.includes('-tts') ||
      lower.includes('-image') ||
      lower.includes('audio') ||
      lower.includes('embed') ||
      lower.includes('bison') ||
      lower.includes('aqa') ||
      lower.includes('imagen') ||
      lower.includes('1.5-flash') ||
      lower.includes('2.0-flash') ||
      lower.includes('1.0-') ||
      lower === 'gemini-1.5-pro'
    );
  };

  return models
    .filter((m) => !isExcluded(m))
    .sort((a, b) => {
      if (a === 'gemini-3.8-flash') return -1;
      if (b === 'gemini-3.8-flash') return 1;
      if (a === 'gemini-2.5-flash') return -1;
      if (b === 'gemini-2.5-flash') return 1;
      if (a.includes('flash') && !b.includes('flash')) return -1;
      if (!a.includes('flash') && b.includes('flash')) return 1;
      return a.localeCompare(b);
    });
}

export class AiReceiptService {
  /**
   * Retrieve active AI settings, prioritizing stored database settings over environment variables.
   */
  public static getActiveSettings(): AiSettings {
    const storedProvider = getSystemSetting('ai_provider');
    const envProvider = process.env.AI_PROVIDER;
    const provider = (storedProvider || envProvider || 'gemini') as 'gemini' | 'openai' | 'none';

    const geminiApiKey = getSystemSetting('gemini_api_key') || process.env.GEMINI_API_KEY || '';
    let geminiModel = getSystemSetting('gemini_model') || process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    // Auto-migrate retired models (e.g. gemini-1.5-flash and gemini-2.0-flash retired by Google in favor of gemini-3.8-flash)
    if (geminiModel === 'gemini-1.5-flash' || geminiModel === 'gemini-2.0-flash' || geminiModel === 'gemini-1.5-pro') {
      geminiModel = 'gemini-3.8-flash';
      try {
        setSystemSetting('gemini_model', 'gemini-3.8-flash');
      } catch {}
    }

    const openaiApiKey = getSystemSetting('openai_api_key') || process.env.OPENAI_API_KEY || '';
    const openaiModel = getSystemSetting('openai_model') || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const openaiBaseUrl = getSystemSetting('openai_base_url') || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

    return {
      provider,
      geminiApiKey,
      geminiModel,
      openaiApiKey,
      openaiModel,
      openaiBaseUrl,
    };
  }

  /**
   * Check if a valid AI vision engine is enabled and has an API key configured.
   */
  public static isConfigured(): boolean {
    const s = this.getActiveSettings();
    if (s.provider === 'gemini') {
      return Boolean(s.geminiApiKey && s.geminiApiKey.trim().length > 0);
    }
    if (s.provider === 'openai') {
      return Boolean(s.openaiApiKey && s.openaiApiKey.trim().length > 0);
    }
    return false;
  }

  /**
   * Test connection to Google Gemini or OpenAI API
   */
  public static async testConnection(
    provider: 'gemini' | 'openai',
    apiKey?: string,
    model?: string,
    baseUrl?: string
  ): Promise<{ success: boolean; message: string; models?: string[] }> {
    const currentSettings = this.getActiveSettings();
    const effectiveKey = apiKey !== undefined
      ? apiKey.trim()
      : provider === 'gemini'
        ? currentSettings.geminiApiKey
        : currentSettings.openaiApiKey;

    if (!effectiveKey) {
      return {
        success: false,
        message: 'Geen API-sleutel ingevoerd om te testen.',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      if (provider === 'gemini') {
        const testUrl = effectiveKey.startsWith('AIza')
          ? `https://generativelanguage.googleapis.com/v1beta/models?key=${effectiveKey}`
          : `https://generativelanguage.googleapis.com/v1beta/models`;

        let res = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'x-goog-api-key': effectiveKey,
          },
          signal: controller.signal,
        });

        // Fallback retry with Bearer header if key is an OAuth / Bearer Authorization token (common for AQ. tokens)
        if (res.status === 401) {
          res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${effectiveKey}`,
            },
            signal: controller.signal,
          });
        }

        clearTimeout(timeout);

        if (!res.ok) {
          let errDetail = 'Ongeldige Gemini API-sleutel';
          try {
            const errJson = await res.json() as any;
            if (errJson?.error?.message) {
              errDetail = errJson.error.message;
            }
          } catch {}
          return {
            success: false,
            message: `Gemini API fout (${res.status}): ${errDetail}`,
          };
        }

        let availableModels: string[] = [];
        try {
          const resJson = await res.json() as any;
          if (Array.isArray(resJson?.models)) {
            const rawModels = resJson.models
              .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
              .map((m: any) => m.name.replace(/^models\//, ''));
            availableModels = filterVisionModels(rawModels);
          }
        } catch {}

        return {
          success: true,
          message: 'Verbinding met Google Gemini AI succesvol tot stand gebracht!',
          models: availableModels,
        };
      }

      if (provider === 'openai') {
        const effectiveBaseUrl = (baseUrl && baseUrl.trim().length > 0)
          ? baseUrl.trim().replace(/\/+$/, '')
          : (currentSettings.openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');

        const testUrl = `${effectiveBaseUrl}/models`;
        const res = await fetch(testUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${effectiveKey}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          let errDetail = 'Ongeldige OpenAI API-sleutel of endpoint';
          try {
            const errJson = await res.json() as any;
            if (errJson?.error?.message) {
              errDetail = errJson.error.message;
            }
          } catch {}
          return {
            success: false,
            message: `OpenAI API fout (${res.status}): ${errDetail}`,
          };
        }

        return {
          success: true,
          message: 'Verbinding met OpenAI API succesvol tot stand gebracht!',
        };
      }

      clearTimeout(timeout);
      return { success: false, message: 'Onbekende provider opgegeven.' };
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        return { success: false, message: 'Time-out (10s) bij het verbinden met de AI-service.' };
      }
      return { success: false, message: `Verbindingsfout: ${err?.message || 'Onbekende fout'}` };
    }
  }

  /**
   * Analyze receipt using configured AI Vision model.
   */
  public static async analyzeReceipt(imagePath: string): Promise<AiReceiptExtraction | null> {
    const settings = this.getActiveSettings();
    if (!this.isConfigured()) {
      return null;
    }

    if (!fs.existsSync(imagePath)) {
      throw new Error(`Receipt image file not found on disk: ${imagePath}`);
    }

    const fileBuffer = fs.readFileSync(imagePath);
    const base64Data = fileBuffer.toString('base64');
    const mimeType = getMimeType(imagePath);

    if (settings.provider === 'gemini' && settings.geminiApiKey) {
      return this.analyzeWithGemini(base64Data, mimeType, settings.geminiApiKey, settings.geminiModel);
    }

    if (settings.provider === 'openai' && settings.openaiApiKey) {
      const media = await prepareMediaForOpenAi(fileBuffer, mimeType);
      return this.analyzeWithOpenAi(
        media.base64Data,
        media.mimeType,
        settings.openaiApiKey,
        settings.openaiModel,
        settings.openaiBaseUrl
      );
    }

    return null;
  }

  /**
   * Dynamically fetch available models from Gemini API that support generateContent
   */
  public static async getAvailableGeminiModels(apiKey: string): Promise<string[]> {
    try {
      const url = apiKey.startsWith('AIza')
        ? `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        : `https://generativelanguage.googleapis.com/v1beta/models`;

      let res = await fetch(url, {
        headers: { 'x-goog-api-key': apiKey },
      });

      if (res.status === 401) {
        res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
      }

      if (!res.ok) return [];

      const data = await res.json() as any;
      if (!Array.isArray(data.models)) return [];

      const rawModels = data.models
        .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map((m: any) => m.name.replace(/^models\//, ''));
      return filterVisionModels(rawModels);
    } catch {
      return [];
    }
  }

  private static async postGemini(
    model: string,
    apiVersion: 'v1beta' | 'v1',
    apiKey: string,
    body: any,
    signal: AbortSignal
  ): Promise<Response> {
    const endpoint = apiKey.startsWith('AIza')
      ? `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`
      : `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent`;

    let res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (res.status === 401) {
      res = await fetch(`https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });
    }

    return res;
  }

  /**
   * Analyze receipt with Google Gemini Vision
   */
  private static async analyzeWithGemini(
    base64Data: string,
    mimeType: string,
    apiKey: string,
    modelName: string
  ): Promise<AiReceiptExtraction> {
    const promptText = `You are a precision fuel receipt scanner for Dutch and European filling stations.
Extract transaction details from this receipt image.

IMPORTANT FOR PETROL STATION & ADDRESS:
1. "station": Petrol station brand/company in Title Case (e.g. "Fieten Olie", "Shell", "Esso", "BP", "TotalEnergies", "Tamoil", "Argos", "Avia", never ALL CAPS).
2. "stationAddress": The physical street address of the petrol station. In the Netherlands, filling stations print this directly under the station brand name at the top (header) or at the bottom (footer). Look for the street, house number, 4-digit + 2-letter postal code (e.g. "8332 VN"), and city/town (e.g. "Steenwijk"). Combine them into "Street Nr, PostalCode City" (e.g. "Eeser Gaard 2, 8332 VN Steenwijk"). You MUST extract this whenever visible on the receipt.

Return ONLY a valid JSON object with the following fields:
{
  "date": "YYYY-MM-DD" or null,
  "liters": number (volume in liters, e.g. 37.41) or null,
  "pricePerLiter": number (unit price in EUR, e.g. 2.159) or null,
  "totalCost": number (total amount paid in EUR, e.g. 80.77) or null,
  "station": string (e.g. "Fieten Olie") or null,
  "stationAddress": string (e.g. "Eeser Gaard 2, 8332 VN Steenwijk") or null,
  "fuelType": string (e.g. "Euro 95 Ongelood", "Diesel", "SuperPlus 98") or null
}
Ensure decimal numbers use standard dots. Do not add markdown or extra text. Output strictly raw JSON.`;

    const body = {
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      const requestedModel = modelName || 'gemini-3.8-flash';
      let activeModel = requestedModel;

      // 1. Try requested model on v1beta
      let res = await this.postGemini(activeModel, 'v1beta', apiKey, body, controller.signal);

      // If 404 (e.g. models/gemini-2.0-flash is no longer available):
      if (res.status === 404) {
        let suggestedModel: string | null = null;
        try {
          const errClone = res.clone();
          const errJson = await errClone.json() as any;
          const msg = errJson?.error?.message || '';
          // Extract model from Google's advice, e.g. "Please update your code to use models/gemini-3.8-flash"
          const match = msg.match(/use models\/([a-zA-Z0-9\.\-_]+)/i) || msg.match(/models\/([a-zA-Z0-9\.\-_]+)/i);
          if (match && match[1] && match[1] !== activeModel) {
            suggestedModel = match[1];
          }
        } catch {}

        if (suggestedModel) {
          console.log(`Google Gemini advised replacement model: ${suggestedModel}`);
          activeModel = suggestedModel;
          res = await this.postGemini(activeModel, 'v1beta', apiKey, body, controller.signal);
        }

        // 2. If still 404, try modern gemini-3.8-flash on v1beta
        if (res.status === 404 && activeModel !== 'gemini-3.8-flash') {
          console.log(`Fallback to gemini-3.8-flash on v1beta...`);
          activeModel = 'gemini-3.8-flash';
          res = await this.postGemini(activeModel, 'v1beta', apiKey, body, controller.signal);
        }

        // 3. If still 404, dynamically query user's allowed models
        if (res.status === 404) {
          console.log(`Dynamically discovering available models for API key...`);
          const available = await this.getAvailableGeminiModels(apiKey);
          const discovered = available.find((m) => m.includes('3.8-flash')) || available.find((m) => m.includes('flash')) || available[0];
          if (discovered && discovered !== activeModel) {
            activeModel = discovered;
            console.log(`Using discovered model: ${activeModel}`);
            res = await this.postGemini(activeModel, 'v1beta', apiKey, body, controller.signal);
          }
        }

        // 4. If still 404, try requested model on stable v1
        if (res.status === 404) {
          console.log(`Fallback to ${activeModel} on stable v1...`);
          res = await this.postGemini(activeModel, 'v1', apiKey, body, controller.signal);
        }

        // Persist newly discovered/suggested working model so subsequent requests don't hit 404
        if (res.ok && activeModel !== requestedModel) {
          try {
            setSystemSetting('gemini_model', activeModel);
          } catch {}
        }
      }

      clearTimeout(timeout);

      if (!res.ok) {
        let errDetail = `Status ${res.status}`;
        try {
          const errJson = await res.json() as any;
          if (errJson?.error?.message) {
            errDetail = errJson.error.message;
          }
        } catch {
          try {
            const errText = await res.text();
            if (errText) errDetail = errText;
          } catch {}
        }
        throw new Error(`Gemini API fout (${res.status}): ${errDetail}`);
      }

      const resJson = await res.json() as any;
      const rawJson = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJson) {
        throw new Error('Gemini API gaf geen herkenningsresultaat terug');
      }

      return this.normalizeAiResult(rawJson, 'gemini', activeModel);
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  /**
   * Analyze receipt with OpenAI Vision (or OpenAI-compatible vision models)
   */
  private static async analyzeWithOpenAi(
    base64Data: string,
    mimeType: string,
    apiKey: string,
    modelName: string,
    baseUrl?: string
  ): Promise<AiReceiptExtraction> {
    const model = modelName || 'gpt-4o-mini';
    const effectiveBaseUrl = (baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const endpoint = `${effectiveBaseUrl}/chat/completions`;

    const body = {
      model,
      messages: [
        {
          role: 'system',
          content: `You are an expert fuel receipt parser for Dutch and European filling stations.
Extract transaction details from the receipt image.

IMPORTANT FOR PETROL STATION & ADDRESS:
1. "station": Petrol station brand/company in Title Case (e.g. "Fieten Olie", "Shell", "Esso", "BP", "TotalEnergies", "Tamoil", "Argos", "Avia", never ALL CAPS).
2. "stationAddress": The physical street address of the petrol station. In the Netherlands, filling stations print this directly under the station brand name at the top (header) or at the bottom (footer). Look for the street, house number, 4-digit + 2-letter postal code (e.g. "8332 VN"), and city/town (e.g. "Steenwijk"). Combine them into "Street Nr, PostalCode City" (e.g. "Eeser Gaard 2, 8332 VN Steenwijk"). You MUST extract this whenever visible on the receipt.

Return ONLY a valid JSON object with the following fields:
{
  "date": "YYYY-MM-DD" or null,
  "liters": number (volume in liters, e.g. 37.41) or null,
  "pricePerLiter": number (unit price in EUR, e.g. 2.159) or null,
  "totalCost": number (total amount paid in EUR, e.g. 80.77) or null,
  "station": string (e.g. "Fieten Olie") or null,
  "stationAddress": string (e.g. "Eeser Gaard 2, 8332 VN Steenwijk") or null,
  "fuelType": string (e.g. "Euro 95 Ongelood", "Diesel", "SuperPlus 98") or null
}`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract fuel receipt details.' },
            buildOpenAiMediaPart(base64Data, mimeType),
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI API returned status ${res.status}: ${errText}${openAiPdfHint(mimeType)}`);
      }

      const resJson = await res.json() as any;
      const rawJson = resJson.choices?.[0]?.message?.content;
      if (!rawJson) {
        throw new Error('OpenAI API did not return message content');
      }

      return this.normalizeAiResult(rawJson, 'openai', model);
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  /**
   * Parse and reconcile raw JSON returned by AI
   */
  public static normalizeAiResult(
    rawJson: string,
    engine: 'gemini' | 'openai',
    model: string
  ): AiReceiptExtraction {
    // Strip markdown code fence if model returned ```json ... ```
    let clean = rawJson.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    }

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch (err: any) {
      throw new Error(`Failed to parse AI JSON response: ${err.message}`);
    }

    let date: string | null = null;
    if (parsed.date && typeof parsed.date === 'string') {
      const match = parsed.date.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
      if (match) {
        date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
      } else {
        const dmyMatch = parsed.date.match(/(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})/);
        if (dmyMatch) {
          date = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
        }
      }
    }

    const parseNum = (val: any): number | null => {
      if (val === null || val === undefined || val === '') return null;
      if (typeof val === 'number') return isNaN(val) ? null : val;
      const s = String(val).replace(',', '.').replace(/[^0-9.]/g, '');
      const n = parseFloat(s);
      return isNaN(n) ? null : n;
    };

    let liters = parseNum(parsed.liters);
    let pricePerLiter = parseNum(parsed.pricePerLiter);
    let totalCost = parseNum(parsed.totalCost);

    // Mathematical reconciliation: If two are known, calculate the third accurately
    if (liters && pricePerLiter && !totalCost) {
      totalCost = Math.round(liters * pricePerLiter * 100) / 100;
    } else if (totalCost && liters && !pricePerLiter && liters > 0) {
      pricePerLiter = Math.round((totalCost / liters) * 1000) / 1000;
    } else if (totalCost && pricePerLiter && !liters && pricePerLiter > 0) {
      liters = Math.round((totalCost / pricePerLiter) * 100) / 100;
    }

    let rawStation = typeof parsed.station === 'string' && parsed.station.trim().length > 0
      ? parsed.station.trim()
      : null;

    const rawAddress = (typeof parsed.stationAddress === 'string' && parsed.stationAddress.trim().length > 0)
      ? parsed.stationAddress.trim()
      : (typeof parsed.address === 'string' && parsed.address.trim().length > 0)
        ? parsed.address.trim()
        : (typeof parsed.station_address === 'string' && parsed.station_address.trim().length > 0)
          ? parsed.station_address.trim()
          : (typeof parsed.location === 'string' && parsed.location.trim().length > 0)
            ? parsed.location.trim()
            : null;

    let stationAddress = formatAddress(rawAddress);

    // If station field contains the address (e.g. "Fieten Olie, Eeser Gaard 2, 8332 VN Steenwijk"), extract it
    if (rawStation && /\d{4}\s?[A-Za-z]{2}/.test(rawStation)) {
      const extractedAddr = extractDutchAddress(rawStation);
      if (extractedAddr) {
        if (!stationAddress) stationAddress = extractedAddr;
        rawStation = rawStation.replace(/,\s*[A-Za-z\u00C0-\u017F.\s'-]+?\s+\d+[a-zA-Z]?.*$/, '').trim();
      }
    }

    const station = formatStationName(rawStation);

    // Algorithmic safety net: if AI did not populate stationAddress, check if it's anywhere in rawJson
    if (!stationAddress && rawJson) {
      stationAddress = extractDutchAddress(rawJson);
    }

    const fuelType = typeof parsed.fuelType === 'string' && parsed.fuelType.trim().length > 0
      ? parsed.fuelType.trim()
      : null;

    return {
      date,
      liters,
      pricePerLiter,
      totalCost,
      station,
      stationAddress,
      fuelType,
      confidence: 99,
      engine,
      model,
    };
  }

  /**
   * Analyze and translate a maintenance / garage invoice (PDF or image) into the user's preferred language.
   */
  public static async analyzeInvoice(
    filePath: string,
    targetLanguage: 'nl' | 'en' = 'nl'
  ): Promise<AiInvoiceExtraction | null> {
    const settings = this.getActiveSettings();
    if (!this.isConfigured()) {
      return null;
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`Invoice file not found on disk: ${filePath}`);
    }

    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');
    const mimeType = getMimeType(filePath);

    if (settings.provider === 'gemini' && settings.geminiApiKey) {
      return this.analyzeInvoiceWithGemini(
        base64Data,
        mimeType,
        settings.geminiApiKey,
        settings.geminiModel,
        targetLanguage
      );
    }

    if (settings.provider === 'openai' && settings.openaiApiKey) {
      const media = await prepareMediaForOpenAi(fileBuffer, mimeType);
      return this.analyzeInvoiceWithOpenAi(
        media.base64Data,
        media.mimeType,
        settings.openaiApiKey,
        settings.openaiModel,
        settings.openaiBaseUrl,
        targetLanguage
      );
    }

    return null;
  }

  private static getInvoicePrompt(targetLanguage: 'nl' | 'en'): string {
    const langName = targetLanguage === 'nl' ? 'Dutch (Nederlands)' : 'English';
    return `You are an expert automotive workshop invoice parser and technical automotive translator (specializing in German, Dutch, French, English, and European garage invoices).
Extract all maintenance details from this invoice document/image and translate all service descriptions, parts, and labor items into ${langName}.

CRITICAL INSTRUCTIONS:
1. "detectedLanguage": Name of the original language on the invoice written in ${langName} (e.g. "${targetLanguage === 'nl' ? 'Duits (DE)' : 'German (DE)'}", "${targetLanguage === 'nl' ? 'Nederlands (NL)' : 'Dutch (NL)'}", "${targetLanguage === 'nl' ? 'Engels (EN)' : 'English (EN)'}", "${targetLanguage === 'nl' ? 'Frans (FR)' : 'French (FR)'}").
2. "date": Invoice or service date formatted as "YYYY-MM-DD" (convert German/European DD.MM.YYYY or DD-MM-YYYY to YYYY-MM-DD).
3. "odometer": Vehicle mileage / odometer reading on the invoice (look for KM-Stand, Kilometerstand, Laufleistung, Tellerstand, Mileage, Odometer) as a plain integer number (e.g. 54320, without thousand separator dots), or null if not found.
4. "serviceTitle": A clear, concise summary title of the main maintenance service in ${langName} (e.g. "${targetLanguage === 'nl' ? 'Grote Onderhoudsbeurt & Remvloeistof' : 'Major Service & Brake Fluid'}" or "${targetLanguage === 'nl' ? 'Jaarlijkse Inspectie & Oliebeurt' : 'Annual Inspection & Oil Change'}").
5. "garageName": Name of the garage / dealership / workshop (e.g. "Autohaus Müller GmbH").
6. "garageAddress": Complete physical address of the garage including street, house number, postal code, city, and country (e.g. "Industriestraße 12, 48599 Gronau, Duitsland").
7. "totalCost": Total final amount paid including VAT (Brutto / incl. MwSt / incl. BTW) as a number in EUR.
8. "partsCost": Total cost of parts, materials, oil, and fluids (including VAT so partsCost + laborCost = totalCost).
9. "laborCost": Total cost of labor / workshop hours / AW (including VAT so partsCost + laborCost = totalCost).
10. "lineItems": Array of all individual line items on the invoice (parts, fluids, filters, inspections, labor):
   - "originalDescription": Exact original description from the invoice (e.g. "Motoröl 5W-30 Longlife", "Ölfilterpatrone", "Inspektion mit Ölwechsel").
   - "translatedDescription": Accurate technical automotive translation in ${langName} (e.g. "${targetLanguage === 'nl' ? 'Motorolie 5W-30 Longlife' : 'Engine Oil 5W-30 Longlife'}", "${targetLanguage === 'nl' ? 'Oliefilter' : 'Oil Filter'}", "${targetLanguage === 'nl' ? 'Inspectie met olieverversing' : 'Inspection with oil change'}").
   - "category": "parts" (for physical parts, oil, fluids, filters, consumables) or "labor" (for labor, inspection work, diagnostics, work units / AW).
   - "quantity": Quantity string if shown (e.g. "4.2 L", "1 st", "12 AW"), or null.
   - "totalPrice": Line price as a number, or null.
11. "translatedNotes": A concise, well-formatted summary in ${langName} of all work performed and parts replaced.

Return ONLY a valid JSON object matching this exact structure:
{
  "detectedLanguage": string or null,
  "date": "YYYY-MM-DD" or null,
  "odometer": number or null,
  "serviceTitle": string or null,
  "garageName": string or null,
  "garageAddress": string or null,
  "totalCost": number or null,
  "partsCost": number or null,
  "laborCost": number or null,
  "lineItems": [
    {
      "originalDescription": string,
      "translatedDescription": string,
      "category": "parts" | "labor",
      "quantity": string or null,
      "totalPrice": number or null
    }
  ],
  "translatedNotes": string or null
}
Output strictly raw JSON without markdown fences.`;
  }

  private static async analyzeInvoiceWithGemini(
    base64Data: string,
    mimeType: string,
    apiKey: string,
    modelName: string,
    targetLanguage: 'nl' | 'en'
  ): Promise<AiInvoiceExtraction> {
    const promptText = this.getInvoicePrompt(targetLanguage);
    const body = {
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);

    try {
      const requestedModel = modelName || 'gemini-3.8-flash';
      let activeModel = requestedModel;

      let res = await this.postGemini(activeModel, 'v1beta', apiKey, body, controller.signal);

      if (res.status === 404) {
        if (activeModel !== 'gemini-3.8-flash') {
          activeModel = 'gemini-3.8-flash';
          res = await this.postGemini(activeModel, 'v1beta', apiKey, body, controller.signal);
        }
        if (res.status === 404) {
          const available = await this.getAvailableGeminiModels(apiKey);
          const discovered = available.find((m) => m.includes('3.8-flash')) || available.find((m) => m.includes('flash')) || available[0];
          if (discovered && discovered !== activeModel) {
            activeModel = discovered;
            res = await this.postGemini(activeModel, 'v1beta', apiKey, body, controller.signal);
          }
        }
      }

      clearTimeout(timeout);

      if (!res.ok) {
        let errDetail = `Status ${res.status}`;
        try {
          const errJson = await res.json() as any;
          if (errJson?.error?.message) errDetail = errJson.error.message;
        } catch {}
        throw new Error(`Gemini API fout (${res.status}): ${errDetail}`);
      }

      const resJson = await res.json() as any;
      const rawJson = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJson) {
        throw new Error('Gemini API gaf geen resultaat terug voor de factuur');
      }

      return this.normalizeInvoiceResult(rawJson, 'gemini', activeModel, targetLanguage);
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  private static async analyzeInvoiceWithOpenAi(
    base64Data: string,
    mimeType: string,
    apiKey: string,
    modelName: string,
    baseUrl: string | undefined,
    targetLanguage: 'nl' | 'en'
  ): Promise<AiInvoiceExtraction> {
    const model = modelName || 'gpt-4o-mini';
    const effectiveBaseUrl = (baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const endpoint = `${effectiveBaseUrl}/chat/completions`;

    const body = {
      model,
      messages: [
        {
          role: 'system',
          content: this.getInvoicePrompt(targetLanguage),
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract and translate maintenance invoice details.' },
            buildOpenAiMediaPart(base64Data, mimeType),
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI API status ${res.status}: ${errText}${openAiPdfHint(mimeType)}`);
      }

      const resJson = await res.json() as any;
      const rawJson = resJson.choices?.[0]?.message?.content;
      if (!rawJson) {
        throw new Error('OpenAI API gaf geen resultaat terug voor de factuur');
      }

      return this.normalizeInvoiceResult(rawJson, 'openai', model, targetLanguage);
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  public static normalizeInvoiceResult(
    rawJson: string,
    engine: 'gemini' | 'openai',
    model: string,
    targetLanguage: 'nl' | 'en' = 'nl'
  ): AiInvoiceExtraction {
    let clean = rawJson.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    }

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch (err: any) {
      throw new Error(`Failed to parse AI invoice JSON: ${err.message}`);
    }

    // 1. Date normalization (supports YYYY-MM-DD and DD.MM.YYYY / DD-MM-YYYY)
    let date: string | null = null;
    if (parsed.date && typeof parsed.date === 'string') {
      const isoMatch = parsed.date.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
      if (isoMatch) {
        date = `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
      } else {
        const dmyMatch = parsed.date.match(/(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|19\d{2})/);
        if (dmyMatch) {
          date = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
        }
      }
    }

    const parseMoney = (val: any): number | null => {
      if (val === null || val === undefined || val === '') return null;
      if (typeof val === 'number') return isNaN(val) ? null : Math.round(val * 100) / 100;
      let s = String(val).trim();
      // Handle European format like "1.234,56" -> "1234.56"
      if (s.includes('.') && s.includes(',')) {
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
          s = s.replace(/\./g, '').replace(',', '.');
        } else {
          s = s.replace(/,/g, '');
        }
      } else if (s.includes(',')) {
        s = s.replace(',', '.');
      }
      s = s.replace(/[^0-9.-]/g, '');
      const n = parseFloat(s);
      return isNaN(n) ? null : Math.round(n * 100) / 100;
    };

    const parseOdometer = (val: any): number | null => {
      if (val === null || val === undefined || val === '') return null;
      if (typeof val === 'number') {
        if (isNaN(val) || val <= 0) return null;
        return Math.round(val);
      }
      // Strip thousand separators (e.g. "54.320 km" -> "54320")
      const cleaned = String(val).replace(/(\d)[.,](?=\d{3}\b)/g, '$1').replace(/[^0-9]/g, '');
      const n = parseInt(cleaned, 10);
      return isNaN(n) || n <= 0 ? null : n;
    };

    const odometer = parseOdometer(parsed.odometer);

    const lineItems: AiInvoiceLineItem[] = Array.isArray(parsed.lineItems)
      ? parsed.lineItems
          .filter((item: any) => item && (item.translatedDescription || item.originalDescription))
          .map((item: any) => {
            const orig = String(item.originalDescription || item.translatedDescription || '').trim();
            const trans = String(item.translatedDescription || item.originalDescription || '').trim();
            const rawCat = String(item.category || '').toLowerCase();
            const category: 'parts' | 'labor' | 'other' =
              rawCat === 'labor' || rawCat === 'arbeit' || rawCat === 'arbeid'
                ? 'labor'
                : rawCat === 'parts' || rawCat === 'part' || rawCat === 'onderdelen'
                  ? 'parts'
                  : 'parts';
            return {
              originalDescription: orig,
              translatedDescription: trans,
              category,
              quantity: item.quantity ? String(item.quantity).trim() : null,
              totalPrice: parseMoney(item.totalPrice),
            };
          })
      : [];

    let totalCost = parseMoney(parsed.totalCost);
    let partsCost = parseMoney(parsed.partsCost);
    let laborCost = parseMoney(parsed.laborCost);

    // Sum from line items if partsCost or laborCost are missing
    const sumPartsItems = lineItems
      .filter((i) => i.category === 'parts' && i.totalPrice !== null)
      .reduce((acc, i) => acc + (i.totalPrice || 0), 0);
    const sumLaborItems = lineItems
      .filter((i) => i.category === 'labor' && i.totalPrice !== null)
      .reduce((acc, i) => acc + (i.totalPrice || 0), 0);

    if (partsCost === null && sumPartsItems > 0) {
      partsCost = Math.round(sumPartsItems * 100) / 100;
    }
    if (laborCost === null && sumLaborItems > 0) {
      laborCost = Math.round(sumLaborItems * 100) / 100;
    }

    // Reconcile costs if line items were net (excl. VAT) and totalCost is gross (incl. VAT)
    if (totalCost !== null && totalCost > 0) {
      const combined = (partsCost || 0) + (laborCost || 0);
      if (combined > 0 && Math.abs(totalCost - combined) > 1) {
        const ratio = totalCost / combined;
        // If ratio is close to VAT multiplier (e.g. 1.19 German MwSt or 1.21 Dutch BTW) or general difference, scale proportionally
        if (ratio > 1.05 && ratio < 1.35) {
          partsCost = Math.round((partsCost || 0) * ratio * 100) / 100;
          laborCost = Math.round((totalCost - partsCost) * 100) / 100;
        } else if (partsCost !== null && laborCost === null) {
          laborCost = Math.max(0, Math.round((totalCost - partsCost) * 100) / 100);
        } else if (laborCost !== null && partsCost === null) {
          partsCost = Math.max(0, Math.round((totalCost - laborCost) * 100) / 100);
        }
      } else if (combined === 0) {
        partsCost = totalCost;
        laborCost = 0;
      }
    } else if ((partsCost || 0) + (laborCost || 0) > 0) {
      totalCost = Math.round(((partsCost || 0) + (laborCost || 0)) * 100) / 100;
    }

    const serviceTitle =
      typeof parsed.serviceTitle === 'string' && parsed.serviceTitle.trim().length > 0
        ? parsed.serviceTitle.trim()
        : lineItems.length > 0
          ? lineItems.slice(0, 2).map((i) => i.translatedDescription).join(' & ')
          : targetLanguage === 'nl'
            ? 'Onderhoudsbeurt & Inspectie'
            : 'Maintenance & Inspection';

    const garageName =
      typeof parsed.garageName === 'string' && parsed.garageName.trim().length > 0
        ? parsed.garageName.trim()
        : null;

    const garageAddress =
      typeof parsed.garageAddress === 'string' && parsed.garageAddress.trim().length > 0
        ? parsed.garageAddress.trim()
        : null;

    const detectedLanguage =
      typeof parsed.detectedLanguage === 'string' && parsed.detectedLanguage.trim().length > 0
        ? parsed.detectedLanguage.trim()
        : null;

    let translatedNotes =
      typeof parsed.translatedNotes === 'string' && parsed.translatedNotes.trim().length > 0
        ? parsed.translatedNotes.trim()
        : null;

    if (!translatedNotes && lineItems.length > 0) {
      translatedNotes = lineItems
        .map((i) => {
          const priceStr = i.totalPrice !== null ? ` (€${i.totalPrice.toFixed(2)})` : '';
          return `• ${i.translatedDescription}${priceStr}`;
        })
        .join('\n');
    }

    return {
      date,
      odometer,
      serviceTitle,
      garageName,
      garageAddress,
      detectedLanguage,
      totalCost,
      partsCost,
      laborCost,
      lineItems,
      translatedNotes,
      engine,
      model,
    };
  }
}

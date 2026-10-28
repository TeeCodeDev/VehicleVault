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
            availableModels = resJson.models
              .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
              .map((m: any) => m.name.replace(/^models\//, ''))
              .sort((a: string, b: string) => {
                if (a.includes('3.8-flash')) return -1;
                if (b.includes('3.8-flash')) return 1;
                if (a.includes('flash') && !b.includes('flash')) return -1;
                if (!a.includes('flash') && b.includes('flash')) return 1;
                return a.localeCompare(b);
              });
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
      return this.analyzeWithOpenAi(
        base64Data,
        mimeType,
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

      return data.models
        .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map((m: any) => m.name.replace(/^models\//, ''))
        .sort((a: string, b: string) => {
          if (a.includes('3.8-flash')) return -1;
          if (b.includes('3.8-flash')) return 1;
          if (a.includes('flash') && !b.includes('flash')) return -1;
          if (!a.includes('flash') && b.includes('flash')) return 1;
          return a.localeCompare(b);
        });
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
Return ONLY a valid JSON object with the following fields:
{
  "date": "YYYY-MM-DD" or null,
  "liters": number (volume in liters, e.g. 37.41) or null,
  "pricePerLiter": number (unit price in EUR, e.g. 2.159) or null,
  "totalCost": number (total amount paid in EUR, e.g. 80.77) or null,
  "station": string (name/brand of petrol station in Title Case, e.g. "Fieten Olie", "Shell", "TotalEnergies", never ALL CAPS) or null,
  "stationAddress": string (street address, house number, postal code and city/town found on receipt header or footer, e.g. "Eeser Gaard 2, 8332 VN Steenwijk") or null,
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
Extract transaction details from the receipt image and return ONLY a valid JSON object with the following fields:
{
  "date": "YYYY-MM-DD" or null,
  "liters": number (volume in liters, e.g. 37.41) or null,
  "pricePerLiter": number (unit price in EUR, e.g. 2.159) or null,
  "totalCost": number (total amount paid in EUR, e.g. 80.77) or null,
  "station": string (name/brand of petrol station in Title Case, e.g. "Fieten Olie", "Shell", "TotalEnergies", never ALL CAPS) or null,
  "stationAddress": string (street address, house number, postal code and city/town found on receipt header or footer, e.g. "Eeser Gaard 2, 8332 VN Steenwijk") or null,
  "fuelType": string (e.g. "Euro 95 Ongelood", "Diesel", "SuperPlus 98") or null
}`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract fuel receipt details.' },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`,
              },
            },
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
        throw new Error(`OpenAI API returned status ${res.status}: ${errText}`);
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

    const station = formatStationName(
      typeof parsed.station === 'string' && parsed.station.trim().length > 0
        ? parsed.station.trim()
        : null
    );

    const rawAddress = (typeof parsed.stationAddress === 'string' && parsed.stationAddress.trim().length > 0)
      ? parsed.stationAddress.trim()
      : (typeof parsed.address === 'string' && parsed.address.trim().length > 0)
        ? parsed.address.trim()
        : (typeof parsed.station_address === 'string' && parsed.station_address.trim().length > 0)
          ? parsed.station_address.trim()
          : null;

    const stationAddress = formatAddress(rawAddress);

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
}

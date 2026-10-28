import { Request, Response } from 'express';
import {
  AiReceiptService,
  getSystemSetting,
  setSystemSetting,
  maskApiKey,
} from '../services/aiReceiptService.js';

export class SettingsController {
  public static async getAiSettings(_req: Request, res: Response): Promise<void> {
    try {
      const settings = AiReceiptService.getActiveSettings();
      const hasGeminiKey = Boolean(settings.geminiApiKey && settings.geminiApiKey.trim().length > 0);
      const hasOpenaiKey = Boolean(settings.openaiApiKey && settings.openaiApiKey.trim().length > 0);

      res.json({
        provider: settings.provider,
        geminiModel: settings.geminiModel,
        hasGeminiKey,
        geminiKeyMasked: maskApiKey(settings.geminiApiKey),
        openaiModel: settings.openaiModel,
        openaiBaseUrl: settings.openaiBaseUrl,
        hasOpenaiKey,
        openaiKeyMasked: maskApiKey(settings.openaiApiKey),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to retrieve AI settings' });
    }
  }

  public static async updateAiSettings(req: Request, res: Response): Promise<void> {
    try {
      const {
        provider,
        geminiApiKey,
        geminiModel,
        openaiApiKey,
        openaiModel,
        openaiBaseUrl,
        clearGeminiKey,
        clearOpenaiKey,
      } = req.body;

      if (provider && ['gemini', 'openai', 'none'].includes(provider)) {
        setSystemSetting('ai_provider', provider);
      }

      if (geminiModel && typeof geminiModel === 'string') {
        setSystemSetting('gemini_model', geminiModel.trim());
      }

      // Explicit clear if requested
      if (clearGeminiKey === true) {
        setSystemSetting('gemini_api_key', '');
      } else if (typeof geminiApiKey === 'string') {
        const trimmed = geminiApiKey.trim();
        // Only overwrite if user actually typed a new non-empty key (not masked placeholder)
        if (trimmed.length > 0 && !trimmed.includes('••••') && !trimmed.includes('...')) {
          setSystemSetting('gemini_api_key', trimmed);
        }
      }

      if (openaiModel && typeof openaiModel === 'string') {
        setSystemSetting('openai_model', openaiModel.trim());
      }

      if (typeof openaiBaseUrl === 'string') {
        setSystemSetting('openai_base_url', openaiBaseUrl.trim());
      }

      if (clearOpenaiKey === true) {
        setSystemSetting('openai_api_key', '');
      } else if (typeof openaiApiKey === 'string') {
        const trimmed = openaiApiKey.trim();
        // Only overwrite if user actually typed a new non-empty key (not masked placeholder)
        if (trimmed.length > 0 && !trimmed.includes('••••') && !trimmed.includes('...')) {
          setSystemSetting('openai_api_key', trimmed);
        }
      }

      res.json({
        success: true,
        message: 'AI configuratie succesvol opgeslagen',
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update AI settings' });
    }
  }

  public static async testAiConnection(req: Request, res: Response): Promise<void> {
    try {
      const { provider, apiKey, model, baseUrl } = req.body;

      if (!provider || !['gemini', 'openai'].includes(provider)) {
        res.status(400).json({ success: false, message: 'Selecteer een geldige AI provider (Gemini of OpenAI).' });
        return;
      }

      // If key is masked or empty string, pass undefined so service tests the stored/env key
      const trimmedKey = typeof apiKey === 'string' ? apiKey.trim() : '';
      const testKey = (trimmedKey.length > 0 && !trimmedKey.includes('••••') && !trimmedKey.includes('...'))
        ? trimmedKey
        : undefined;

      const result = await AiReceiptService.testConnection(provider, testKey, model, baseUrl);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: `Fout tijdens verbindingstest: ${err?.message || 'Onbekende fout'}`,
      });
    }
  }
}

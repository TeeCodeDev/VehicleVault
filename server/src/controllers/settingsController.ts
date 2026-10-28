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
      } = req.body;

      if (provider && ['gemini', 'openai', 'none'].includes(provider)) {
        setSystemSetting('ai_provider', provider);
      }

      if (geminiModel && typeof geminiModel === 'string') {
        setSystemSetting('gemini_model', geminiModel.trim());
      }

      // Only overwrite API key if user provided a new key (not empty, not masked)
      if (typeof geminiApiKey === 'string') {
        const trimmed = geminiApiKey.trim();
        if (trimmed.length > 0 && !trimmed.includes('••••') && !trimmed.includes('...')) {
          setSystemSetting('gemini_api_key', trimmed);
        } else if (trimmed === '') {
          setSystemSetting('gemini_api_key', '');
        }
      }

      if (openaiModel && typeof openaiModel === 'string') {
        setSystemSetting('openai_model', openaiModel.trim());
      }

      if (typeof openaiBaseUrl === 'string') {
        setSystemSetting('openai_base_url', openaiBaseUrl.trim());
      }

      if (typeof openaiApiKey === 'string') {
        const trimmed = openaiApiKey.trim();
        if (trimmed.length > 0 && !trimmed.includes('••••') && !trimmed.includes('...')) {
          setSystemSetting('openai_api_key', trimmed);
        } else if (trimmed === '') {
          setSystemSetting('openai_api_key', '');
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

      // If key is masked or empty, pass undefined so service tests the stored/env key
      const testKey = (apiKey && !apiKey.includes('••••') && !apiKey.includes('...')) ? apiKey : undefined;

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


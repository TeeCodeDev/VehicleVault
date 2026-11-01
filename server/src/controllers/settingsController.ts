import { Request, Response } from 'express';
import {
  AiReceiptService,
  getSystemSetting,
  setSystemSetting,
  maskApiKey,
} from '../services/aiReceiptService.js';
import { isAuthDisabled } from '../middleware/auth.js';
import { env } from '../config/env.js';

export class SettingsController {
  public static async getAiSettings(_req: Request, res: Response): Promise<void> {
    try {
      const settings = AiReceiptService.getActiveSettings();
      const hasGeminiKey = Boolean(settings.geminiApiKey && settings.geminiApiKey.trim().length > 0);
      const hasOpenaiKey = Boolean(settings.openaiApiKey && settings.openaiApiKey.trim().length > 0);

      let availableGeminiModels: string[] = [];
      if (hasGeminiKey && settings.geminiApiKey) {
        try {
          availableGeminiModels = await AiReceiptService.getAvailableGeminiModels(settings.geminiApiKey);
        } catch {}
      }

      const dbGemini = getSystemSetting('gemini_api_key');
      const envGemini = process.env.GEMINI_API_KEY;
      const geminiSource = dbGemini ? 'database' : (envGemini ? 'env' : null);
      const geminiSuffix = settings.geminiApiKey ? settings.geminiApiKey.trim().slice(-4) : null;

      const dbOpenai = getSystemSetting('openai_api_key');
      const envOpenai = process.env.OPENAI_API_KEY;
      const openaiSource = dbOpenai ? 'database' : (envOpenai ? 'env' : null);
      const openaiSuffix = settings.openaiApiKey ? settings.openaiApiKey.trim().slice(-4) : null;

      res.json({
        provider: settings.provider,
        geminiModel: settings.geminiModel,
        hasGeminiKey,
        geminiKeyMasked: maskApiKey(settings.geminiApiKey),
        geminiKeySuffix: geminiSuffix,
        geminiKeySource: geminiSource,
        availableGeminiModels,
        openaiModel: settings.openaiModel,
        openaiBaseUrl: settings.openaiBaseUrl,
        hasOpenaiKey,
        openaiKeyMasked: maskApiKey(settings.openaiApiKey),
        openaiKeySuffix: openaiSuffix,
        openaiKeySource: openaiSource,
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

  public static async getGeminiModels(req: Request, res: Response): Promise<void> {
    try {
      const apiKeyQuery = req.query.apiKey as string | undefined;
      const settings = AiReceiptService.getActiveSettings();
      const trimmedQuery = typeof apiKeyQuery === 'string' ? apiKeyQuery.trim() : '';
      const effectiveKey = (trimmedQuery.length > 0 && !trimmedQuery.includes('••••') && !trimmedQuery.includes('...'))
        ? trimmedQuery
        : settings.geminiApiKey;

      if (!effectiveKey) {
        res.status(400).json({ error: 'Geen API-sleutel beschikbaar om modellen op te halen' });
        return;
      }

      const models = await AiReceiptService.getAvailableGeminiModels(effectiveKey);
      res.json({ models });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Fout bij ophalen van Gemini modellen' });
    }
  }

  public static async getSecuritySettings(_req: Request, res: Response): Promise<void> {
    try {
      const isEnvEnforced = env.DISABLE_AUTH;
      const disableAuth = isAuthDisabled();
      res.json({
        disableAuth,
        isEnvEnforced,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Fout bij ophalen van beveiligingsinstellingen' });
    }
  }

  public static async updateSecuritySettings(req: Request, res: Response): Promise<void> {
    try {
      const { disableAuth } = req.body;
      const isEnvEnforced = env.DISABLE_AUTH;
      if (isEnvEnforced) {
        res.status(400).json({
          error: 'Inloggen is geconfigureerd via omgevingsvariabele (DISABLE_AUTH) en kan niet worden gewijzigd via de webinterface.',
        });
        return;
      }

      setSystemSetting('disable_auth', disableAuth ? 'true' : 'false');
      res.json({
        success: true,
        disableAuth: Boolean(disableAuth),
        message: disableAuth
          ? 'Inloggen is succesvol uitgeschakeld. Je hebt nu direct toegang zonder wachtwoord (ideaal voor Pangolin / Reverse Proxy).'
          : 'Inloggen is weer ingeschakeld.',
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Fout bij opslaan van beveiligingsinstellingen' });
    }
  }

  public static async getModuleSettings(_req: Request, res: Response): Promise<void> {
    try {
      const defaultModules = {
        fuel: true,
        trips: true,
        maintenance: true,
        tires: true,
        fixedExpenses: true,
        documents: true,
        vignettes: true,
        analytics: true,
      };

      const raw = getSystemSetting('enabled_modules');
      let modules = defaultModules;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          modules = { ...defaultModules, ...parsed };
        } catch {}
      }

      res.json({ modules });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Fout bij ophalen van module-instellingen' });
    }
  }

  public static async updateModuleSettings(req: Request, res: Response): Promise<void> {
    try {
      const { modules } = req.body;
      if (!modules || typeof modules !== 'object') {
        res.status(400).json({ error: 'Modules object is verplicht' });
        return;
      }

      const defaultModules = {
        fuel: true,
        trips: true,
        maintenance: true,
        tires: true,
        fixedExpenses: true,
        documents: true,
        vignettes: true,
        analytics: true,
      };

      const updated = {
        ...defaultModules,
        ...modules,
      };

      setSystemSetting('enabled_modules', JSON.stringify(updated));
      res.json({
        success: true,
        modules: updated,
        message: 'Module-instellingen succesvol opgeslagen',
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Fout bij opslaan van module-instellingen' });
    }
  }
}

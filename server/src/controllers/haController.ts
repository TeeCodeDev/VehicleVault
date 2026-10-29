import { Request, Response } from 'express';
import { HaService } from '../services/haService.js';

export class HaController {
  public static getSensors(_req: Request, res: Response): void {
    try {
      const payload = HaService.getSensorsPayload();
      res.json(payload);
    } catch (err: any) {
      console.error('Home Assistant sensors endpoint error:', err);
      res.status(500).json({ error: 'Failed to retrieve Home Assistant sensors data' });
    }
  }
}


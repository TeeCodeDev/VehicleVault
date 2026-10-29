import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../db/database.js';

export class ExpenseController {
  public static async list(req: Request, res: Response): Promise<void> {
    try {
      const { vehicleId } = req.query;
      if (!vehicleId || typeof vehicleId !== 'string') {
        res.status(400).json({ error: 'vehicleId query parameter is required' });
        return;
      }

      const expenses = db.query(
        'SELECT * FROM recurring_expenses WHERE vehicle_id = ? ORDER BY is_active DESC, created_at DESC',
        [vehicleId]
      );

      // Compute monthly normalized cost for active expenses
      let monthlyTotal = 0;
      for (const e of expenses) {
        if (e.is_active) {
          if (e.frequency === 'monthly') monthlyTotal += e.amount;
          else if (e.frequency === 'quarterly') monthlyTotal += e.amount / 3;
          else if (e.frequency === 'yearly') monthlyTotal += e.amount / 12;
        }
      }

      res.json({
        expenses,
        monthlyTotal: Math.round(monthlyTotal * 100) / 100,
        yearlyTotal: Math.round(monthlyTotal * 12 * 100) / 100,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to list recurring expenses' });
    }
  }

  public static async create(req: Request, res: Response): Promise<void> {
    try {
      const {
        vehicleId,
        name,
        category = 'other',
        frequency = 'monthly',
        amount,
        startDate,
        endDate = null,
        isActive = 1,
        notes = '',
      } = req.body;

      if (!vehicleId || !name || amount === undefined || !startDate) {
        res.status(400).json({ error: 'vehicleId, name, amount and startDate are required' });
        return;
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      db.run(
        `INSERT INTO recurring_expenses (
          id, vehicle_id, name, category, frequency, amount, start_date, end_date, is_active, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, vehicleId, name.trim(), category, frequency, Number(amount), startDate, endDate || null, isActive ? 1 : 0, notes || null, now]
      );

      const created = db.get('SELECT * FROM recurring_expenses WHERE id = ?', [id]);
      res.status(201).json({ expense: created });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to create recurring expense' });
    }
  }

  public static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        name,
        category,
        frequency,
        amount,
        startDate,
        endDate,
        isActive,
        notes,
      } = req.body;

      const existing = db.get('SELECT * FROM recurring_expenses WHERE id = ?', [id]);
      if (!existing) {
        res.status(404).json({ error: 'Expense not found' });
        return;
      }

      db.run(
        `UPDATE recurring_expenses SET
          name = COALESCE(?, name),
          category = COALESCE(?, category),
          frequency = COALESCE(?, frequency),
          amount = COALESCE(?, amount),
          start_date = COALESCE(?, start_date),
          end_date = ?,
          is_active = COALESCE(?, is_active),
          notes = COALESCE(?, notes)
        WHERE id = ?`,
        [
          name !== undefined ? name.trim() : null,
          category ?? null,
          frequency ?? null,
          amount !== undefined ? Number(amount) : null,
          startDate ?? null,
          endDate !== undefined ? (endDate || null) : existing.end_date,
          isActive !== undefined ? (isActive ? 1 : 0) : null,
          notes ?? null,
          id,
        ]
      );

      const updated = db.get('SELECT * FROM recurring_expenses WHERE id = ?', [id]);
      res.json({ expense: updated });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update recurring expense' });
    }
  }

  public static async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = db.run('DELETE FROM recurring_expenses WHERE id = ?', [id]);
      if (result.changes === 0) {
        res.status(404).json({ error: 'Expense not found' });
        return;
      }
      res.json({ message: 'Recurring expense deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to delete recurring expense' });
    }
  }
}

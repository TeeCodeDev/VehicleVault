import { apiFetch } from '../api/client.js';

export interface QueuedFuelEntry {
  id: string; // temporary client ID
  vehicle_id: string;
  date: string;
  odometer: number;
  liters: number;
  price_per_liter: number;
  total_cost: number;
  is_full_tank: boolean;
  missed_previous: boolean;
  notes?: string | null;
  queuedAt: string;
}

const STORAGE_KEY = 'vv_offline_fuel_queue';

export function getOfflineFuelQueue(): QueuedFuelEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: QueuedFuelEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('vv_offline_queue_changed', { detail: { count: queue.length } }));
  } catch (err) {
    console.error('Failed to save offline queue:', err);
  }
}

export function addToOfflineQueue(entry: Omit<QueuedFuelEntry, 'id' | 'queuedAt'>): QueuedFuelEntry {
  const queue = getOfflineFuelQueue();
  const queuedItem: QueuedFuelEntry = {
    ...entry,
    id: 'offline_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    queuedAt: new Date().toISOString(),
  };
  queue.push(queuedItem);
  saveOfflineQueue(queue);
  return queuedItem;
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('vv_offline_queue_changed', { detail: { count: 0 } }));
}

export async function syncOfflineQueue(): Promise<{ syncedCount: number; errors: any[] }> {
  const queue = getOfflineFuelQueue();
  if (queue.length === 0) {
    return { syncedCount: 0, errors: [] };
  }

  const remaining: QueuedFuelEntry[] = [];
  let syncedCount = 0;
  const errors: any[] = [];

  for (const item of queue) {
    try {
      await apiFetch('/api/fuel', {
        method: 'POST',
        body: JSON.stringify({
          vehicle_id: item.vehicle_id,
          date: item.date,
          odometer: item.odometer,
          liters: item.liters,
          price_per_liter: item.price_per_liter,
          total_cost: item.total_cost,
          is_full_tank: item.is_full_tank,
          missed_previous: item.missed_previous,
          notes: item.notes,
        }),
      });
      syncedCount++;
    } catch (err) {
      remaining.push(item);
      errors.push(err);
    }
  }

  saveOfflineQueue(remaining);
  return { syncedCount, errors };
}

// Auto-sync listener when browser reconnects to network
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    console.log('[VehicleVault PWA] Network restored. Syncing offline entries...');
    try {
      const result = await syncOfflineQueue();
      if (result.syncedCount > 0) {
        window.dispatchEvent(
          new CustomEvent('vv_offline_synced', { detail: { count: result.syncedCount } })
        );
      }
    } catch (e) {
      console.error('[VehicleVault PWA] Auto-sync error:', e);
    }
  });
}


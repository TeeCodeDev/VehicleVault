import { ToadScheduler, SimpleIntervalJob, AsyncTask } from 'toad-scheduler';
import { NotificationService } from './notificationService.js';
import { TelematicsService } from './telematicsService.js';
import { BackupService } from './backupService.js';
import { logger } from '../utils/logger.js';

export class SchedulerService {
  private static scheduler: ToadScheduler | null = null;
  private static isInitialized = false;

  public static initialize(): void {
    if (this.isInitialized) return;

    this.scheduler = new ToadScheduler();

    // 1. Daily Notification and Document / APK Expiration Alert Task
    const alertTask = new AsyncTask(
      'daily-vehicle-alerts',
      async () => {
        try {
          logger.info('Scheduler: Running automated vehicle alerts check...');
          const result = await NotificationService.checkAndDispatchAlerts();
          logger.info({ alertsSent: result.alertsSent }, 'Scheduler: Alerts check completed');
        } catch (err: any) {
          logger.error({ err: err?.message }, 'Scheduler: Error checking vehicle alerts');
        }
      },
      (err: Error) => {
        logger.error({ err: err.message }, 'Scheduler: Unhandled task error in vehicle alerts');
      }
    );

    // Run every 6 hours (and soon after boot via initial execution if needed)
    const alertJob = new SimpleIntervalJob({ hours: 6, runImmediately: false }, alertTask, {
      id: 'job-vehicle-alerts',
      preventOverrun: true,
    });

    this.scheduler.addSimpleIntervalJob(alertJob);

    // 2. Daily Telematics & Odometer Sync (Home Assistant / Kia Connect etc.)
    const telematicsTask = new AsyncTask(
      'daily-telematics-sync',
      async () => {
        try {
          logger.info('Scheduler: Running daily telematics odometer sync...');
          const result = await TelematicsService.syncAllVehicles(undefined, 'scheduler');
          logger.info(result, 'Scheduler: Telematics sync completed');
        } catch (err: any) {
          logger.error({ err: err?.message }, 'Scheduler: Error in telematics sync');
        }
      },
      (err: Error) => {
        logger.error({ err: err.message }, 'Scheduler: Unhandled error in telematics sync');
      }
    );

    // Run every 12 hours
    const telematicsJob = new SimpleIntervalJob({ hours: 12, runImmediately: false }, telematicsTask, {
      id: 'job-telematics-sync',
      preventOverrun: true,
    });

    this.scheduler.addSimpleIntervalJob(telematicsJob);

    // 3. Scheduled Automatic Backup Check (hourly check against configured interval)
    const autoBackupTask = new AsyncTask(
      'auto-backup-check',
      async () => {
        try {
          const ran = await BackupService.runScheduledBackupIfDue();
          if (ran) {
            logger.info('Scheduler: Scheduled automatic backup created successfully');
          }
        } catch (err: any) {
          logger.error({ err: err?.message }, 'Scheduler: Error creating automatic backup');
        }
      },
      (err: Error) => {
        logger.error({ err: err.message }, 'Scheduler: Unhandled error in auto-backup task');
      }
    );

    const autoBackupJob = new SimpleIntervalJob({ hours: 1, runImmediately: false }, autoBackupTask, {
      id: 'job-auto-backup',
      preventOverrun: true,
    });

    this.scheduler.addSimpleIntervalJob(autoBackupJob);

    this.isInitialized = true;
    logger.info('ToadScheduler: Initialized background tasks (vehicle alerts, telematics & auto-backup)');
  }

  public static stop(): void {
    if (this.scheduler) {
      this.scheduler.stop();
      this.scheduler = null;
      this.isInitialized = false;
      logger.info('ToadScheduler: Background tasks stopped gracefully');
    }
  }

  public static getStatus(): { isRunning: boolean; jobCount: number } {
    return {
      isRunning: this.isInitialized && this.scheduler !== null,
      jobCount: this.scheduler ? 3 : 0,
    };
  }
}


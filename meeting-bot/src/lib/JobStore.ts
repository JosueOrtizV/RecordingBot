import { Logger } from 'winston';
import { KnownError } from '../error';
import { getErrorType } from '../util/logger';

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

export class JobStore {
  private activeJobs: number = 0;
  private maxConcurrentJobs: number;
  private shutdownRequested: boolean = false;

  constructor(maxConcurrentJobs: number = 4) {
    this.maxConcurrentJobs = maxConcurrentJobs;
  }

  async addJob<T>(
    task: () => Promise<T>, 
    logger: Logger,
    retryCount: number = 0,
    onPermanentFailure?: (error: unknown) => Promise<void> | void,
    onCompleted?: () => Promise<void> | void
  ): Promise<{ accepted: boolean }> {
    if (this.activeJobs >= this.maxConcurrentJobs || this.shutdownRequested) {
      logger.warn(`Job rejected: activeJobs=${this.activeJobs}, maxConcurrent=${this.maxConcurrentJobs}, shutdown=${this.shutdownRequested}`);
      return { accepted: false };
    }

    this.activeJobs++;
    logger.info(`Job accepted! Active jobs: ${this.activeJobs}/${this.maxConcurrentJobs}`);
    
    // Execute the task asynchronously without waiting for completion
    this.executeTaskWithRetry(task, logger, retryCount).then(async () => {
      logger.info('LogBasedMetric Bot has finished recording meeting successfully.');
      if (onCompleted) {
        try {
          await onCompleted();
        } catch (completionCallbackError) {
          logger.warn('Meeting completion callback failed', completionCallbackError as any);
        }
      }
    }).catch(async (error) => {
      const errorType = getErrorType(error);
      if (error instanceof KnownError) {
        logger.error('KnownError JobStore is permanently exiting:', { error });
      } else {
        logger.error('Error executing task after multiple retries:', { error });
      }
      logger.error(`LogBasedMetric Bot has permanently failed. [errorType: ${errorType}]`);
      if (onPermanentFailure) {
        try {
          await onPermanentFailure(error);
        } catch (failureNotificationError) {
          logger.warn('Meeting failure notification failed', failureNotificationError as any);
        }
      }
    }).finally(() => {
      this.activeJobs = Math.max(0, this.activeJobs - 1);
      logger.info(`Job completed/cleaned up. Active jobs remaining: ${this.activeJobs}/${this.maxConcurrentJobs}`);
    });

    logger.info('LogBasedMetric Bot job has been queued and started recording meeting.');
    return { accepted: true };
  }

  private async executeTaskWithRetry<T>(
    task: () => Promise<T>,
    logger: Logger,
    retryCount: number
  ): Promise<void> {
    try {
      await task();
    } catch (error) {
      if (error instanceof KnownError && !error.retryable) {
        logger.error('KnownError is not retryable:', error.name, error.message);
        throw error;
      }

      if (error instanceof KnownError && error.retryable && (retryCount + 1) >= error.maxRetries) {
        logger.error(`KnownError: ${error.maxRetries} tries consumed:`, error.name, error.message);
        throw error;
      }

      retryCount += 1;
      await sleep(retryCount * 30000);
      if (retryCount < 3) {
        if (retryCount) {
          logger.warn(`Retry count: ${retryCount}`);
        }
        await this.executeTaskWithRetry(task, logger, retryCount);
      } else {
        throw error;
      }
    }
  }

  isBusy(): boolean {
    return this.activeJobs >= this.maxConcurrentJobs;
  }

  getActiveJobCount(): number {
    return this.activeJobs;
  }

  getMaxConcurrentJobs(): number {
    return this.maxConcurrentJobs;
  }

  getCapacityInfo(): { active: number; max: number; available: number } {
    return {
      active: this.activeJobs,
      max: this.maxConcurrentJobs,
      available: Math.max(0, this.maxConcurrentJobs - this.activeJobs),
    };
  }

  /**
   * Check if shutdown has been requested
   */
  isShutdownRequested(): boolean {
    return this.shutdownRequested;
  }

  /**
   * Request graceful shutdown - prevents new jobs from being accepted
   */
  requestShutdown(): void {
    this.shutdownRequested = true;
  }

  /**
   * Wait for ongoing tasks to complete
   * @returns Promise that resolves when all tasks are complete
   */
  async waitForCompletion(): Promise<void> {
    if (this.activeJobs === 0) {
      return; // No tasks running, can shutdown immediately
    }

    console.log(`Waiting for ${this.activeJobs} ongoing task(s) to complete...`);
    
    return new Promise<void>((resolve) => {
      const checkCompletion = () => {
        if (this.activeJobs === 0) {
          console.log('All tasks completed successfully');
          resolve();
        } else {
          setTimeout(checkCompletion, 1000); // Check every 1 second
        }
      };
      checkCompletion();
    });
  }
} 

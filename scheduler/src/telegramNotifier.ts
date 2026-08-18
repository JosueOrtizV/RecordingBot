import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { config } from './config';
import { logger } from './logger';

const execFileAsync = promisify(execFile);

export async function sendTelegramAlert(message: string): Promise<void> {
  logger.info(`[Telegram Alert]: ${message}`);

  const scriptPath = config.telegramAlertScript;
  if (fs.existsSync(scriptPath)) {
    try {
      await execFileAsync(scriptPath, [message]);
      logger.info('Successfully executed telegram alert script');
    } catch (err: any) {
      logger.warn('Failed to execute telegram alert script:', err?.message || err);
    }
  } else {
    logger.debug(`Telegram script not found at ${scriptPath}, logging alert only.`);
  }
}

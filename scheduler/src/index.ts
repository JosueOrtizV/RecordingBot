import cron from 'node-cron';
import { logger } from './logger';
import { config } from './config';
import { pollCalendar } from './calendarPoller';
import { getRedisClient } from './jobDispatcher';
import { sendTelegramAlert } from './telegramNotifier';

async function startNotificationListener() {
  const redis = getRedisClient().duplicate();

  logger.info(`Listening for Redis completion notifications on "${config.redisRecordingList}" and "${config.redisFailureList}"...`);

  while (true) {
    try {
      // Blocking pop from both lists
      const result = await redis.brpop(config.redisRecordingList, config.redisFailureList, 0);
      if (!result) continue;

      const [listName, payloadStr] = result;
      const data = JSON.parse(payloadStr);

      if (listName === config.redisRecordingList) {
        const title = data.metadata?.meetingTitle || data.metadata?.namePrefix || 'Reunión';
        const driveUrl = data.blobUrl || data.metadata?.storage?.url || 'Google Drive';

        logger.info('Received recording completion notification:', data);

        await sendTelegramAlert(
          `🎬 *Grabación Completada y Subida a Drive*\n` +
          `📌 Reunión: *${title}*\n` +
          `📁 Enlace: ${driveUrl}\n` +
          `⏱️ Duración: ${data.metadata?.storage?.duration ? Math.round(data.metadata.storage.duration / 60) + ' min' : 'N/A'}`
        );
      } else if (listName === config.redisFailureList) {
        logger.warn('Received recording failure notification:', data);

        const title = data.metadata?.meetingTitle || 'Reunión';
        const reason = data.error || data.message || 'Error desconocido';

        await sendTelegramAlert(
          `⚠️ *Error en Grabación de Reunión*\n` +
          `📌 Reunión: *${title}*\n` +
          `❌ Razón: ${reason}`
        );
      }
    } catch (err: any) {
      logger.error('Error in Redis notification listener:', err?.message || err);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function main() {
  logger.info('=============================================');
  logger.info('    RecordingBot Scheduler & Notifier Init   ');
  logger.info('=============================================');

  // Start Redis completion listener
  startNotificationListener().catch((err) => {
    logger.error('Fatal error in Redis listener:', err);
  });

  // Initial poll
  await pollCalendar();

  // Schedule periodic calendar polling (e.g. every 2 minutes)
  const cronExpression = `*/${config.pollIntervalMinutes} * * * *`;
  logger.info(`Scheduling Calendar poller with cron: "${cronExpression}"`);

  cron.schedule(cronExpression, async () => {
    logger.info('Executing scheduled calendar poll...');
    await pollCalendar();
  });
}

main().catch((err) => {
  logger.error('Fatal scheduler crash:', err);
  process.exit(1);
});

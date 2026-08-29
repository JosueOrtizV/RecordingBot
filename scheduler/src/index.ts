import cron from 'node-cron';
import { logger } from './logger';
import { config } from './config';
import { pollCalendar } from './calendarPoller';
import { getRedisClient } from './jobDispatcher';
import { sendTelegramAlert } from './telegramNotifier';

import { query } from './db';

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
        let driveUrl = '';
        let fileId = '';

        if (data.blobUrl) driveUrl = data.blobUrl;
        else if (data.metadata?.storage?.url) driveUrl = data.metadata.storage.url;
        else if (data.metadata?.storage?.id) {
          fileId = data.metadata.storage.id;
          driveUrl = `https://drive.google.com/file/d/${fileId}/view`;
        } else if (data.metadata?.storage?.fileId) {
          fileId = data.metadata.storage.fileId;
          driveUrl = `https://drive.google.com/file/d/${fileId}/view`;
        }

        const durationSecs = data.metadata?.duration || data.metadata?.storage?.duration || 0;
        const recordingId = data.recordingId || data.metadata?.botId;
        const transcriptText = data.metadata?.transcriptText || data.transcriptText || null;
        const dedupGroupId = data.metadata?.dedupGroupId;

        logger.info('Received recording completion notification:', {
          recordingId,
          title,
          driveUrl,
          durationSecs,
          hasTranscript: Boolean(transcriptText),
        });

        // Update DB
        try {
          if (recordingId) {
            await query(
              `UPDATE recordings
               SET status = 'completed',
                   drive_url = COALESCE(NULLIF($1, ''), drive_url),
                   drive_file_id = COALESCE(NULLIF($2, ''), drive_file_id),
                   duration_seconds = COALESCE($3, duration_seconds),
                   transcript_text = COALESCE($4, transcript_text),
                   completed_at = NOW()
               WHERE id = $5 OR calendar_event_id = $5`,
              [driveUrl, fileId, durationSecs, transcriptText, recordingId]
            );
          }

          // If deduplicated group, update all linked records
          if (dedupGroupId) {
            await query(
              `UPDATE recordings
               SET status = 'completed',
                   drive_url = COALESCE(NULLIF($1, ''), drive_url),
                   drive_file_id = COALESCE(NULLIF($2, ''), drive_file_id),
                   duration_seconds = COALESCE($3, duration_seconds),
                   transcript_text = COALESCE($4, transcript_text),
                   completed_at = NOW()
               WHERE dedup_group_id = $5`,
              [driveUrl, fileId, durationSecs, transcriptText, dedupGroupId]
            );
          }
        } catch (dbErr) {
          logger.warn('Failed to update completed recording in DB:', dbErr);
        }

        await sendTelegramAlert(
          `✅ *Grabación Completada y Subida a Drive*\n` +
          `📌 Reunión: *${title}*\n` +
          `📁 Enlace: ${driveUrl || 'En tu Google Drive'}\n` +
          `⏱️ Duración: ${durationSecs ? Math.round(durationSecs / 60) + ' min' : 'N/A'}`
        );
      } else if (listName === config.redisFailureList) {
        logger.warn('Received recording failure notification:', data);

        const title = data.metadata?.meetingTitle || data.metadata?.namePrefix || data.metadata?.meetingName || 'Reunión';
        const recordingId = data.recordingId || data.metadata?.botId;
        const dedupGroupId = data.metadata?.dedupGroupId;

        let rawReason = '';
        if (typeof data.error === 'string') {
          rawReason = data.error;
        } else if (data.error?.message) {
          rawReason = data.error.message;
        } else if (data.error?.type) {
          rawReason = data.error.type;
        } else if (data.message) {
          rawReason = typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
        } else {
          rawReason = 'Error desconocido';
        }

        // Friendly error messages in Spanish
        let friendlyReason = rawReason;
        const lower = rawReason.toLowerCase();
        if (lower.includes('waitingatlobbyretryerror') || lower.includes('lobby') || lower.includes('could not enter') || lower.includes('admission')) {
          friendlyReason = 'Nadie admitió al bot en la sala de espera (Tiempo de espera agotado)';
        } else if (lower.includes('sign in') || lower.includes('unsupportedmeetingerror')) {
          friendlyReason = 'La reunión requiere inicio de sesión con cuenta de Google';
        } else if (lower.includes('denied') || lower.includes('rechaz')) {
          friendlyReason = 'El acceso del bot fue rechazado por el anfitrión';
        } else if (lower.includes('upload') || lower.includes('recordinguploadfailederror')) {
          friendlyReason = 'La reunión concluyó pero ocurrió un error al subir el video a Google Drive';
        }

        // Update DB
        try {
          if (recordingId) {
            await query(
              `UPDATE recordings
               SET status = 'failed',
                   error_message = $1,
                   completed_at = NOW()
               WHERE id = $2 OR calendar_event_id = $2`,
              [friendlyReason, recordingId]
            );
          }
          if (dedupGroupId) {
            await query(
              `UPDATE recordings
               SET status = 'failed',
                   error_message = $1,
                   completed_at = NOW()
               WHERE dedup_group_id = $2`,
              [friendlyReason, dedupGroupId]
            );
          }
        } catch (dbErr) {
          logger.warn('Failed to update failed recording in DB:', dbErr);
        }

        await sendTelegramAlert(
          `⚠️ *Error en Grabación de Reunión*\n` +
          `📌 Reunión: *${title}*\n` +
          `❌ Razón: ${friendlyReason}`
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

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

        if (!fileId && driveUrl) {
          const match = driveUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || driveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
          if (match) fileId = match[1];
        }

        const durationSecs = data.metadata?.duration || data.metadata?.storage?.duration || 0;
        const botId = data.metadata?.botId || '';
        const eventId = data.metadata?.eventId || '';
        const recordingId = data.recordingId || botId;
        const transcriptText = data.metadata?.transcriptText || data.transcriptText || null;
        const dedupGroupId = data.metadata?.dedupGroupId;

        logger.info('Received recording completion notification:', {
          recordingId,
          botId,
          eventId,
          title,
          driveUrl,
          durationSecs,
          hasTranscript: Boolean(transcriptText),
        });

        // Update DB
        try {
          if (recordingId || botId || eventId) {
            await query(
              `UPDATE recordings
               SET status = 'completed',
                   drive_url = COALESCE(NULLIF($1, ''), drive_url),
                   drive_file_id = COALESCE(NULLIF($2, ''), drive_file_id),
                   duration_seconds = COALESCE($3, duration_seconds),
                   transcript_text = COALESCE($4, transcript_text),
                   completed_at = NOW()
               WHERE id::text = $5 OR calendar_event_id = $5 OR id::text = $6 OR calendar_event_id = $6`,
              [driveUrl, fileId, durationSecs, transcriptText, recordingId, botId || eventId]
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
               WHERE dedup_group_id::text = $5`,
              [driveUrl, fileId, durationSecs, transcriptText, dedupGroupId]
            );
          }
        } catch (dbErr) {
          logger.warn('Failed to update completed recording in DB:', dbErr);
        }

        // Lookup user's telegram_chat_id
        const userId = data.metadata?.userId;
        let userChatId: string | null = null;
        try {
          if (userId) {
            const userRes = await query(
              `SELECT telegram_chat_id FROM user_settings WHERE user_id = $1 AND telegram_chat_id IS NOT NULL AND telegram_chat_id != ''`,
              [userId]
            );
            userChatId = userRes.rows[0]?.telegram_chat_id || null;
          }

          if (!userChatId) {
            const chatRes = await query(
              `SELECT s.telegram_chat_id
               FROM recordings r
               JOIN user_settings s ON s.user_id = r.user_id
               WHERE (r.id::text = $1 OR r.calendar_event_id = $1 OR r.id::text = $2 OR r.calendar_event_id = $2 OR r.dedup_group_id::text = $3)
                 AND s.telegram_chat_id IS NOT NULL AND s.telegram_chat_id != ''
               LIMIT 1`,
              [recordingId || '', botId || eventId || '', dedupGroupId || '']
            );
            userChatId = chatRes.rows[0]?.telegram_chat_id || null;
          }
        } catch (e) {
          logger.warn('Failed to lookup telegram_chat_id:', e);
        }

        if (userChatId) {
          await sendTelegramAlert(
            `✅ *Grabación Completada y Subida a Drive*\n` +
            `📌 Reunión: *${title}*\n` +
            `📁 Enlace: ${driveUrl || 'En tu Google Drive'}\n` +
            `⏱️ Duración: ${durationSecs ? Math.round(durationSecs / 60) + ' min' : 'N/A'}`,
            userChatId
          );
        }
      } else if (listName === config.redisFailureList) {
        logger.warn('Received recording failure notification:', data);

        const title = data.metadata?.meetingTitle || data.metadata?.namePrefix || data.metadata?.meetingName || 'Reunión';
        const botId = data.metadata?.botId || '';
        const eventId = data.metadata?.eventId || '';
        const recordingId = data.recordingId || botId;
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
          if (recordingId || botId || eventId) {
            await query(
              `UPDATE recordings
               SET status = 'failed',
                   error_message = $1,
                   completed_at = NOW()
               WHERE id::text = $2 OR calendar_event_id = $2 OR id::text = $3 OR calendar_event_id = $3`,
              [friendlyReason, recordingId, botId || eventId]
            );
          }
          if (dedupGroupId) {
            await query(
              `UPDATE recordings
               SET status = 'failed',
                   error_message = $1,
                   completed_at = NOW()
               WHERE dedup_group_id::text = $2`,
              [friendlyReason, dedupGroupId]
            );
          }
        } catch (dbErr) {
          logger.warn('Failed to update failed recording in DB:', dbErr);
        }

        // Lookup user's telegram_chat_id
        const userId = data.metadata?.userId;
        let userChatId: string | null = null;
        try {
          if (userId) {
            const userRes = await query(
              `SELECT telegram_chat_id FROM user_settings WHERE user_id = $1 AND telegram_chat_id IS NOT NULL AND telegram_chat_id != ''`,
              [userId]
            );
            userChatId = userRes.rows[0]?.telegram_chat_id || null;
          }

          if (!userChatId) {
            const chatRes = await query(
              `SELECT s.telegram_chat_id
               FROM recordings r
               JOIN user_settings s ON s.user_id = r.user_id
               WHERE (r.id::text = $1 OR r.calendar_event_id = $1 OR r.id::text = $2 OR r.calendar_event_id = $2 OR r.dedup_group_id::text = $3)
                 AND s.telegram_chat_id IS NOT NULL AND s.telegram_chat_id != ''
               LIMIT 1`,
              [recordingId || '', botId || eventId || '', dedupGroupId || '']
            );
            userChatId = chatRes.rows[0]?.telegram_chat_id || null;
          }
        } catch (e) {
          logger.warn('Failed to lookup telegram_chat_id on failure:', e);
        }

        if (userChatId) {
          await sendTelegramAlert(
            `⚠️ *Error en Grabación de Reunión*\n` +
            `📌 Reunión: *${title}*\n` +
            `❌ Razón: ${friendlyReason}`,
            userChatId
          );
        }
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

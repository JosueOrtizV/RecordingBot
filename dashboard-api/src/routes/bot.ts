import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../db.js';
import { config } from '../config.js';
import { pushMeetingJob, getQueueStats, removePendingMeetingJob } from '../services/redisService.js';

const router = Router();

function normalizeMeetingUrl(url: string): string {
  const clean = url.trim();
  return clean.split('?')[0].split('#')[0].replace(/\/+$/, '');
}

// POST /api/bot/join
router.post('/join', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { url, meetingTitle, recordingMode } = req.body;

    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'La URL de la reunión es requerida.' });
      return;
    }

    const cleanUrl = url.trim();
    const canonicalUrl = normalizeMeetingUrl(cleanUrl);
    const meetRegex = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/i;
    if (!meetRegex.test(canonicalUrl)) {
      res.status(400).json({ error: 'URL de Google Meet inválida. Formato esperado: https://meet.google.com/xxx-xxxx-xxx' });
      return;
    }

    // Check if the current user already has an active or pending bot for this meeting
    const userExisting = await query(
      `SELECT id, status, meeting_title, recording_mode
       FROM recordings
       WHERE user_id = $1
         AND meeting_url LIKE $2
         AND status IN ('pending', 'recording')`,
      [user.id, `${canonicalUrl}%`]
    );

    if (userExisting.rows.length > 0) {
      res.status(409).json({
        error: 'Ya tienes un bot en camino o grabando esta reunión.',
        botId: userExisting.rows[0].id,
      });
      return;
    }

    // Fetch user settings and tokens
    const userRes = await query('SELECT name, google_tokens, bot_display_name FROM users WHERE id = $1', [user.id]);
    const settingsRes = await query('SELECT * FROM user_settings WHERE user_id = $1', [user.id]);

    const userRow = userRes.rows[0] || {};
    const defaultBotName = userRow.name ? `${userRow.name}'s Notetaker` : config.botDisplayName;
    const googleTokens = userRow.google_tokens;
    const botDisplayName = userRow.bot_display_name || defaultBotName;
    const settings = settingsRes.rows[0] || {};

    const mode = recordingMode || (settings.enable_video ? 'video' : (settings.enable_audio ? 'audio' : 'transcript_only'));
    const title = meetingTitle?.trim() || 'Reunión On-Demand (Panel)';

    // Check if ANOTHER user already has an active or pending recording for this canonical URL (Deduplication)
    const existingRecordingRes = await query(
      `SELECT id, user_id, owner_user_id, dedup_group_id, recording_mode, status, meeting_title
       FROM recordings
       WHERE meeting_url LIKE $1
         AND status IN ('pending', 'recording')
       ORDER BY created_at ASC
       LIMIT 1`,
      [`${canonicalUrl}%`]
    );

    if (existingRecordingRes.rows.length > 0) {
      const existing = existingRecordingRes.rows[0];
      const dedupGroupId = existing.dedup_group_id || uuidv4();
      const primaryOwnerId = existing.owner_user_id || existing.user_id;

      // If existing recording didn't have dedup_group_id yet, update it now
      if (!existing.dedup_group_id) {
        await query(
          `UPDATE recordings
           SET dedup_group_id = $1, owner_user_id = $2
           WHERE id = $3`,
          [dedupGroupId, primaryOwnerId, existing.id]
        );
      }

      // Pre-create recording entry linked to this dedup group for the joining user
      const newRecordId = uuidv4();
      await query(
        `INSERT INTO recordings (
           id, user_id, owner_user_id, meeting_title, meeting_url,
           recording_mode, status, dedup_group_id, started_at, created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [
          newRecordId,
          user.id,
          primaryOwnerId,
          title,
          canonicalUrl,
          existing.recording_mode,
          existing.status,
          dedupGroupId,
        ]
      );

      const stats = await getQueueStats();

      res.status(200).json({
        success: true,
        botId: newRecordId,
        dedup: true,
        message: 'Ya hay un bot grabando esta reunión. Tu cuenta fue enlazada a la grabación compartida sin duplicar bots.',
        queueDepth: stats.pending,
        estimatedWait: '0 min (Grabando)',
      });
      return;
    }

    // Check server capacity before enqueuing a new bot
    const maxConcurrent = process.env.MAX_CONCURRENT_JOBS ? Number(process.env.MAX_CONCURRENT_JOBS) : 4;
    const activeRes = await query(
      `SELECT COUNT(*) as count FROM recordings WHERE status IN ('pending', 'recording')`
    );
    const totalActive = parseInt(activeRes.rows[0]?.count || '0', 10);
    if (totalActive >= maxConcurrent + 6) {
      res.status(429).json({
        error: 'El servidor se encuentra a máxima capacidad en este momento. Por favor espera a que concluyan algunas reuniones antes de despachar más bots.',
      });
      return;
    }

    const botId = uuidv4();
    const eventId = `manual_${botId.substring(0, 8)}`;

    // Create recording entry in DB
    await query(
      `INSERT INTO recordings (
         id, user_id, owner_user_id, meeting_title, meeting_url,
         calendar_event_id, recording_mode, status, started_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())`,
      [botId, user.id, user.id, title, canonicalUrl, eventId, mode]
    );

    // Build payload for Redis consumer
    const jobPayload = {
      provider: 'google',
      url: canonicalUrl,
      name: botDisplayName,
      botId,
      eventId,
      userId: user.id,
      teamId: 'recording-bot',
      timezone: config.timezone,
      meetingTitle: title,
      recordingMode: mode,
      userTokens: googleTokens, // Pass OAuth tokens directly for Drive upload
      driveFolderName: settings.drive_folder_name || 'RecordingBot',
      startTime: new Date().toISOString(),
    };

    await pushMeetingJob(jobPayload);

    const stats = await getQueueStats();

    res.status(202).json({
      success: true,
      botId,
      message: 'Bot despachado exitosamente hacia la reunión.',
      queueDepth: stats.pending,
      estimatedWait: stats.pending <= 1 ? '0 min (Iniciando)' : `~${stats.pending * 2} min (En cola)`,
    });
  } catch (err: any) {
    console.error('Error in manual bot join:', err);
    res.status(500).json({ error: err.message || 'Error al despachar el bot' });
  }
});

// GET /api/bot/status
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const stats = await getQueueStats();

    // Check all active recordings from DB for global capacity calculation
    const allActiveRes = await query(
      `SELECT r.id, r.meeting_title, r.meeting_url, r.recording_mode, r.started_at, r.user_id, u.name as user_name
       FROM recordings r
       JOIN users u ON u.id = r.user_id
       WHERE r.status IN ('pending', 'recording')
       ORDER BY r.started_at DESC`
    );

    const allActiveRows = allActiveRes.rows;
    // Only return active recordings belonging to the current authenticated user (for privacy)
    const userActiveRows = allActiveRows.filter((r) => r.user_id === userId);

    const videoCount = allActiveRows.filter((r) => r.recording_mode === 'video').length;
    const audioCount = allActiveRows.filter((r) => r.recording_mode === 'audio').length;
    const textCount = allActiveRows.filter((r) => r.recording_mode === 'transcript_only').length;

    // Load calculation (100 = full capacity)
    const loadPercentage = Math.min(100, (videoCount * 45) + (audioCount * 15) + (textCount * 10));
    const availableVideoSlots = Math.max(0, videoCount < 2 && loadPercentage <= 55 ? (2 - videoCount) : 0);
    const availableAudioSlots = Math.max(0, Math.floor((100 - loadPercentage) / 15));

    const maxConcurrent = process.env.MAX_CONCURRENT_JOBS ? Number(process.env.MAX_CONCURRENT_JOBS) : 4;

    let statusLabel = 'Óptima';
    if (loadPercentage >= 90) statusLabel = 'Capacidad Máxima';
    else if (loadPercentage >= 50) statusLabel = 'Moderada';

    res.json({
      workers: {
        total: maxConcurrent,
        active: allActiveRows.length,
        idle: Math.max(0, maxConcurrent - allActiveRows.length),
      },
      capacity: {
        loadPercentage,
        videoCount,
        audioCount,
        textCount,
        maxVideo: 2,
        maxAudio: maxConcurrent,
        availableVideoSlots,
        availableAudioSlots: Math.min(availableAudioSlots, Math.max(0, maxConcurrent - allActiveRows.length)),
        statusLabel,
      },
      queue: stats,
      activeRecordings: userActiveRows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bot/active
router.get('/active', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const activeRes = await query(
      `SELECT id, meeting_title, meeting_url, recording_mode, status, started_at
       FROM recordings
       WHERE user_id = $1 AND status IN ('pending', 'recording')
       ORDER BY started_at DESC`,
      [userId]
    );

    res.json({ active: activeRes.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bot/recordings/:id/stop
router.post('/recordings/:id/stop', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const recordingId = req.params.id;
    const { save = true } = req.body;

    // 1. Verify recording exists and belongs to user
    const recRes = await query(
      `SELECT id, user_id, owner_user_id, status, meeting_title, calendar_event_id, dedup_group_id
       FROM recordings
       WHERE id = $1`,
      [recordingId]
    );

    if (recRes.rows.length === 0) {
      res.status(404).json({ error: 'Grabación no encontrada.' });
      return;
    }

    const rec = recRes.rows[0];

    // Ownership check
    if (rec.user_id !== userId) {
      res.status(403).json({ error: 'No tienes permiso para detener esta grabación.' });
      return;
    }

    // Check if already finished
    if (rec.status === 'completed' || rec.status === 'failed' || rec.status === 'cancelled') {
      res.status(400).json({ error: `La grabación ya se encuentra finalizada (${rec.status}).` });
      return;
    }

    // Handle deduplicated shared meetings
    if (rec.dedup_group_id) {
      const groupActiveRes = await query(
        `SELECT id, user_id, owner_user_id FROM recordings
         WHERE dedup_group_id = $1 AND status IN ('pending', 'recording')`,
        [rec.dedup_group_id]
      );

      const isMultipleActiveUsers = groupActiveRes.rows.length > 1;

      // If user wants to discard without saving (!save) AND other users are still in the meeting:
      if (!save && isMultipleActiveUsers) {
        await query(
          `UPDATE recordings
           SET status = 'cancelled',
               error_message = 'Cancelada por el usuario (los demás continúan grabando)',
               completed_at = NOW()
           WHERE id = $1`,
          [rec.id]
        );

        res.json({
          success: true,
          message: 'Tu cuenta ha sido desvinculada de la grabación compartida. El bot continúa grabando para los demás participantes.',
        });
        return;
      }
    }

    // Check if truly pending in Redis queue
    const removedFromPending = await removePendingMeetingJob(rec.id);
    if (removedFromPending) {
      await query(
        `UPDATE recordings
         SET status = 'cancelled',
             error_message = 'Cancelada por el usuario antes de iniciar',
             completed_at = NOW()
         WHERE id = $1`,
        [rec.id]
      );

      res.json({
        success: true,
        message: 'La reunión estaba en cola y ha sido cancelada exitosamente.',
      });
      return;
    }

    // Case: Bot is active in meeting-bot
    const meetingBotUrl = process.env.MEETING_BOT_URL || 'http://meeting-bot:3000';
    let targetBotId = rec.id;

    // If this is a secondary user in a dedup group, find the primary botId
    if (rec.dedup_group_id && rec.owner_user_id && rec.owner_user_id !== rec.user_id) {
      const primaryRes = await query(
        `SELECT id FROM recordings WHERE user_id = $1 AND dedup_group_id = $2 LIMIT 1`,
        [rec.owner_user_id, rec.dedup_group_id]
      );
      if (primaryRes.rows.length > 0) {
        targetBotId = primaryRes.rows[0].id;
      }
    }

    try {
      await fetch(`${meetingBotUrl}/bot/${targetBotId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ save: Boolean(save) }),
      });
    } catch (botErr) {
      console.error('[Bot Stop] Could not reach meeting-bot HTTP server:', botErr);
    }

    // If discarding without saving, update DB status to cancelled immediately
    if (!save) {
      await query(
        `UPDATE recordings
         SET status = 'cancelled',
             error_message = 'Cancelada por el usuario durante la llamada',
             completed_at = NOW()
         WHERE id = $1`,
        [rec.id]
      );

      if (rec.dedup_group_id) {
        await query(
          `UPDATE recordings
           SET status = 'cancelled',
               error_message = 'Cancelada por el anfitrión durante la llamada',
               completed_at = NOW()
           WHERE dedup_group_id = $1 AND status IN ('pending', 'recording')`,
          [rec.dedup_group_id]
        );
      }

      res.json({
        success: true,
        message: 'Grabación cancelada. El bot ha salido de la llamada y los archivos fueron descartados.',
      });
      return;
    }

    // If saving, status will transition to 'completed' once the bot finishes uploading
    res.json({
      success: true,
      message: 'Detención solicitada. El bot está guardando la reunión y saldrá de la llamada.',
    });
  } catch (err: any) {
    console.error('Error stopping recording:', err);
    res.status(500).json({ error: err?.message || 'Error al detener grabación.' });
  }
});

export default router;

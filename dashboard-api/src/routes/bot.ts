import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../db.js';
import { config } from '../config.js';
import { pushMeetingJob, getQueueStats } from '../services/redisService.js';
import { isEventBlocked } from '../services/calendarService.js';

const router = Router();

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
    const meetRegex = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}([\?#].*)?$/i;
    if (!meetRegex.test(cleanUrl)) {
      res.status(400).json({ error: 'URL de Google Meet inválida. Formato esperado: https://meet.google.com/xxx-xxxx-xxx' });
      return;
    }

    // Check user blocklist
    const blockCheck = await isEventBlocked(user.id, {
      title: meetingTitle,
      url: cleanUrl,
      eventId: 'manual_join',
    });

    if (blockCheck.blocked) {
      res.status(400).json({
        error: `Esta reunión coincide con tu regla de bloqueo: ${blockCheck.reason}. Elimina la regla en Configuración si deseas grabarla.`,
      });
      return;
    }

    // Fetch user settings and tokens
    const userRes = await query('SELECT google_tokens, bot_display_name FROM users WHERE id = $1', [user.id]);
    const settingsRes = await query('SELECT * FROM user_settings WHERE user_id = $1', [user.id]);

    const googleTokens = userRes.rows[0]?.google_tokens;
    const botDisplayName = userRes.rows[0]?.bot_display_name || config.botDisplayName;
    const settings = settingsRes.rows[0] || {};

    const mode = recordingMode || (settings.enable_video ? 'video' : (settings.enable_audio ? 'audio' : 'transcript_only'));
    const title = meetingTitle?.trim() || 'Reunión On-Demand (Panel)';
    const botId = uuidv4();
    const eventId = `manual_${botId.substring(0, 8)}`;

    // Create recording entry in DB
    await query(
      `INSERT INTO recordings (
         id, user_id, owner_user_id, meeting_title, meeting_url,
         calendar_event_id, recording_mode, status, started_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())`,
      [botId, user.id, user.id, title, cleanUrl, eventId, mode]
    );

    // Build payload for Redis consumer
    const jobPayload = {
      provider: 'google',
      url: cleanUrl,
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
router.get('/status', requireAuth, async (_req: Request, res: Response) => {
  try {
    const stats = await getQueueStats();

    // Check active recordings from DB
    const activeRes = await query(
      `SELECT r.id, r.meeting_title, r.meeting_url, r.recording_mode, r.started_at, u.name as user_name
       FROM recordings r
       JOIN users u ON u.id = r.user_id
       WHERE r.status IN ('pending', 'recording')
       ORDER BY r.started_at DESC`
    );

    res.json({
      workers: {
        total: 2,
        active: activeRes.rows.length,
        idle: Math.max(0, 2 - activeRes.rows.length),
      },
      queue: stats,
      activeRecordings: activeRes.rows,
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

export default router;

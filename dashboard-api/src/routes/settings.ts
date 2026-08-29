import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../db.js';

const router = Router();

// GET /api/settings
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const userRes = await query('SELECT bot_display_name FROM users WHERE id = $1', [userId]);
    const settingsRes = await query('SELECT * FROM user_settings WHERE user_id = $1', [userId]);

    res.json({
      botDisplayName: userRes.rows[0]?.bot_display_name || 'Notetaker',
      settings: settingsRes.rows[0] || {},
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings
router.put('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      botDisplayName,
      enableVideo,
      enableAudio,
      enableTranscription,
      driveFolderName,
      maxRecordingMinutes,
      autoJoin,
      telegramChatId,
    } = req.body;

    if (botDisplayName) {
      await query('UPDATE users SET bot_display_name = $1, updated_at = NOW() WHERE id = $2', [
        botDisplayName,
        userId,
      ]);
    }

    const updateRes = await query(
      `INSERT INTO user_settings (
         user_id, enable_video, enable_audio, enable_transcription,
         drive_folder_name, max_recording_minutes, auto_join, telegram_chat_id, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         enable_video = COALESCE($2, user_settings.enable_video),
         enable_audio = COALESCE($3, user_settings.enable_audio),
         enable_transcription = COALESCE($4, user_settings.enable_transcription),
         drive_folder_name = COALESCE($5, user_settings.drive_folder_name),
         max_recording_minutes = COALESCE($6, user_settings.max_recording_minutes),
         auto_join = COALESCE($7, user_settings.auto_join),
         telegram_chat_id = COALESCE($8, user_settings.telegram_chat_id),
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        enableVideo,
        enableAudio,
        enableTranscription,
        driveFolderName,
        maxRecordingMinutes,
        autoJoin,
        telegramChatId,
      ]
    );

    res.json({
      success: true,
      botDisplayName,
      settings: updateRes.rows[0],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/blocklist
router.get('/blocklist', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const blocklistRes = await query(
      'SELECT * FROM meeting_blocklist WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json({ blocklist: blocklistRes.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/blocklist
router.post('/blocklist', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { matchType, matchValue, reason } = req.body;

    if (!matchType || !matchValue) {
      res.status(400).json({ error: 'matchType y matchValue son requeridos' });
      return;
    }

    const insertRes = await query(
      `INSERT INTO meeting_blocklist (user_id, match_type, match_value, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, matchType, matchValue.trim(), reason || null]
    );

    res.status(201).json({ success: true, item: insertRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/blocklist/:id
router.delete('/blocklist/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = req.params.id;

    const delRes = await query(
      'DELETE FROM meeting_blocklist WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (delRes.rows.length === 0) {
      res.status(404).json({ error: 'Regla de bloqueo no encontrada' });
      return;
    }

    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

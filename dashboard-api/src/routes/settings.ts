import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../db.js';
import { getUserDriveFolderId } from '../services/googleAuth.js';

const router = Router();

// GET /api/settings
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const userRes = await query('SELECT name, bot_display_name FROM users WHERE id = $1', [userId]);
    const settingsRes = await query('SELECT * FROM user_settings WHERE user_id = $1', [userId]);
    let settings = settingsRes.rows[0] || {};

    const userRow = userRes.rows[0] || {};
    const defaultBotName = userRow.name ? `${userRow.name}'s Notetaker` : 'Notetaker';

    if (!settings.drive_folder_id) {
      try {
        const folderId = await getUserDriveFolderId(userId);
        if (folderId) {
          settings.drive_folder_id = folderId;
        }
      } catch (e) {
        console.warn('Could not auto-resolve drive folder ID for user', userId, e);
      }
    }

    res.json({
      botDisplayName: userRow.bot_display_name || defaultBotName,
      settings,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings
router.put('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const botDisplayName = req.body.botDisplayName !== undefined ? req.body.botDisplayName : req.body.bot_display_name;
    const enableVideo = req.body.enableVideo !== undefined ? req.body.enableVideo : req.body.enable_video;
    const enableAudio = req.body.enableAudio !== undefined ? req.body.enableAudio : req.body.enable_audio;
    const enableTranscription = req.body.enableTranscription !== undefined ? req.body.enableTranscription : req.body.enable_transcription;
    const driveFolderName = req.body.driveFolderName !== undefined ? req.body.driveFolderName : req.body.drive_folder_name;
    const maxRecordingMinutes = req.body.maxRecordingMinutes !== undefined ? req.body.maxRecordingMinutes : req.body.max_recording_minutes;
    const autoJoin = req.body.autoJoin !== undefined ? req.body.autoJoin : req.body.auto_join;
    const telegramChatId = req.body.telegramChatId !== undefined ? req.body.telegramChatId : req.body.telegram_chat_id;
    const minutesPrompt = req.body.minutesPrompt !== undefined ? req.body.minutesPrompt : req.body.minutes_prompt;

    if (botDisplayName) {
      await query('UPDATE users SET bot_display_name = $1, updated_at = NOW() WHERE id = $2', [
        botDisplayName,
        userId,
      ]);
    }

    const updateRes = await query(
      `INSERT INTO user_settings (
         user_id, enable_video, enable_audio, enable_transcription,
         drive_folder_name, max_recording_minutes, auto_join, telegram_chat_id, minutes_prompt, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         enable_video = COALESCE($2, user_settings.enable_video),
         enable_audio = COALESCE($3, user_settings.enable_audio),
         enable_transcription = COALESCE($4, user_settings.enable_transcription),
         drive_folder_name = COALESCE($5, user_settings.drive_folder_name),
         max_recording_minutes = COALESCE($6, user_settings.max_recording_minutes),
         auto_join = COALESCE($7, user_settings.auto_join),
         telegram_chat_id = COALESCE($8, user_settings.telegram_chat_id),
         minutes_prompt = CASE WHEN $9::text IS NOT NULL THEN $9 ELSE user_settings.minutes_prompt END,
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
        minutesPrompt !== undefined ? minutesPrompt : null,
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

    const val = matchValue.trim();
    const insertRes = await query(
      `INSERT INTO meeting_blocklist (user_id, match_type, match_value, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, matchType, val, reason || null]
    );

    // Immediately pause all matching scheduled meetings
    if (matchType === 'title_contains') {
      await query(
        `UPDATE scheduled_meetings SET will_record = false, updated_at = NOW() WHERE user_id = $1 AND title ILIKE '%' || $2 || '%'`,
        [userId, val]
      );
    } else if (matchType === 'url') {
      await query(
        `UPDATE scheduled_meetings SET will_record = false, updated_at = NOW() WHERE user_id = $1 AND meet_url ILIKE '%' || $2 || '%'`,
        [userId, val]
      );
    } else if (matchType === 'event_id') {
      await query(
        `UPDATE scheduled_meetings SET will_record = false, updated_at = NOW() WHERE user_id = $1 AND calendar_event_id = $2`,
        [userId, val]
      );
    }

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

    const ruleRes = await query(
      'SELECT * FROM meeting_blocklist WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (ruleRes.rows.length === 0) {
      res.status(404).json({ error: 'Regla de bloqueo no encontrada' });
      return;
    }
    const rule = ruleRes.rows[0];

    await query('DELETE FROM meeting_blocklist WHERE id = $1 AND user_id = $2', [id, userId]);

    // Reactivate meetings that matched this deleted rule
    if (rule.match_type === 'title_contains') {
      await query(
        `UPDATE scheduled_meetings SET will_record = true, updated_at = NOW() WHERE user_id = $1 AND title ILIKE '%' || $2 || '%'`,
        [userId, rule.match_value]
      );
    } else if (rule.match_type === 'url') {
      await query(
        `UPDATE scheduled_meetings SET will_record = true, updated_at = NOW() WHERE user_id = $1 AND meet_url ILIKE '%' || $2 || '%'`,
        [userId, rule.match_value]
      );
    } else if (rule.match_type === 'event_id') {
      await query(
        `UPDATE scheduled_meetings SET will_record = true, updated_at = NOW() WHERE user_id = $1 AND calendar_event_id = $2`,
        [userId, rule.match_value]
      );
    }

    // Re-apply any remaining blocklist rules to maintain full consistency
    await query(
      `UPDATE scheduled_meetings sm
       SET will_record = false, updated_at = NOW()
       FROM meeting_blocklist mb
       WHERE sm.user_id = $1 AND mb.user_id = $1 AND (
         (mb.match_type = 'url' AND sm.meet_url ILIKE '%' || mb.match_value || '%') OR
         (mb.match_type = 'title_contains' AND sm.title ILIKE '%' || mb.match_value || '%') OR
         (mb.match_type = 'event_id' AND sm.calendar_event_id = mb.match_value)
       )`,
      [userId]
    );

    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

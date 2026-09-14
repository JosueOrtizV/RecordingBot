import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { syncUserCalendar } from '../services/calendarService.js';
import { syncUserProfileFromGoogle } from '../services/googleAuth.js';
import { query } from '../db.js';

const router = Router();

// GET /api/calendar/upcoming
router.get('/upcoming', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Check if we have meetings in DB for the past 30 days and upcoming 60 days
    const dbRes = await query(
      `SELECT sm.*, 
              CASE WHEN sm.manual_override = true THEN NULL ELSE mb.reason END as block_reason,
              CASE WHEN sm.manual_override = true THEN NULL ELSE mb.id END as block_rule_id,
              CASE 
                WHEN sm.manual_override IS NOT NULL THEN sm.manual_override
                WHEN mb.id IS NOT NULL THEN false 
                ELSE sm.will_record 
              END as will_record
       FROM scheduled_meetings sm
       LEFT JOIN meeting_blocklist mb ON mb.user_id = sm.user_id AND (
         (mb.match_type = 'url' AND sm.meet_url ILIKE '%' || mb.match_value || '%') OR
         (mb.match_type = 'title_contains' AND sm.title ILIKE '%' || mb.match_value || '%') OR
         (mb.match_type = 'event_id' AND sm.calendar_event_id = mb.match_value)
       )
       WHERE sm.user_id = $1 AND sm.start_time >= NOW() - INTERVAL '30 days' AND sm.start_time <= NOW() + INTERVAL '60 days'
       ORDER BY sm.start_time ASC`,
      [userId]
    );

    // If no meetings found or explicitly requested, sync
    let meetings = dbRes.rows;
    if (meetings.length === 0) {
      try {
        meetings = await syncUserCalendar(userId);
      } catch (syncErr: any) {
        console.warn('Auto-sync failed, returning empty list:', syncErr.message);
      }
    }

    res.json({ meetings });
  } catch (err: any) {
    console.error('Error fetching upcoming meetings:', err);
    res.status(500).json({ error: err.message || 'Error al obtener reuniones' });
  }
});

// POST /api/calendar/refresh
router.post('/refresh', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    await Promise.allSettled([
      syncUserCalendar(userId),
      syncUserProfileFromGoogle(userId),
    ]);
    
    // Return all meetings with blocklist joined
    const dbRes = await query(
      `SELECT sm.*, 
              CASE WHEN sm.manual_override = true THEN NULL ELSE mb.reason END as block_reason,
              CASE WHEN sm.manual_override = true THEN NULL ELSE mb.id END as block_rule_id,
              CASE 
                WHEN sm.manual_override IS NOT NULL THEN sm.manual_override
                WHEN mb.id IS NOT NULL THEN false 
                ELSE sm.will_record 
              END as will_record
       FROM scheduled_meetings sm
       LEFT JOIN meeting_blocklist mb ON mb.user_id = sm.user_id AND (
         (mb.match_type = 'url' AND sm.meet_url ILIKE '%' || mb.match_value || '%') OR
         (mb.match_type = 'title_contains' AND sm.title ILIKE '%' || mb.match_value || '%') OR
         (mb.match_type = 'event_id' AND sm.calendar_event_id = mb.match_value)
       )
       WHERE sm.user_id = $1 AND sm.start_time >= NOW() - INTERVAL '30 days' AND sm.start_time <= NOW() + INTERVAL '60 days'
       ORDER BY sm.start_time ASC`,
      [userId]
    );

    res.json({ success: true, count: dbRes.rows.length, meetings: dbRes.rows });
  } catch (err: any) {
    console.error('Error refreshing calendar:', err);
    res.status(500).json({ error: err.message || 'Error al sincronizar con Google Calendar' });
  }
});

// PUT /api/calendar/toggle-record/:id
router.put('/toggle-record/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const meetingId = req.params.id;
    const { willRecord, scope, matchType, matchValue } = req.body;

    const targetMeetingRes = await query(
      'SELECT * FROM scheduled_meetings WHERE id = $1 AND user_id = $2',
      [meetingId, userId]
    );

    if (targetMeetingRes.rows.length === 0) {
      res.status(404).json({ error: 'Reunión no encontrada' });
      return;
    }

    const meeting = targetMeetingRes.rows[0];

    if (scope === 'series') {
      const type = matchType || 'title_contains';
      const val = (matchValue || meeting.title || '').trim();

      if (!willRecord && val) {
        // Add to meeting_blocklist so it appears in Excluded Meetings in Settings!
        await query(
          `INSERT INTO meeting_blocklist (user_id, match_type, match_value, reason)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [userId, type, val, `Excluido desde calendario: "${val}"`]
        );

        // Update all matching meetings and reset individual manual_override
        if (type === 'title_contains') {
          await query(
            `UPDATE scheduled_meetings SET will_record = false, manual_override = NULL, updated_at = NOW() WHERE user_id = $1 AND title ILIKE '%' || $2 || '%'`,
            [userId, val]
          );
        } else if (type === 'url') {
          await query(
            `UPDATE scheduled_meetings SET will_record = false, manual_override = NULL, updated_at = NOW() WHERE user_id = $1 AND meet_url ILIKE '%' || $2 || '%'`,
            [userId, val]
          );
        }
      } else if (willRecord && val) {
        // Remove from meeting_blocklist
        if (type === 'title_contains') {
          await query(
            `DELETE FROM meeting_blocklist WHERE user_id = $1 AND match_type = 'title_contains' AND match_value ILIKE $2`,
            [userId, val]
          );
          await query(
            `UPDATE scheduled_meetings SET will_record = true, manual_override = NULL, updated_at = NOW() WHERE user_id = $1 AND title ILIKE '%' || $2 || '%'`,
            [userId, val]
          );
        } else if (type === 'url') {
          await query(
            `DELETE FROM meeting_blocklist WHERE user_id = $1 AND match_type = 'url' AND match_value ILIKE $2`,
            [userId, val]
          );
          await query(
            `UPDATE scheduled_meetings SET will_record = true, manual_override = NULL, updated_at = NOW() WHERE user_id = $1 AND meet_url ILIKE '%' || $2 || '%'`,
            [userId, val]
          );
        }
      }

      res.json({
        success: true,
        scope: 'series',
        message: willRecord ? 'Serie activada' : 'Serie excluida y agregada a reglas de bloqueo',
      });
      return;
    }

    // Default: Single instance toggle - sets manual_override so it won't be overwritten by poller or series rule
    const updateRes = await query(
      `UPDATE scheduled_meetings
       SET will_record = $1, manual_override = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [Boolean(willRecord), meetingId, userId]
    );

    res.json({ success: true, scope: 'single', meeting: updateRes.rows[0] });
  } catch (err: any) {
    console.error('Error toggling record:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { syncUserCalendar } from '../services/calendarService.js';
import { query } from '../db.js';

const router = Router();

// GET /api/calendar/upcoming
router.get('/upcoming', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Check if we have meetings in DB for the upcoming 7 days
    const dbRes = await query(
      `SELECT sm.*, mb.reason as block_reason
       FROM scheduled_meetings sm
       LEFT JOIN meeting_blocklist mb ON mb.user_id = sm.user_id AND (
         (mb.match_type = 'url' AND sm.meet_url ILIKE '%' || mb.match_value || '%') OR
         (mb.match_type = 'title_contains' AND sm.title ILIKE '%' || mb.match_value || '%') OR
         (mb.match_type = 'event_id' AND sm.calendar_event_id = mb.match_value)
       )
       WHERE sm.user_id = $1 AND sm.start_time >= NOW() - INTERVAL '15 minutes'
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
    const meetings = await syncUserCalendar(userId);
    res.json({ success: true, count: meetings.length, meetings });
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
    const { willRecord } = req.body;

    const updateRes = await query(
      `UPDATE scheduled_meetings
       SET will_record = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [Boolean(willRecord), meetingId, userId]
    );

    if (updateRes.rows.length === 0) {
      res.status(404).json({ error: 'Reunión no encontrada' });
      return;
    }

    res.json({ success: true, meeting: updateRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

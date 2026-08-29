import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../db.js';

const router = Router();

// GET /api/recordings
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const offset = (page - 1) * limit;

    const countRes = await query('SELECT COUNT(*) FROM recordings WHERE user_id = $1', [userId]);
    const total = parseInt(countRes.rows[0].count, 10);

    const recordingsRes = await query(
      `SELECT id, user_id, meeting_title, meeting_url, calendar_event_id,
              drive_file_id, drive_url, duration_seconds, recording_mode,
              status, error_message, started_at, completed_at, created_at,
              CASE WHEN transcript_text IS NOT NULL AND length(transcript_text) > 0 THEN true ELSE false END as has_transcript
       FROM recordings
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({
      recordings: recordingsRes.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/recordings/:id
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = req.params.id;

    const recordingRes = await query(
      'SELECT * FROM recordings WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (recordingRes.rows.length === 0) {
      res.status(404).json({ error: 'Grabación no encontrada' });
      return;
    }

    res.json({ recording: recordingRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/recordings/:id/transcript
router.get('/:id/transcript', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = req.params.id;

    const resDb = await query(
      'SELECT transcript_text, meeting_title FROM recordings WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (resDb.rows.length === 0) {
      res.status(404).json({ error: 'Grabación no encontrada' });
      return;
    }

    const row = resDb.rows[0];
    if (!row.transcript_text) {
      res.status(404).json({ error: 'Esta grabación no tiene transcripción guardada' });
      return;
    }

    if (req.query.download === 'true') {
      const safeTitle = (row.meeting_title || 'transcripcion').replace(/[^a-zA-Z0-9_-]/g, '_');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.txt"`);
      res.send(row.transcript_text);
      return;
    }

    res.json({
      transcript: row.transcript_text,
      meetingTitle: row.meeting_title,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/recordings/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = req.params.id;

    const delRes = await query(
      'DELETE FROM recordings WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (delRes.rows.length === 0) {
      res.status(404).json({ error: 'Grabación no encontrada' });
      return;
    }

    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

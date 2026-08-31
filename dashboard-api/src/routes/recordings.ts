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

    const timeRange = (req.query.timeRange as string || 'all').toLowerCase();
    const search = (req.query.search as string || '').trim();
    const mode = (req.query.mode as string || 'all').toLowerCase();
    const status = (req.query.status as string || 'all').toLowerCase();
    const hasTranscript = req.query.hasTranscript as string;

    // 1. Overall counts by range for quick tab badges
    const countsRes = await query(
      `SELECT
        COUNT(*) as total_all,
        COUNT(*) FILTER (WHERE created_at AT TIME ZONE 'America/Mexico_City' >= date_trunc('month', NOW() AT TIME ZONE 'America/Mexico_City')) as total_month,
        COUNT(*) FILTER (WHERE created_at AT TIME ZONE 'America/Mexico_City' >= date_trunc('week', NOW() AT TIME ZONE 'America/Mexico_City')) as total_week,
        COUNT(*) FILTER (WHERE created_at AT TIME ZONE 'America/Mexico_City' >= date_trunc('day', NOW() AT TIME ZONE 'America/Mexico_City')) as total_today
       FROM recordings
       WHERE user_id = $1`,
      [userId]
    );

    const countsRow = countsRes.rows[0] || {};
    const countsByRange = {
      today: parseInt(countsRow.total_today || '0', 10),
      week: parseInt(countsRow.total_week || '0', 10),
      month: parseInt(countsRow.total_month || '0', 10),
      all: parseInt(countsRow.total_all || '0', 10),
    };

    // 2. Build filtered query
    const conditions: string[] = ['user_id = $1'];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (timeRange === 'today') {
      conditions.push(`created_at AT TIME ZONE 'America/Mexico_City' >= date_trunc('day', NOW() AT TIME ZONE 'America/Mexico_City')`);
    } else if (timeRange === 'week') {
      conditions.push(`created_at AT TIME ZONE 'America/Mexico_City' >= date_trunc('week', NOW() AT TIME ZONE 'America/Mexico_City')`);
    } else if (timeRange === 'month') {
      conditions.push(`created_at AT TIME ZONE 'America/Mexico_City' >= date_trunc('month', NOW() AT TIME ZONE 'America/Mexico_City')`);
    }

    if (search) {
      conditions.push(`(meeting_title ILIKE $${paramIndex} OR meeting_url ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (mode && mode !== 'all') {
      conditions.push(`recording_mode = $${paramIndex}`);
      params.push(mode);
      paramIndex++;
    }

    if (status && status !== 'all') {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (hasTranscript === 'true') {
      conditions.push(`(transcript_text IS NOT NULL AND length(transcript_text) > 0)`);
    } else if (hasTranscript === 'false') {
      conditions.push(`(transcript_text IS NULL OR length(transcript_text) = 0)`);
    }

    const whereClause = conditions.join(' AND ');

    // 3. Stats for filtered dataset
    const statsRes = await query(
      `SELECT
        COUNT(*) as total_count,
        COALESCE(SUM(duration_seconds), 0) as total_seconds,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE transcript_text IS NOT NULL AND length(transcript_text) > 0) as with_transcript_count
       FROM recordings
       WHERE ${whereClause}`,
      params
    );

    const statsRow = statsRes.rows[0] || {};
    const total = parseInt(statsRow.total_count || '0', 10);
    const totalSeconds = parseInt(statsRow.total_seconds || '0', 10);
    const completedCount = parseInt(statsRow.completed_count || '0', 10);
    const withTranscriptCount = parseInt(statsRow.with_transcript_count || '0', 10);

    // 4. Fetch paginated records
    const queryParams = [...params, limit, offset];
    const recordingsRes = await query(
      `SELECT id, user_id, meeting_title, meeting_url, calendar_event_id,
              drive_file_id, drive_url, duration_seconds, recording_mode,
              status, error_message, started_at, completed_at, created_at,
              CASE WHEN transcript_text IS NOT NULL AND length(transcript_text) > 0 THEN true ELSE false END as has_transcript
       FROM recordings
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      queryParams
    );

    res.json({
      recordings: recordingsRes.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      stats: {
        totalCount: total,
        totalSeconds,
        completedCount,
        withTranscriptCount,
        countsByRange,
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

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../db.js';
import { setDriveFilePublic, setDriveFilePrivate, getUserOAuth2Client } from '../services/googleAuth.js';
import { generateMeetingMinutes } from '../services/gemini.js';
import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const router = Router();

// In-flight minutes generation promises to prevent duplicate simultaneous executions
const inFlightMinutes = new Map<string, Promise<string>>();

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
      `SELECT r.*,
              COALESCE(
                r.ai_minutes_text,
                (SELECT r2.ai_minutes_text FROM recordings r2 
                 WHERE r2.dedup_group_id = r.dedup_group_id 
                   AND r2.dedup_group_id IS NOT NULL 
                   AND r2.ai_minutes_text IS NOT NULL 
                 LIMIT 1)
              ) as ai_minutes_text,
              TO_CHAR(COALESCE(r.started_at, r.created_at) AT TIME ZONE 'America/Mexico_City', 'HH24:MI:SS') as started_at_local,
              u_owner.name as owner_name,
              u_owner.email as owner_email,
              (COALESCE(r.owner_user_id, r.user_id) = $2) as is_drive_owner
       FROM recordings r
       LEFT JOIN users u_owner ON u_owner.id = r.owner_user_id
       WHERE r.id = $1 AND r.user_id = $2`,
      [id, userId]
    );

    if (recordingRes.rows.length === 0) {
      res.status(404).json({ error: 'Grabación no encontrada' });
      return;
    }

    const recording = recordingRes.rows[0];

    // If deduplicated / shared meeting, get teammates who also share this recording
    let sharedWith: any[] = [];
    if (recording.dedup_group_id) {
      const sharedRes = await query(
        `SELECT u.id, u.name, u.email, u.picture_url as avatar_url, (u.id = r.owner_user_id) as is_drive_owner
         FROM recordings r
         JOIN users u ON u.id = r.user_id
         WHERE r.dedup_group_id = $1
         ORDER BY (u.id = r.owner_user_id) DESC, u.name ASC`,
        [recording.dedup_group_id]
      );
      sharedWith = sharedRes.rows;
    }

    res.json({
      recording: {
        ...recording,
        shared_with: sharedWith,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/recordings/:id/stream - Direct seeking media stream from Google Drive
router.get('/:id/stream', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const token = req.query.token as string | undefined;

    // 1. Authenticate either via user session (cookie or header) or share token
    let userId: string | null = null;
    let jwtToken = req.cookies?.token;
    if (!jwtToken && req.headers.authorization?.startsWith('Bearer ')) {
      jwtToken = req.headers.authorization.split(' ')[1];
    }
    if (jwtToken) {
      try {
        const decoded = jwt.verify(jwtToken, config.jwtSecret) as { userId: string };
        userId = decoded.userId;
      } catch (e) {
        // invalid jwt token, proceed to check share token
      }
    }

    // 2. Fetch recording details
    const recRes = await query(
      `SELECT r.id, r.user_id, r.owner_user_id, r.dedup_group_id, r.drive_file_id,
              r.recording_mode, r.share_token, r.share_access
       FROM recordings r
       WHERE r.id = $1`,
      [id]
    );

    if (recRes.rows.length === 0) {
      res.status(404).json({ error: 'Grabación no encontrada' });
      return;
    }

    const recording = recRes.rows[0];

    // Check authorization:
    let isAuthorized = false;

    // User owns or belongs to the dedup group
    if (userId) {
      if (recording.user_id === userId) {
        isAuthorized = true;
      } else if (recording.dedup_group_id) {
        const checkGroup = await query(
          'SELECT 1 FROM recordings WHERE dedup_group_id = $1 AND user_id = $2 LIMIT 1',
          [recording.dedup_group_id, userId]
        );
        if (checkGroup.rows.length > 0) {
          isAuthorized = true;
        }
      }
    }

    // Or authorized via valid share token
    if (!isAuthorized && token && recording.share_token === token) {
      if (recording.share_access === 'public') {
        isAuthorized = true;
      } else if (recording.share_access === 'registered' && userId) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      res.status(403).json({ error: 'No tienes permiso para reproducir esta grabación' });
      return;
    }

    if (!recording.drive_file_id) {
      res.status(404).json({ error: 'No hay archivo multimedia asociado en Google Drive' });
      return;
    }

    // 3. Resolve Drive Owner to get proper OAuth tokens
    const driveOwnerId = recording.owner_user_id || recording.user_id;
    const auth = await getUserOAuth2Client(driveOwnerId);
    const drive = google.drive({ version: 'v3', auth });

    // 4. Request stream from Google Drive with Range header forwarding
    const rangeHeader = req.headers.range;
    const driveStream = await drive.files.get(
      {
        fileId: recording.drive_file_id,
        alt: 'media',
      },
      {
        responseType: 'stream',
        headers: rangeHeader ? { Range: rangeHeader } : {},
      }
    );

    // Forward status (206 for partial content, 200 for full stream)
    res.status(driveStream.status || (rangeHeader ? 206 : 200));

    // Forward essential media headers
    if (driveStream.headers['content-range']) {
      res.setHeader('Content-Range', driveStream.headers['content-range']);
    }
    if (driveStream.headers['content-length']) {
      res.setHeader('Content-Length', driveStream.headers['content-length']);
    }
    if (driveStream.headers['content-type']) {
      res.setHeader('Content-Type', driveStream.headers['content-type']);
    } else {
      res.setHeader('Content-Type', recording.recording_mode === 'video' ? 'video/mp4' : 'audio/mpeg');
    }
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=3600');

    (driveStream.data as any).on('error', (err: any) => {
      console.error('Error in Drive stream:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error al transmitir desde Google Drive' });
      }
    });

    req.on('close', () => {
      if ((driveStream.data as any).destroy) {
        (driveStream.data as any).destroy();
      }
    });

    (driveStream.data as any).pipe(res);
  } catch (err: any) {
    console.error('Stream error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Error de streaming' });
    }
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

// POST /api/recordings/:id/minutes (Generate or regenerate minutes using Gemini AI)
router.post('/:id/minutes', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = req.params.id;
    const force = req.query.force === 'true';

    // 1. Fetch recording details including dedup_group_id
    const recDb = await query(
      'SELECT id, user_id, transcript_text, meeting_title, ai_minutes_text, dedup_group_id FROM recordings WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (recDb.rows.length === 0) {
      res.status(404).json({ error: 'Grabación no encontrada' });
      return;
    }

    const rec = recDb.rows[0];

    // If already generated and user is not explicitly forcing regeneration, return existing
    if (!force && rec.ai_minutes_text && rec.ai_minutes_text.trim().length > 0) {
      res.json({
        success: true,
        minutes: rec.ai_minutes_text,
        meetingTitle: rec.meeting_title,
      });
      return;
    }

    // Check if another teammate in the same deduplication group already generated minutes
    if (!force && rec.dedup_group_id) {
      const groupSibling = await query(
        `SELECT ai_minutes_text FROM recordings
         WHERE dedup_group_id = $1 AND ai_minutes_text IS NOT NULL AND length(ai_minutes_text) > 0
         LIMIT 1`,
        [rec.dedup_group_id]
      );

      if (groupSibling.rows.length > 0 && groupSibling.rows[0].ai_minutes_text) {
        const existingMinutes = groupSibling.rows[0].ai_minutes_text;
        // Sync to all recordings in this dedup group missing it
        await query(
          'UPDATE recordings SET ai_minutes_text = $1 WHERE dedup_group_id = $2 AND (ai_minutes_text IS NULL OR length(ai_minutes_text) = 0)',
          [existingMinutes, rec.dedup_group_id]
        );

        res.json({
          success: true,
          minutes: existingMinutes,
          meetingTitle: rec.meeting_title,
          sharedFromTeam: true,
        });
        return;
      }
    }

    if (!rec.transcript_text || rec.transcript_text.trim().length === 0) {
      res.status(400).json({
        error: 'Esta grabación no tiene transcripción disponible para generar la minuta.',
      });
      return;
    }

    // 2. Fetch user custom prompt if any
    const settingsDb = await query(
      'SELECT minutes_prompt FROM user_settings WHERE user_id = $1',
      [userId]
    );
    const customPrompt = settingsDb.rows[0]?.minutes_prompt || undefined;

    // 3. Avoid duplicate concurrent generation for the same recording or dedup group
    const lockKey = rec.dedup_group_id ? `group:${rec.dedup_group_id}` : `rec:${id}`;
    if (inFlightMinutes.has(lockKey)) {
      console.log(`[Minutes] Awaiting existing in-flight generation for lock key ${lockKey}...`);
      const generatedMinutes = await inFlightMinutes.get(lockKey)!;
      res.json({
        success: true,
        minutes: generatedMinutes,
        meetingTitle: rec.meeting_title,
      });
      return;
    }

    const genPromise = (async () => {
      const generated = await generateMeetingMinutes({
        transcript: rec.transcript_text,
        meetingTitle: rec.meeting_title || 'Reunión',
        customPrompt,
      });

      // 4. Save generated minutes into database for all users in the same dedup group
      if (rec.dedup_group_id) {
        await query(
          'UPDATE recordings SET ai_minutes_text = $1 WHERE dedup_group_id = $2',
          [generated, rec.dedup_group_id]
        );
      } else {
        await query(
          'UPDATE recordings SET ai_minutes_text = $1 WHERE id = $2 AND user_id = $3',
          [generated, id, userId]
        );
      }

      return generated;
    })();

    inFlightMinutes.set(lockKey, genPromise);
    try {
      const generatedMinutes = await genPromise;
      res.json({
        success: true,
        minutes: generatedMinutes,
        meetingTitle: rec.meeting_title,
      });
    } finally {
      inFlightMinutes.delete(lockKey);
    }
  } catch (err: any) {
    console.error('Error generating minutes with Gemini:', err);
    res.status(500).json({ error: err.message || 'Error al generar la minuta con Gemini' });
  }
});

// GET /api/recordings/:id/minutes
router.get('/:id/minutes', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = req.params.id;

    const resDb = await query(
      `SELECT COALESCE(
                r.ai_minutes_text,
                (SELECT r2.ai_minutes_text FROM recordings r2 
                 WHERE r2.dedup_group_id = r.dedup_group_id 
                   AND r2.dedup_group_id IS NOT NULL 
                   AND r2.ai_minutes_text IS NOT NULL 
                 LIMIT 1)
              ) as ai_minutes_text,
              r.meeting_title
       FROM recordings r
       WHERE r.id = $1 AND r.user_id = $2`,
      [id, userId]
    );

    if (resDb.rows.length === 0) {
      res.status(404).json({ error: 'Grabación no encontrada' });
      return;
    }

    const row = resDb.rows[0];
    if (!row.ai_minutes_text) {
      res.status(404).json({ error: 'Esta grabación aún no tiene una minuta generada' });
      return;
    }

    if (req.query.download === 'true') {
      const safeTitle = (row.meeting_title || 'minuta').replace(/[^a-zA-Z0-9_-]/g, '_');
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_minuta.md"`);
      res.send(row.ai_minutes_text);
      return;
    }

    res.json({
      minutes: row.ai_minutes_text,
      meetingTitle: row.meeting_title,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/recordings/:id/share
router.put('/:id/share', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = req.params.id;
    const { access } = req.body; // 'private' | 'registered' | 'public'

    if (!access || !['private', 'registered', 'public'].includes(access)) {
      res.status(400).json({ error: 'Nivel de acceso inválido. Opciones: private, registered, public' });
      return;
    }

    const recRes = await query(
      'SELECT id, user_id, owner_user_id, dedup_group_id, drive_file_id, share_token, share_access FROM recordings WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (recRes.rows.length === 0) {
      res.status(404).json({ error: 'Grabación no encontrada' });
      return;
    }

    const recording = recRes.rows[0];
    let shareToken = recording.share_token;

    // If this recording belongs to a dedup group and doesn't have a share_token yet,
    // check if any other recording in the group already has one so we reuse it
    if (recording.dedup_group_id && !shareToken) {
      const groupTokenRes = await query(
        'SELECT share_token FROM recordings WHERE dedup_group_id = $1 AND share_token IS NOT NULL LIMIT 1',
        [recording.dedup_group_id]
      );
      if (groupTokenRes.rows.length > 0 && groupTokenRes.rows[0].share_token) {
        shareToken = groupTokenRes.rows[0].share_token;
      }
    }

    // Generate token if enabling sharing and no token exists yet
    if ((access === 'public' || access === 'registered') && !shareToken) {
      const { v4: uuidv4 } = await import('uuid');
      shareToken = uuidv4();
    }

    // Manage Google Drive file permissions using the actual Drive owner credentials
    if (recording.drive_file_id) {
      const driveOwnerId = recording.owner_user_id || userId;
      if (access === 'public') {
        await setDriveFilePublic(driveOwnerId, recording.drive_file_id);
      } else {
        await setDriveFilePrivate(driveOwnerId, recording.drive_file_id);
      }
    }

    // Update the recording (and sync across dedup group if applicable)
    let updateRes;
    if (recording.dedup_group_id) {
      updateRes = await query(
        'UPDATE recordings SET share_access = $1, share_token = $2 WHERE dedup_group_id = $3 RETURNING id, share_token, share_access',
        [access, shareToken, recording.dedup_group_id]
      );
    } else {
      updateRes = await query(
        'UPDATE recordings SET share_access = $1, share_token = $2 WHERE id = $3 AND user_id = $4 RETURNING id, share_token, share_access',
        [access, shareToken, id, userId]
      );
    }

    const updated = updateRes.rows.find((r: any) => r.id === id) || updateRes.rows[0];

    res.json({
      success: true,
      shareToken: updated.share_token,
      shareAccess: updated.share_access,
      shareUrl: updated.share_token ? `/r/${updated.share_token}` : null,
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

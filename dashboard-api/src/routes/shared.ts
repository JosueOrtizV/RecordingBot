import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { config } from '../config.js';

const router = Router();

// GET /api/shared/:token - Public shared recording access
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    if (!token) {
      res.status(400).json({ error: 'Token de acceso no proporcionado' });
      return;
    }

    const recRes = await query(
      `SELECT r.id, r.meeting_title, r.meeting_url, r.drive_file_id, r.drive_url,
              r.duration_seconds, r.recording_mode, r.status, r.transcript_text, r.ai_minutes_text,
              r.share_access, r.share_token, r.created_at, r.started_at, r.completed_at,
              u.name as owner_name
       FROM recordings r
       LEFT JOIN users u ON COALESCE(r.owner_user_id, r.user_id) = u.id
       WHERE r.share_token::text = $1
       ORDER BY (r.user_id = r.owner_user_id) DESC, r.created_at ASC
       LIMIT 1`,
      [token]
    );

    if (recRes.rows.length === 0) {
      res.status(404).json({ error: 'Grabación no encontrada o enlace revocado.' });
      return;
    }

    const recording = recRes.rows[0];

    // Check share access level
    if (recording.share_access === 'private' || !recording.share_access) {
      res.status(404).json({ error: 'Esta grabación es privada y no está compartida.' });
      return;
    }

    if (recording.share_access === 'registered') {
      // Must verify valid JWT user session
      let jwtToken = req.cookies?.token;
      if (!jwtToken && req.headers.authorization?.startsWith('Bearer ')) {
        jwtToken = req.headers.authorization.split(' ')[1];
      }

      if (!jwtToken) {
        res.status(401).json({
          requiresAuth: true,
          error: 'Esta grabación está restringida exclusivamente a usuarios registrados. Por favor inicia sesión.',
        });
        return;
      }

      try {
        const decoded = jwt.verify(jwtToken, config.jwtSecret) as { userId: string };
        const userCheck = await query('SELECT id FROM users WHERE id = $1 AND is_active = true', [decoded.userId]);
        if (userCheck.rows.length === 0) {
          res.status(401).json({
            requiresAuth: true,
            error: 'Sesión no válida o usuario inactivo. Inicia sesión nuevamente.',
          });
          return;
        }
      } catch (jwtErr) {
        res.status(401).json({
          requiresAuth: true,
          error: 'Tu sesión ha expirado. Inicia sesión para ver esta grabación.',
        });
        return;
      }
    }

    // Return sanitized recording data
    res.json({
      recording: {
        id: recording.id,
        meeting_title: recording.meeting_title || 'Reunión sin título',
        meeting_url: recording.meeting_url,
        drive_file_id: recording.drive_file_id,
        drive_url: recording.drive_url,
        duration_seconds: recording.duration_seconds,
        recording_mode: recording.recording_mode,
        status: recording.status,
        transcript_text: recording.transcript_text,
        ai_minutes_text: recording.ai_minutes_text,
        share_access: recording.share_access,
        created_at: recording.created_at,
        started_at: recording.started_at,
        completed_at: recording.completed_at,
        owner_name: recording.owner_name || 'Organizador',
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

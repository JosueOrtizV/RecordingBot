import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { query } from '../db.js';

const router = Router();

// Apply auth + admin verification to all admin routes
router.use(requireAuth, requireAdmin);

/**
 * GET /api/admin/users
 * Devuelve el listado completo de usuarios registrados con métricas agregadas operativas.
 * PRIVACIDAD POR DISEÑO: No expone títulos de reuniones, archivos en Drive ni transcripciones.
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const usersRes = await query(`
      SELECT 
        u.id, 
        u.email, 
        u.name, 
        u.picture_url, 
        u.bot_display_name, 
        COALESCE(u.role, 'user') AS role, 
        u.is_active, 
        u.created_at, 
        u.last_login_at,
        COUNT(r.id) FILTER (WHERE r.status = 'completed') AS total_recordings,
        COALESCE(SUM(r.duration_seconds) FILTER (WHERE r.status = 'completed'), 0) AS total_duration_seconds
      FROM users u
      LEFT JOIN recordings r ON r.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at ASC
    `);

    const users = usersRes.rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      pictureUrl: row.picture_url,
      botDisplayName: row.bot_display_name,
      role: row.role,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
      totalRecordings: parseInt(row.total_recordings, 10) || 0,
      totalDurationSeconds: parseInt(row.total_duration_seconds, 10) || 0,
    }));

    res.json({ users });
  } catch (err: any) {
    console.error('Error fetching admin users:', err);
    res.status(500).json({ error: 'Error al obtener la lista de usuarios.' });
  }
});

/**
 * GET /api/admin/stats
 * Resumen global del estado del sistema y recursos.
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const statsRes = await query(`
      SELECT 
        COUNT(u.id) AS total_users,
        COUNT(u.id) FILTER (WHERE u.is_active = true) AS active_users,
        COUNT(u.id) FILTER (WHERE u.is_active = false) AS suspended_users,
        COUNT(u.id) FILTER (WHERE u.role = 'admin') AS admin_users
      FROM users u
    `);

    const recordingsRes = await query(`
      SELECT 
        COUNT(id) AS total_recordings,
        COALESCE(SUM(duration_seconds), 0) AS total_duration_seconds
      FROM recordings
      WHERE status = 'completed'
    `);

    const userStats = statsRes.rows[0];
    const recStats = recordingsRes.rows[0];

    res.json({
      totalUsers: parseInt(userStats.total_users, 10) || 0,
      activeUsers: parseInt(userStats.active_users, 10) || 0,
      suspendedUsers: parseInt(userStats.suspended_users, 10) || 0,
      adminUsers: parseInt(userStats.admin_users, 10) || 0,
      totalRecordings: parseInt(recStats.total_recordings, 10) || 0,
      totalDurationSeconds: parseInt(recStats.total_duration_seconds, 10) || 0,
    });
  } catch (err: any) {
    console.error('Error fetching admin stats:', err);
    res.status(500).json({ error: 'Error al obtener estadísticas globales.' });
  }
});

/**
 * PATCH /api/admin/users/:id/status
 * Activa o suspende una cuenta de usuario.
 */
router.patch('/users/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      res.status(400).json({ error: 'El campo isActive debe ser un booleano (true/false).' });
      return;
    }

    // Prevent self-deactivation
    if (req.user!.id === id && !isActive) {
      res.status(400).json({ error: 'No puedes desactivar tu propia cuenta de administrador.' });
      return;
    }

    const checkRes = await query('SELECT id, email, name, role FROM users WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    const targetUser = checkRes.rows[0];

    // Update status
    await query(
      'UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2',
      [isActive, id]
    );

    console.log(`[Admin] User ${targetUser.email} status changed to isActive=${isActive} by admin ${req.user!.email}`);

    res.json({
      success: true,
      message: `Cuenta de ${targetUser.name || targetUser.email} ${isActive ? 'activada' : 'suspendida'} exitosamente.`,
      isActive,
    });
  } catch (err: any) {
    console.error('Error updating user status:', err);
    res.status(500).json({ error: 'Error al actualizar el estado del usuario.' });
  }
});

/**
 * PATCH /api/admin/users/:id/role
 * Cambia el rol de un usuario entre 'admin' y 'user'.
 */
router.patch('/users/:id/role', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (role !== 'admin' && role !== 'user') {
      res.status(400).json({ error: 'Rol inválido. Los roles permitidos son "admin" o "user".' });
      return;
    }

    // Prevent self-demotion to avoid losing all admins
    if (req.user!.id === id && role !== 'admin') {
      res.status(400).json({ error: 'No puedes revocar tus propios privilegios de administrador.' });
      return;
    }

    const checkRes = await query('SELECT id, email, name, role FROM users WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    const targetUser = checkRes.rows[0];

    await query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2',
      [role, id]
    );

    console.log(`[Admin] User ${targetUser.email} role changed to ${role} by admin ${req.user!.email}`);

    res.json({
      success: true,
      message: `Rol de ${targetUser.name || targetUser.email} actualizado a ${role}.`,
      role,
    });
  } catch (err: any) {
    console.error('Error updating user role:', err);
    res.status(500).json({ error: 'Error al actualizar el rol del usuario.' });
  }
});

export default router;

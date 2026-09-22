import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { generateAuthUrl, getOAuth2Client, syncUserProfileFromGoogle } from '../services/googleAuth.js';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /auth/google
router.get('/google', (req: Request, res: Response) => {
  const url = generateAuthUrl();
  res.redirect(url);
});

// GET /auth/google/callback
router.get('/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const error = req.query.error as string;

  if (error) {
    console.error('Google OAuth callback error:', error);
    res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent('Acceso denegado por Google')}`);
    return;
  }

  if (!code) {
    res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent('Código de autorización no recibido')}`);
    return;
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.email) {
      throw new Error('No se pudo obtener el correo del perfil de Google');
    }

    const email = profile.email.toLowerCase();
    const domain = email.split('@')[1];

    // Check domain restriction if enabled
    if (config.allowedDomains.length > 0 && !config.allowedDomains.includes('*') && !config.allowedDomains.includes(domain)) {
      console.warn(`Unauthorized login attempt from domain @${domain} (${email})`);
      res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(`Dominio @${domain} no autorizado. Solo cuentas @clevercloud.mx`)}`);
      return;
    }

    const userName = profile.name || email.split('@')[0];
    const defaultBotName = `${userName}'s Notetaker`;

    // Check if existing user is deactivated
    const existingUserRes = await query('SELECT id, is_active, role FROM users WHERE email = $1', [email]);
    if (existingUserRes.rows.length > 0 && !existingUserRes.rows[0].is_active) {
      console.warn(`Blocked login attempt for deactivated user ${email}`);
      res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent('Tu cuenta ha sido desactivada por un administrador. Contacta al administrador.')}`);
      return;
    }

    const isNewUser = existingUserRes.rows.length === 0;
    const initialRole = config.adminEmails.includes(email) ? 'admin' : 'user';

    // Insert or update user
    const userRes = await query(
      `INSERT INTO users (email, name, picture_url, google_tokens, bot_display_name, role, last_login_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         picture_url = EXCLUDED.picture_url,
         google_tokens = EXCLUDED.google_tokens,
         bot_display_name = COALESCE(users.bot_display_name, EXCLUDED.bot_display_name),
         last_login_at = NOW(),
         updated_at = NOW()
       RETURNING id, email, name, picture_url, bot_display_name, role, is_active, last_login_at`,
      [email, userName, profile.picture || null, JSON.stringify(tokens), defaultBotName, initialRole]
    );

    const user = userRes.rows[0];

    // Ensure default settings exist
    await query(
      `INSERT INTO user_settings (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );

    // Seed default blocklist rules for new users
    if (isNewUser) {
      const defaultRules = [
        { type: 'title_contains', val: 'Daily', reason: 'Regla por defecto: Reuniones Daily' },
        { type: 'title_contains', val: 'Clever Daily con Líderes', reason: 'Regla por defecto' },
        { type: 'title_contains', val: 'Clever - Sprint Plannig', reason: 'Regla por defecto' },
        { type: 'title_contains', val: 'Sprint Retrospective', reason: 'Regla por defecto' },
      ];

      for (const rule of defaultRules) {
        await query(
          `INSERT INTO meeting_blocklist (user_id, match_type, match_value, reason)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [user.id, rule.type, rule.val, rule.reason]
        );
      }
    }

    // Create JWT token
    const jwtToken = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: '30d' }
    );

    // Set cookie
    res.cookie('token', jwtToken, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: config.nodeEnv === 'production' ? 'lax' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    });

    res.redirect(`${config.frontendUrl}/dashboard?login=success`);
  } catch (err: any) {
    console.error('Error exchanging Google OAuth code:', err);
    res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(err.message || 'Error al autenticar con Google')}`);
  }
});

// GET /auth/me
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const settingsRes = await query('SELECT * FROM user_settings WHERE user_id = $1', [user.id]);

    // Keep profile picture & name in sync with Google in the background
    syncUserProfileFromGoogle(user.id).catch(() => {});

    res.json({
      user,
      settings: settingsRes.rows[0] || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token', { path: '/' });
  res.json({ success: true, message: 'Sesión cerrada exitosamente' });
});

export default router;

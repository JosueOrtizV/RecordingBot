import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { generateAuthUrl, getOAuth2Client } from '../services/googleAuth.js';
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

    // Insert or update user
    const userRes = await query(
      `INSERT INTO users (email, name, picture_url, google_tokens, bot_display_name, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         picture_url = EXCLUDED.picture_url,
         google_tokens = EXCLUDED.google_tokens,
         bot_display_name = COALESCE(users.bot_display_name, EXCLUDED.bot_display_name),
         updated_at = NOW()
       RETURNING id, email, name, picture_url, bot_display_name`,
      [email, userName, profile.picture || null, JSON.stringify(tokens), defaultBotName]
    );

    const user = userRes.rows[0];

    // Ensure default settings exist
    await query(
      `INSERT INTO user_settings (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );

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

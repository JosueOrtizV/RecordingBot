import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config.js';
import { query } from '../db.js';

export const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/drive.file',
];

export function getOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

export function generateAuthUrl(): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: OAUTH_SCOPES,
  });
}

export async function getUserOAuth2Client(userId: string): Promise<OAuth2Client> {
  const res = await query('SELECT google_tokens FROM users WHERE id = $1', [userId]);
  if (res.rows.length === 0) {
    throw new Error('Usuario no encontrado');
  }

  const tokens = res.rows[0].google_tokens;
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(tokens);

  // Auto-refresh event handler
  oauth2Client.on('tokens', async (newTokens) => {
    try {
      const currentRes = await query('SELECT google_tokens FROM users WHERE id = $1', [userId]);
      const currentTokens = currentRes.rows[0]?.google_tokens || {};
      const merged = { ...currentTokens, ...newTokens };
      await query('UPDATE users SET google_tokens = $1, updated_at = NOW() WHERE id = $2', [
        JSON.stringify(merged),
        userId,
      ]);
    } catch (err) {
      console.error('Error updating refreshed tokens in DB for user', userId, err);
    }
  });

  return oauth2Client;
}

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

export async function getUserDriveFolderId(userId: string): Promise<string | null> {
  try {
    const settingsRes = await query(
      'SELECT drive_folder_name, drive_folder_id FROM user_settings WHERE user_id = $1',
      [userId]
    );
    const folderName = settingsRes.rows[0]?.drive_folder_name || 'RecordingBot';
    const existingFolderId = settingsRes.rows[0]?.drive_folder_id;

    const auth = await getUserOAuth2Client(userId);
    const drive = google.drive({ version: 'v3', auth });

    if (existingFolderId) {
      try {
        const check = await drive.files.get({ fileId: existingFolderId, fields: 'id, name, trashed' });
        if (check.data.id && !check.data.trashed) {
          return check.data.id;
        }
      } catch (e) {
        // Folder check failed, re-search below
      }
    }

    // Search for existing folder by name
    const listRes = await drive.files.list({
      q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (listRes.data.files && listRes.data.files.length > 0) {
      const folderId = listRes.data.files[0].id!;
      await query(
        'UPDATE user_settings SET drive_folder_id = $1, updated_at = NOW() WHERE user_id = $2',
        [folderId, userId]
      );
      return folderId;
    }

    // Create if not found
    const createRes = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    });

    const newFolderId = createRes.data.id!;
    await query(
      'UPDATE user_settings SET drive_folder_id = $1, updated_at = NOW() WHERE user_id = $2',
      [newFolderId, userId]
    );
    return newFolderId;
  } catch (err) {
    console.warn('Error resolving user drive folder for user', userId, err);
    return null;
  }
}

export async function setDriveFilePublic(userId: string, fileId: string): Promise<boolean> {
  try {
    const auth = await getUserOAuth2Client(userId);
    const drive = google.drive({ version: 'v3', auth });

    // Check existing permissions to prevent duplicate anyone permission
    const listRes = await drive.permissions.list({ fileId, fields: 'permissions(id, type, role)' });
    const hasPublic = listRes.data.permissions?.some((p) => p.type === 'anyone');

    if (!hasPublic) {
      await drive.permissions.create({
        fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
    }
    return true;
  } catch (err) {
    console.warn('Error setting Drive file public permission:', err);
    return false;
  }
}

export async function setDriveFilePrivate(userId: string, fileId: string): Promise<boolean> {
  try {
    const auth = await getUserOAuth2Client(userId);
    const drive = google.drive({ version: 'v3', auth });

    const listRes = await drive.permissions.list({ fileId, fields: 'permissions(id, type, role)' });
    const anyonePerm = listRes.data.permissions?.find((p) => p.type === 'anyone');

    if (anyonePerm && anyonePerm.id) {
      await drive.permissions.delete({
        fileId,
        permissionId: anyonePerm.id,
      });
    }
    return true;
  } catch (err) {
    console.warn('Error revoking Drive file public permission:', err);
    return false;
  }
}

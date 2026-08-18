import fs from 'fs';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { config } from './config';
import { logger } from './logger';

export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/drive.file'
];

interface CredentialsFile {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

export function getOAuth2Client(): OAuth2Client {
  if (!fs.existsSync(config.credentialsPath)) {
    throw new Error(`Credentials file not found at: ${config.credentialsPath}`);
  }

  const content = fs.readFileSync(config.credentialsPath, 'utf8');
  const credentials: CredentialsFile = JSON.parse(content);
  const keys = credentials.installed || credentials.web;

  if (!keys) {
    throw new Error('Invalid credentials.json format: Missing "installed" or "web" section.');
  }

  const redirectUri = keys.redirect_uris?.[0] || 'http://localhost';
  const oauth2Client = new google.auth.OAuth2(
    keys.client_id,
    keys.client_secret,
    redirectUri
  );

  if (fs.existsSync(config.tokenPath)) {
    try {
      const tokenContent = fs.readFileSync(config.tokenPath, 'utf8');
      const tokens = JSON.parse(tokenContent);
      oauth2Client.setCredentials(tokens);

      oauth2Client.on('tokens', (newTokens) => {
        logger.info('OAuth tokens refreshed automatically');
        const currentTokens = JSON.parse(fs.readFileSync(config.tokenPath, 'utf8'));
        const merged = { ...currentTokens, ...newTokens };
        fs.writeFileSync(config.tokenPath, JSON.stringify(merged, null, 2));
      });
    } catch (err) {
      logger.error('Error reading token.json:', err);
    }
  }

  return oauth2Client;
}

export function isAuthorized(): boolean {
  if (!fs.existsSync(config.tokenPath)) {
    return false;
  }
  try {
    const token = JSON.parse(fs.readFileSync(config.tokenPath, 'utf8'));
    return Boolean(token.access_token || token.refresh_token);
  } catch {
    return false;
  }
}

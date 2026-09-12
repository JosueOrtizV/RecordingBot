import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

// Attempt to read Google credentials from file as fallback if env vars not provided
let fileClientId = '';
let fileClientSecret = '';
let fileRedirectUri = '';

const credPath = process.env.GOOGLE_CREDENTIALS_PATH || path.resolve(process.cwd(), 'credentials.json');
if (fs.existsSync(credPath)) {
  try {
    const credContent = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    const keys = credContent.web || credContent.installed;
    if (keys) {
      fileClientId = keys.client_id || '';
      fileClientSecret = keys.client_secret || '';
      fileRedirectUri = keys.redirect_uris?.[0] || '';
    }
  } catch (e) {
    console.warn('Could not parse credentials.json for fallback:', e);
  }
}

export const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'recordingbot-super-secret-jwt-key-change-in-prod',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  allowedDomains: (process.env.ALLOWED_EMAIL_DOMAINS || 'clevercloud.mx').split(',').map(d => d.trim().toLowerCase()),
  adminEmails: (process.env.ADMIN_EMAILS || 'josue.ortiz@clevercloud.mx').split(',').map(e => e.trim().toLowerCase()),

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || fileClientId,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || fileClientSecret,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || fileRedirectUri || (process.env.NODE_ENV === 'production' 
      ? 'https://recordingbot.josueortiz.dev/auth/google/callback' 
      : 'http://localhost:3002/auth/google/callback'),
  },

  db: {
    host: process.env.POSTGRES_HOST || 'postgres',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    user: process.env.POSTGRES_USER || 'recordingbot',
    password: process.env.POSTGRES_PASSWORD || 'recordingbot_secure_password',
    database: process.env.POSTGRES_DB || 'recordingbot',
  },

  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    queueName: process.env.REDIS_QUEUE_NAME || 'jobs:meetbot:list',
    recordingList: process.env.NOTIFY_REDIS_LIST || 'jobs:meetbot:recordings',
    failureList: process.env.NOTIFY_REDIS_FAILURE_LIST || 'jobs:meetbot:failures',
  },

  timezone: process.env.TIMEZONE || 'America/Mexico_City',
  botDisplayName: process.env.BOT_DISPLAY_NAME || "Josue's Notetaker",
};

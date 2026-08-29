import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  timezone: process.env.TIMEZONE || 'America/Mexico_City',
  botDisplayName: process.env.BOT_DISPLAY_NAME || "Josue's Notetaker",
  
  // Google Credentials & Tokens
  credentialsPath: process.env.GOOGLE_CREDENTIALS_PATH || path.resolve(process.cwd(), 'credentials.json'),
  tokenPath: process.env.GOOGLE_TOKEN_PATH || path.resolve(process.cwd(), 'token.json'),
  
  // Redis Queue
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
  redisDb: parseInt(process.env.REDIS_DB || '0', 10),
  redisQueueName: process.env.REDIS_QUEUE_NAME || 'jobs:meetbot:list',
  redisRecordingList: process.env.NOTIFY_REDIS_LIST || 'jobs:meetbot:recordings',
  redisFailureList: process.env.NOTIFY_REDIS_FAILURE_LIST || 'jobs:meetbot:failures',

  // Polling settings
  pollIntervalMinutes: parseInt(process.env.CALENDAR_POLL_INTERVAL_MINUTES || '2', 10),
  leadTimeMinutes: parseInt(process.env.LEAD_TIME_MINUTES || '5', 10), // dispatch 5 min before meeting
  
  // Database
  db: {
    host: process.env.POSTGRES_HOST || 'postgres',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    user: process.env.POSTGRES_USER || 'recordingbot',
    password: process.env.POSTGRES_PASSWORD || 'recordingbot_secure_password',
    database: process.env.POSTGRES_DB || 'recordingbot',
  },

  // Telegram
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
};

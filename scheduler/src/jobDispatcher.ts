import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config';
import { logger } from './logger';
import { sendTelegramAlert } from './telegramNotifier';

export interface MeetingJobPayload {
  provider: 'google';
  url: string;
  name: string;
  botId: string;
  eventId: string;
  userId: string;
  teamId: string;
  timezone: string;
  meetingTitle?: string;
  recordingMode?: string;
  userTokens?: any;
  driveFolderName?: string;
  dedupGroupId?: string;
}

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: config.redisHost,
      port: config.redisPort,
      db: config.redisDb,
      maxRetriesPerRequest: 3,
    });

    redisClient.on('connect', () => {
      logger.info(`Connected to Redis at ${config.redisHost}:${config.redisPort}`);
    });

    redisClient.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });
  }
  return redisClient;
}

export async function dispatchMeetingJob(meeting: {
  url: string;
  title: string;
  startTime: Date;
  eventId: string;
  userId?: string;
  botName?: string;
  recordingMode?: string;
  userTokens?: any;
  driveFolderName?: string;
  dedupGroupId?: string;
}): Promise<string> {
  const redis = getRedisClient();
  const botId = uuidv4();

  const payload: MeetingJobPayload = {
    provider: 'google',
    url: meeting.url,
    name: meeting.botName || config.botDisplayName,
    botId,
    eventId: meeting.eventId,
    userId: meeting.userId || 'josue',
    teamId: 'recording-bot',
    timezone: config.timezone,
    meetingTitle: meeting.title,
    recordingMode: meeting.recordingMode || 'video',
    userTokens: meeting.userTokens,
    driveFolderName: meeting.driveFolderName || 'RecordingBot',
    dedupGroupId: meeting.dedupGroupId,
  };

  logger.info(`Enqueuing meeting job to Redis [${config.redisQueueName}]:`, {
    botId,
    url: payload.url,
    title: payload.meetingTitle,
    userId: payload.userId,
    mode: payload.recordingMode,
  });

  await redis.lpush(config.redisQueueName, JSON.stringify(payload));

  await sendTelegramAlert(
    `🤖 *Bot Despachado*\n` +
    `📌 Reunión: *${meeting.title}*\n` +
    `🔗 Enlace: ${meeting.url}\n` +
    `👤 Nombre: ${payload.name}\n` +
    `🕒 Inicio: ${meeting.startTime.toLocaleTimeString('es-MX', { timeZone: config.timezone })}`
  );

  return botId;
}


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
}): Promise<string> {
  const redis = getRedisClient();
  const botId = uuidv4();

  const payload: MeetingJobPayload = {
    provider: 'google',
    url: meeting.url,
    name: config.botDisplayName,
    botId,
    eventId: meeting.eventId,
    userId: 'josue',
    teamId: 'recording-bot',
    timezone: config.timezone,
    meetingTitle: meeting.title,
  };

  logger.info(`Enqueuing meeting job to Redis [${config.redisQueueName}]:`, payload);

  await redis.lpush(config.redisQueueName, JSON.stringify(payload));

  await sendTelegramAlert(
    `🤖 *Bot Despachado*\n` +
    `📌 Reunión: *${meeting.title}*\n` +
    `🔗 Enlace: ${meeting.url}\n` +
    `👤 Nombre: ${config.botDisplayName}\n` +
    `🕒 Inicio: ${meeting.startTime.toLocaleTimeString('es-MX', { timeZone: config.timezone })}`
  );

  return botId;
}

import Redis from 'ioredis';
import { config } from '../config.js';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      maxRetriesPerRequest: 3,
    });

    redisClient.on('connect', () => {
      console.log(`[Dashboard-API] Connected to Redis at ${config.redis.host}:${config.redis.port}`);
    });

    redisClient.on('error', (err) => {
      console.error('[Dashboard-API] Redis connection error:', err);
    });
  }
  return redisClient;
}

export async function pushMeetingJob(jobPayload: any): Promise<number> {
  const redis = getRedisClient();
  return await redis.lpush(config.redis.queueName, JSON.stringify(jobPayload));
}

export async function getQueueStats(): Promise<{ pending: number; processing: number }> {
  const redis = getRedisClient();
  const [pending, processing] = await Promise.all([
    redis.llen(config.redis.queueName),
    redis.llen('jobs:meetbot:processing'),
  ]);
  return { pending, processing };
}

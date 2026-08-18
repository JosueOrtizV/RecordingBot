import { google } from 'googleapis';
import { getOAuth2Client, isAuthorized } from './auth';
import { logger } from './logger';
import { config } from './config';
import { dispatchMeetingJob } from './jobDispatcher';
import { sendTelegramAlert } from './telegramNotifier';

const dispatchedEvents = new Set<string>();

export function extractGoogleMeetUrl(event: any): string | null {
  if (event.hangoutLink) {
    return event.hangoutLink;
  }

  const entryPoints = event.conferenceData?.entryPoints || [];
  for (const entry of entryPoints) {
    if (entry.entryPointType === 'video' && entry.uri?.includes('meet.google.com')) {
      return entry.uri;
    }
  }

  // Check description or location as fallback
  const regex = /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i;
  const matchDesc = event.description?.match(regex);
  if (matchDesc) return matchDesc[0];

  const matchLoc = event.location?.match(regex);
  if (matchLoc) return matchLoc[0];

  return null;
}

export async function pollCalendar(): Promise<void> {
  if (!isAuthorized()) {
    logger.warn('Google OAuth is not authorized yet. Run "npm run auth" to authorize.');
    return;
  }

  try {
    const auth = getOAuth2Client();
    const calendar = google.calendar({ version: 'v3', auth });

    const now = new Date();
    const futureLimit = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours ahead

    logger.info(`Polling Google Calendar events between ${now.toISOString()} and ${futureLimit.toISOString()}`);

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: futureLimit.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = res.data.items || [];
    logger.info(`Found ${events.length} upcoming calendar event(s) in next 24 hours.`);

    for (const event of events) {
      if (!event.id || !event.start) continue;

      const startTimeStr = event.start.dateTime || event.start.date;
      if (!startTimeStr) continue;

      const startTime = new Date(startTimeStr);
      const meetUrl = extractGoogleMeetUrl(event);
      const title = event.summary || 'Reunión sin título';

      if (!meetUrl) {
        logger.debug(`Event "${title}" has no Google Meet link, skipping.`);
        continue;
      }

      const minutesUntilMeeting = (startTime.getTime() - now.getTime()) / (60 * 1000);
      const eventKey = `${event.id}_${startTime.getTime()}`;

      logger.info(`Detected Meet event: "${title}" | Starts in: ${minutesUntilMeeting.toFixed(1)} mins | URL: ${meetUrl}`);

      // Dispatch if within lead time (e.g. 5 minutes before meeting starts) and not yet dispatched
      if (minutesUntilMeeting <= config.leadTimeMinutes && minutesUntilMeeting >= -15) {
        if (!dispatchedEvents.has(eventKey)) {
          logger.info(`Dispatching bot for meeting "${title}"...`);
          await dispatchMeetingJob({
            url: meetUrl,
            title,
            startTime,
            eventId: event.id,
          });
          dispatchedEvents.add(eventKey);
        } else {
          logger.debug(`Event "${title}" was already dispatched.`);
        }
      }
    }
  } catch (err: any) {
    logger.error('Error while polling Google Calendar:', err?.message || err);
    if (err?.code === 401 || err?.response?.status === 401) {
      await sendTelegramAlert('⚠️ *RecordingBot Alerta*: El token de Google OAuth expiró o es inválido. Es necesario re-autenticar.');
    }
  }
}

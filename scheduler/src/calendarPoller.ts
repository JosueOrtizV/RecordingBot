import { google } from 'googleapis';
import { getOAuth2Client, isAuthorized } from './auth';
import { logger } from './logger';
import { config } from './config';
import { dispatchMeetingJob } from './jobDispatcher';
import { sendTelegramAlert } from './telegramNotifier';

interface DispatchedEvent {
  eventId: string;
  title: string;
  startTime: Date;
  endTime: Date;
}
const dispatchedEvents = new Map<string, DispatchedEvent>();

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
    const activeEventIds = new Set(events.map(e => e.id));

    // Check for canceled or rescheduled events
    for (const [key, dispatched] of dispatchedEvents.entries()) {
      if (dispatched.endTime.getTime() < now.getTime()) {
        dispatchedEvents.delete(key);
        continue;
      }
      
      if (!activeEventIds.has(dispatched.eventId)) {
        await sendTelegramAlert(`🗑️ *Reunión Cancelada o Reprogramada*\n\nSe ha eliminado del calendario la reunión *${dispatched.title}*. Si el bot ya estaba programado, es posible que entre y salga inmediatamente.`);
        dispatchedEvents.delete(key);
      }
    }

    for (const event of events) {
      if (!event.id || !event.start) continue;

      const startTimeStr = event.start.dateTime || event.start.date;
      const endTimeStr = event.end?.dateTime || event.end?.date;
      if (!startTimeStr) continue;

      const startTime = new Date(startTimeStr);
      // Fallback: if no end time, assume 1 hour duration
      const endTime = endTimeStr ? new Date(endTimeStr) : new Date(startTime.getTime() + 60 * 60 * 1000);
      
      const meetUrl = extractGoogleMeetUrl(event);
      const title = event.summary || 'Reunión sin título';

      if (!meetUrl) {
        logger.debug(`Event "${title}" has no Google Meet link, skipping.`);
        continue;
      }

      const minutesUntilMeeting = (startTime.getTime() - now.getTime()) / (60 * 1000);
      const eventKey = `${event.id}_${startTime.getTime()}`;

      logger.info(`Detected Meet event: "${title}" | Starts in: ${minutesUntilMeeting.toFixed(1)} mins | URL: ${meetUrl}`);

      if (minutesUntilMeeting <= config.leadTimeMinutes && minutesUntilMeeting >= -15) {
        if (!dispatchedEvents.has(eventKey)) {
          
          let hasOverlap = false;
          for (const [key, active] of dispatchedEvents.entries()) {
            if (startTime.getTime() < active.endTime.getTime() && endTime.getTime() > active.startTime.getTime()) {
              await sendTelegramAlert(`⚠️ *Conflicto de Reuniones*\n\nTienes 2 reuniones a la misma hora:\n1. ${active.title}\n2. ${title}\n\nEl bot solo grabará la primera (${active.title}).`);
              hasOverlap = true;
              break;
            }
          }

          if (hasOverlap) {
            dispatchedEvents.set(eventKey, { eventId: event.id, title, startTime, endTime });
            continue;
          }

          logger.info(`Dispatching bot for meeting "${title}"...`);
          await dispatchMeetingJob({
            url: meetUrl,
            title,
            startTime,
            eventId: event.id,
          });
          dispatchedEvents.set(eventKey, { eventId: event.id, title, startTime, endTime });
        } else {
          logger.debug(`Event "${title}" was already dispatched.`);
        }
      }
    }
  } catch (err: any) {
    logger.error('Error while polling Google Calendar:');
    logger.error(err?.stack || err);
    if (err?.response?.data) {
      logger.error('Error response data: ' + JSON.stringify(err.response.data));
    }
    if (err?.code === 401 || err?.response?.status === 401 || (err?.response?.data?.error === 'invalid_grant')) {
      await sendTelegramAlert('🚨 *RecordingBot Alerta*: El token de Google OAuth expiró o es inválido. Es necesario re-autenticar.');
    }
  }
}

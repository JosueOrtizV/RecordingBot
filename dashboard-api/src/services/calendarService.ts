import { google, calendar_v3 } from 'googleapis';
import { getUserOAuth2Client } from './googleAuth.js';
import { query } from '../db.js';

export function extractGoogleMeetUrl(event: calendar_v3.Schema$Event): string | null {
  if (event.hangoutLink && event.hangoutLink.includes('meet.google.com')) {
    return event.hangoutLink;
  }

  if (event.conferenceData?.entryPoints) {
    for (const ep of event.conferenceData.entryPoints) {
      if (ep.uri && ep.uri.includes('meet.google.com')) {
        return ep.uri;
      }
    }
  }

  const meetRegex = /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i;
  if (event.description) {
    const match = event.description.match(meetRegex);
    if (match) return match[0];
  }

  if (event.location) {
    const match = event.location.match(meetRegex);
    if (match) return match[0];
  }

  return null;
}

export async function isEventBlocked(userId: string, event: { title?: string | null; url?: string | null; eventId: string }): Promise<{ blocked: boolean; reason?: string }> {
  const blocklistRes = await query('SELECT * FROM meeting_blocklist WHERE user_id = $1', [userId]);
  for (const item of blocklistRes.rows) {
    if (item.match_type === 'url' && event.url && event.url.toLowerCase().includes(item.match_value.toLowerCase())) {
      return { blocked: true, reason: item.reason || 'Bloqueado por regla de URL' };
    }
    if (item.match_type === 'title_contains' && event.title && event.title.toLowerCase().includes(item.match_value.toLowerCase())) {
      return { blocked: true, reason: item.reason || 'Bloqueado por palabra clave en título' };
    }
    if (item.match_type === 'event_id' && event.eventId === item.match_value) {
      return { blocked: true, reason: item.reason || 'Bloqueado por ID de evento' };
    }
  }
  return { blocked: false };
}

export async function syncUserCalendar(userId: string): Promise<any[]> {
  const auth = await getUserOAuth2Client(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: next7Days.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = res.data.items || [];
  const processed: any[] = [];

  for (const event of events) {
    const meetUrl = extractGoogleMeetUrl(event);
    if (!meetUrl) continue; // Only process Google Meet events

    const startStr = event.start?.dateTime || event.start?.date;
    const endStr = event.end?.dateTime || event.end?.date;
    if (!startStr || !endStr) continue;

    const startTime = new Date(startStr);
    const endTime = new Date(endStr);
    const title = event.summary || 'Reunión sin título';
    const eventId = event.id || `event_${Date.now()}`;

    const blockCheck = await isEventBlocked(userId, { title, url: meetUrl, eventId });
    const willRecord = !blockCheck.blocked;

    const upsertRes = await query(
      `INSERT INTO scheduled_meetings (user_id, calendar_event_id, title, meet_url, start_time, end_time, will_record, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id, calendar_event_id) DO UPDATE SET
         title = EXCLUDED.title,
         meet_url = EXCLUDED.meet_url,
         start_time = EXCLUDED.start_time,
         end_time = EXCLUDED.end_time,
         updated_at = NOW()
       RETURNING *`,
      [userId, eventId, title, meetUrl, startTime, endTime, willRecord]
    );

    processed.push({
      ...upsertRes.rows[0],
      blockReason: blockCheck.blocked ? blockCheck.reason : null,
    });
  }

  return processed;
}

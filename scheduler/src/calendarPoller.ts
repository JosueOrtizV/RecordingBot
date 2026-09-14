import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import { getOAuth2Client, getUserOAuth2Client, isAuthorized } from './auth';
import { logger } from './logger';
import { config } from './config';
import { dispatchMeetingJob } from './jobDispatcher';
import { sendTelegramAlert } from './telegramNotifier';
import { query } from './db';

interface DispatchedEvent {
  eventId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  meetUrl: string;
}
const dispatchedEvents = new Map<string, DispatchedEvent>();

export function extractGoogleMeetUrl(event: any): string | null {
  if (event.hangoutLink && event.hangoutLink.includes('meet.google.com')) {
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

export async function isEventBlocked(userId: string, event: { title?: string | null; url?: string | null; eventId: string }): Promise<{ blocked: boolean; reason?: string }> {
  try {
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
  } catch (err) {
    logger.warn('Error checking blocklist from DB:', err);
  }
  return { blocked: false };
}

export async function pollCalendar(): Promise<void> {
  const now = new Date();
  const futureLimit = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours ahead

  // 1. Check if we have registered users in PostgreSQL
  let users: any[] = [];
  try {
    const usersRes = await query(
      `SELECT u.id, u.email, u.name, u.bot_display_name, u.google_tokens,
              s.enable_video, s.enable_audio, s.enable_transcription,
              s.drive_folder_name, s.auto_join, s.telegram_chat_id
       FROM users u
       LEFT JOIN user_settings s ON s.user_id = u.id
       WHERE u.is_active = true`
    );
    users = usersRes.rows;
  } catch (dbErr: any) {
    logger.warn(`Could not fetch users from DB: ${dbErr?.message || dbErr}. Will attempt single-user fallback.`);
  }

  // Fallback: If DB is empty, use legacy single-user token.json flow
  if (users.length === 0) {
    logger.info('No registered users in DB yet. Using legacy token.json flow.');
    await pollLegacyCalendar();
    return;
  }

  logger.info(`Polling calendars for ${users.length} active registered user(s)...`);

  // Map to collect pending meetings across all users for smart deduplication: meetUrl -> Array of user events
  const pendingByMeetUrl = new Map<string, Array<{
    user: any;
    event: any;
    startTime: Date;
    endTime: Date;
    title: string;
    eventId: string;
    recordingMode: string;
  }>>();

  for (const user of users) {
    if (!user.google_tokens || (!user.google_tokens.access_token && !user.google_tokens.refresh_token)) {
      logger.debug(`User ${user.email} has no valid OAuth tokens, skipping.`);
      continue;
    }

    try {
      const auth = getUserOAuth2Client(user.id, user.google_tokens);
      const calendar = google.calendar({ version: 'v3', auth });

      const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin: now.toISOString(),
        timeMax: futureLimit.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = res.data.items || [];
      logger.info(`User ${user.email}: found ${events.length} upcoming calendar event(s).`);

      for (const event of events) {
        if (!event.id || !event.start) continue;

        const startTimeStr = event.start.dateTime || event.start.date;
        const endTimeStr = event.end?.dateTime || event.end?.date;
        if (!startTimeStr) continue;

        const startTime = new Date(startTimeStr);
        const endTime = endTimeStr ? new Date(endTimeStr) : new Date(startTime.getTime() + 60 * 60 * 1000);
        const meetUrl = extractGoogleMeetUrl(event);
        const title = event.summary || 'Reunión sin título';

        if (!meetUrl) continue;

        // Check blocklist
        const blockCheck = await isEventBlocked(user.id, { title, url: meetUrl, eventId: event.id });
        const willRecord = !blockCheck.blocked && (user.auto_join !== false);

        // Sync to scheduled_meetings in DB
        let effectiveWillRecord = willRecord;
        try {
          const upsertRes = await query(
            `INSERT INTO scheduled_meetings (user_id, calendar_event_id, title, meet_url, start_time, end_time, will_record, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT (user_id, calendar_event_id) DO UPDATE SET
               title = EXCLUDED.title,
               meet_url = EXCLUDED.meet_url,
               start_time = EXCLUDED.start_time,
               end_time = EXCLUDED.end_time,
               will_record = CASE 
                 WHEN scheduled_meetings.manual_override IS NOT NULL THEN scheduled_meetings.manual_override 
                 ELSE EXCLUDED.will_record 
               END,
               updated_at = NOW()
             RETURNING will_record`,
            [user.id, event.id, title, meetUrl, startTime, endTime, willRecord]
          );
          if (upsertRes.rows.length > 0) {
            effectiveWillRecord = upsertRes.rows[0].will_record;
          }
        } catch (syncErr) {
          logger.warn('Failed to upsert scheduled meeting in DB:', syncErr);
        }

        if (!effectiveWillRecord) {
          logger.debug(`Meeting "${title}" for ${user.email} is blocked or auto-join is disabled.`);
          continue;
        }

        const minutesUntilMeeting = (startTime.getTime() - now.getTime()) / (60 * 1000);

        // Check if meeting falls into dispatch window (5 min lead time up to 15 min after start)
        if (minutesUntilMeeting <= config.leadTimeMinutes && minutesUntilMeeting >= -15) {
          const mode = user.enable_video ? 'video' : (user.enable_audio ? 'audio' : 'transcript_only');

          if (!pendingByMeetUrl.has(meetUrl)) {
            pendingByMeetUrl.set(meetUrl, []);
          }

          pendingByMeetUrl.get(meetUrl)!.push({
            user,
            event,
            startTime,
            endTime,
            title,
            eventId: event.id,
            recordingMode: mode,
          });
        }
      }
    } catch (userErr: any) {
      logger.error(`Error polling calendar for user ${user.email}:`, userErr?.message || userErr);
      if (userErr?.code === 401 || (userErr?.response?.data?.error === 'invalid_grant')) {
        logger.warn(`Token expired for user ${user.email}`);
      }
    }
  }

  // 2. Process and dispatch deduplicated meetings
  for (const [meetUrl, group] of pendingByMeetUrl.entries()) {
    if (group.length === 0) continue;

    const primary = group[0];
    const eventKey = `${meetUrl}_${primary.startTime.getTime()}`;

    if (dispatchedEvents.has(eventKey)) {
      logger.debug(`Meet URL "${meetUrl}" already dispatched for start time ${primary.startTime.toISOString()}.`);
      continue;
    }

    const dedupGroupId = group.length > 1 ? uuidv4() : undefined;
    const userNames = group.map(g => g.user.name || g.user.email).join(', ');

    if (group.length > 1) {
      logger.info(`[DEDUPLICATION] Meeting "${primary.title}" shared by ${group.length} users (${userNames}). Deploying ONLY 1 bot instance.`);
    }

    // Determine highest quality mode in group (if one user wants video, record video)
    let selectedMode = 'transcript_only';
    if (group.some(g => g.recordingMode === 'video')) selectedMode = 'video';
    else if (group.some(g => g.recordingMode === 'audio')) selectedMode = 'audio';

    logger.info(`Dispatching bot for meeting "${primary.title}" (${selectedMode}) with Meet URL: ${meetUrl}`);

    const botId = await dispatchMeetingJob({
      url: meetUrl,
      title: primary.title,
      startTime: primary.startTime,
      eventId: primary.eventId,
      userId: primary.user.id,
      botName: group.length > 1
        ? `RecordingBot (${group.map(g => (g.user.name || g.user.email.split('@')[0]).replace(/^Ing\.\s+/i, '').split(' ')[0]).join(' & ')})`
        : (primary.user.bot_display_name || (primary.user.name ? `${primary.user.name}'s Notetaker` : config.botDisplayName)),
      recordingMode: selectedMode,
      userTokens: primary.user.google_tokens,
      driveFolderName: primary.user.drive_folder_name || 'RecordingBot',
      dedupGroupId,
      telegramChatId: primary.user.telegram_chat_id,
    });

    // Mark scheduled meetings as dispatched and link dedup group in DB
    for (const item of group) {
      try {
        await query(
          `UPDATE scheduled_meetings
           SET dispatched = true, dedup_group_id = $1, recording_mode = $2, updated_at = NOW()
           WHERE user_id = $3 AND calendar_event_id = $4`,
          [dedupGroupId || null, selectedMode, item.user.id, item.eventId]
        );

        // Pre-create recording entry in DB (use botId for primary user to guarantee exact match on completion)
        const recordId = item.user.id === primary.user.id ? botId : uuidv4();
        await query(
          `INSERT INTO recordings (
             id, user_id, owner_user_id, meeting_title, meeting_url,
             calendar_event_id, recording_mode, status, dedup_group_id, started_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'recording', $8, NOW())
           ON CONFLICT (id) DO UPDATE SET status = 'recording'`,
          [recordId, item.user.id, primary.user.id, item.title, meetUrl, item.eventId, selectedMode, dedupGroupId || null]
        );
      } catch (dbErr) {
        logger.warn('Failed to record dispatched meeting in DB:', dbErr);
      }
    }

    dispatchedEvents.set(eventKey, {
      eventId: primary.eventId,
      title: primary.title,
      startTime: primary.startTime,
      endTime: primary.endTime,
      meetUrl,
    });
  }
}

async function pollLegacyCalendar(): Promise<void> {
  if (!isAuthorized()) {
    logger.warn('Google OAuth is not authorized yet. Run "npm run auth" or log in through the web dashboard.');
    return;
  }

  try {
    const auth = getOAuth2Client();
    const calendar = google.calendar({ version: 'v3', auth });

    const now = new Date();
    const futureLimit = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: futureLimit.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = res.data.items || [];
    for (const event of events) {
      if (!event.id || !event.start) continue;
      const startTimeStr = event.start.dateTime || event.start.date;
      if (!startTimeStr) continue;

      const startTime = new Date(startTimeStr);
      const meetUrl = extractGoogleMeetUrl(event);
      const title = event.summary || 'Reunión sin título';
      if (!meetUrl) continue;

      const minutesUntilMeeting = (startTime.getTime() - now.getTime()) / (60 * 1000);
      const eventKey = `${event.id}_${startTime.getTime()}`;

      if (minutesUntilMeeting <= config.leadTimeMinutes && minutesUntilMeeting >= -15) {
        if (!dispatchedEvents.has(eventKey)) {
          await dispatchMeetingJob({
            url: meetUrl,
            title,
            startTime,
            eventId: event.id,
          });
          dispatchedEvents.set(eventKey, { eventId: event.id, title, startTime, endTime: new Date(), meetUrl });
        }
      }
    }
  } catch (err: any) {
    logger.error('Error while polling legacy Google Calendar:', err?.message || err);
  }
}


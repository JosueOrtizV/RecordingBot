import { JoinParams } from './AbstractMeetBot';
import { BotStatus, WaitPromise } from '../types';
import config from '../config';
import { RecordingUploadFailedError, UnsupportedMeetingError, WaitingAtLobbyRetryError } from '../error';
import { patchBotStatus } from '../services/botService';
import { handleUnsupportedMeetingError, handleWaitingAtLobbyError, MeetBotBase } from './MeetBotBase';
import { v4 } from 'uuid';
import { IUploader } from '../middleware/disk-uploader';
import { Logger } from 'winston';
import { browserLogCaptureCallback } from '../util/logger';
import { getWaitingPromise } from '../lib/promise';
import { retryActionWithWait } from '../util/resilience';
import { uploadDebugImage } from '../services/bugService';
import createBrowserContext, { isExternalBrowserContext } from '../lib/chromium';
import { GOOGLE_LOBBY_MODE_HOST_TEXT, GOOGLE_REQUEST_DENIED, GOOGLE_REQUEST_TIMEOUT } from '../constants';
import { getRecordingMimeTypesForExtension } from '../lib/recording';
import { getGoogleMeetDisplayName } from '../util/googleMeetDisplayName';
import { CaptionTask } from '../tasks/CaptionTask';
import { activeBotRegistry } from '../lib/activeBots';
import { notifyRecordingStarted, notifyRecordingStatusChange } from '../services/notificationService';

export class GoogleMeetBot extends MeetBotBase {
  private _logger: Logger;
  private _correlationId: string;
  private isCancelledWithoutSave: boolean = false;
  private isPaused: boolean = false;
  private currentBotId?: string;
  private currentEventId?: string;
  private waitingPromise: WaitPromise | null = null;

  constructor(logger: Logger, correlationId: string) {
    super();
    this.slightlySecretId = v4();
    this._logger = logger;
    this._correlationId = correlationId;
  }

  async stop(save: boolean): Promise<{ success: boolean; message: string }> {
    this._logger.info(`Stop requested for GoogleMeetBot. Save: ${save}`);
    if (!save) {
      this.isCancelledWithoutSave = true;
    }

    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.evaluate(() => {
          if (typeof (window as any).__stopRecording === 'function') {
            (window as any).__stopRecording();
          }
        }).catch(() => {});
      }
    } catch (err) {
      this._logger.warn('Could not trigger in-page __stopRecording', err);
    }

    if (this.waitingPromise) {
      this.waitingPromise.resolveEarly();
    }

    if (!save) {
      try {
        if (this.page && !this.page.isClosed()) {
          await this.page.close().catch(() => {});
        }
      } catch (err) {
        this._logger.warn('Error closing page during non-save stop', err);
      }
    }

    return {
      success: true,
      message: save ? 'Guardando progreso y saliendo de la llamada...' : 'Cancelando y saliendo de la llamada...',
    };
  }

  async pause(): Promise<{ success: boolean; message: string; isPaused: boolean }> {
    this._logger.info(`Pause requested for GoogleMeetBot.`);
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.evaluate(() => {
          if (typeof (window as any).__pauseRecording === 'function') {
            (window as any).__pauseRecording();
          }
        }).catch(() => {});
      }
    } catch (err) {
      this._logger.warn('Could not trigger in-page __pauseRecording', err);
    }
    this.isPaused = true;
    return {
      success: true,
      message: 'Grabación pausada.',
      isPaused: true,
    };
  }

  async resume(): Promise<{ success: boolean; message: string; isPaused: boolean }> {
    this._logger.info(`Resume requested for GoogleMeetBot.`);
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.evaluate(() => {
          if (typeof (window as any).__resumeRecording === 'function') {
            (window as any).__resumeRecording();
          }
        }).catch(() => {});
      }
    } catch (err) {
      this._logger.warn('Could not trigger in-page __resumeRecording', err);
    }
    this.isPaused = false;
    return {
      success: true,
      message: 'Grabación reanudada.',
      isPaused: false,
    };
  }

  async join({ url, name, bearerToken, teamId, timezone, userId, eventId, botId, uploader, recordingMode, meetingTitle }: JoinParams): Promise<void> {
    const _state: BotStatus[] = ['processing'];
    this.currentBotId = botId;
    this.currentEventId = eventId;

    const handleUpload = async () => {
      this._logger.info('Begin recording upload to server', { userId, teamId });
      const uploadResult = await uploader.uploadRecordingToRemoteStorage();
      this._logger.info('Recording upload result', { uploadResult, userId, teamId });
      return uploadResult;
    };

    if (botId) {
      activeBotRegistry.register(botId, {
        botId,
        meetingTitle,
        url,
        userId,
        isPaused: () => this.isPaused,
        pause: () => this.pause(),
        resume: () => this.resume(),
        stop: (save) => this.stop(save),
      });
    }

    try {
      const pushState = (st: BotStatus) => _state.push(st);
      await this.joinMeeting({ url, name, bearerToken, teamId, timezone, userId, eventId, botId, uploader, pushState, recordingMode, meetingTitle });

      if (this.isCancelledWithoutSave) {
        this._logger.info('Recording was cancelled without save. Discarding files and skipping upload...', { botId, userId });
        await uploader.discard();
        _state.push('cancelled' as any);
        await patchBotStatus({ botId, eventId, provider: 'google', status: _state, token: bearerToken }, this._logger);
        return;
      }

      // Finish the upload from the temp video
      const uploadResult = await handleUpload();

      if (_state.includes('finished') && !uploadResult) {
        _state.splice(_state.indexOf('finished'), 1, 'failed');
        throw new RecordingUploadFailedError('Google Meet recording completed but upload failed');
      }

      await patchBotStatus({ botId, eventId, provider: 'google', status: _state, token: bearerToken }, this._logger);
    } catch(error) {
      if (!_state.includes('finished') && !_state.includes('failed'))
        _state.push('failed');

      await patchBotStatus({ botId, eventId, provider: 'google', status: _state, token: bearerToken }, this._logger);
      
      if (error instanceof WaitingAtLobbyRetryError) {
        await handleWaitingAtLobbyError({ token: bearerToken, botId, eventId, provider: 'google', error }, this._logger);
      } else if (error instanceof UnsupportedMeetingError) {
        await handleUnsupportedMeetingError({ token: bearerToken, botId, eventId, provider: 'google', error }, this._logger);
      }

      throw error;
    } finally {
      if (botId) {
        activeBotRegistry.unregister(botId);
      }

      try {
        const context = this.page?.context();
        const browser = context?.browser();
        if (isExternalBrowserContext(context)) {
          await this.page?.close().catch(() => {});
          await context?.close().catch(() => {});
          this._logger.info('External browser page and context closed in join finally');
        } else if (browser?.isConnected()) {
          await browser.close();
          this._logger.info('Browser closed in join finally');
        } else if (context) {
          await context.close();
          this._logger.info('Persistent browser context closed in join finally');
        }
      } catch (cleanupErr) {
        this._logger.warn('Browser cleanup in join finally failed (non-fatal)', { error: cleanupErr });
      }
    }
  }

  private async joinMeeting({ url, name, teamId, userId, eventId, botId, pushState, uploader, recordingMode, meetingTitle }: JoinParams & { pushState(state: BotStatus): void }): Promise<void> {
    this._logger.info('Launching browser...');

    this.page = await createBrowserContext(url, this._correlationId, 'google');

    // Force Spanish Mexico UI language so captions default to Spanish Mexico
    const meetUrl = new URL(url);
    meetUrl.searchParams.set('hl', 'es-MX');
    const finalUrl = meetUrl.toString();

    this._logger.info('Navigating to Google Meet URL...');
    await this.page.goto(finalUrl, { waitUntil: 'domcontentloaded' });

    const nameInputSelector = 'input[type="text"]';
    const clickContinueWithoutDevicesIfPresent = async (timeout = 5000) => {
      const continueWithoutDevicesButton = this.page
        .locator('button')
        .filter({ hasText: /Continue without microphone and camera|Ohne Mikrofon und Kamera fortfahren/i })
        .first();

      const hasContinuePrompt = await continueWithoutDevicesButton.isVisible({ timeout }).catch(() => false);
      if (hasContinuePrompt) {
        this._logger.info('Clicking Continue without microphone and camera button...');
        await continueWithoutDevicesButton.click();
        return true;
      }

      return false;
    };

    const waitForPreJoinReady = async () => {
      await clickContinueWithoutDevicesIfPresent();
      await this.page.locator(nameInputSelector).first().waitFor({ state: 'visible', timeout: 15000 });
    };

    try {
      await waitForPreJoinReady();
    } catch (dismissError) {
      this._logger.info('Continue without microphone and camera button is probably missing!...');
    }

    const verifyItIsOnGoogleMeetPage = async (): Promise<'SIGN_IN_PAGE' | 'GOOGLE_MEET_PAGE' | 'UNSUPPORTED_PAGE' | null> => {
      try {
        const detectSignInPage = async () => {
          let result = false;
          const url = await this.page.url();
          if (url.startsWith('https://accounts.google.com/')) {
            this._logger.info('Google Meet bot is on the sign in page...', { userId, teamId });
            result = true;
          }
          const signInPage = await this.page.locator('h1', { hasText: 'Sign in' });
          if (await signInPage.count() > 0 && await signInPage.isVisible()) {
            this._logger.info('Google Meet bot is on the page with "Sign in" heading...', { userId, teamId });
            result = result && true;
          }
          return result;
        };
        const pageUrl = await this.page.url();
        if (!pageUrl.includes('meet.google.com')) {
          const signInPage = await detectSignInPage();
          return signInPage ? 'SIGN_IN_PAGE' : 'UNSUPPORTED_PAGE';
        }
        return 'GOOGLE_MEET_PAGE';
      } catch(e) {
        this._logger.error('Error verifying if Google Meet bot is on the Google Meet page...', { error: e, message: e?.message });
        return null;
      }
    };

    const googleMeetPageStatus = await verifyItIsOnGoogleMeetPage();
    if (googleMeetPageStatus === 'SIGN_IN_PAGE') {
      this._logger.info('Exiting now as meeting requires sign in...', { googleMeetPageStatus, userId, teamId });
      throw new UnsupportedMeetingError('Meeting requires sign in', googleMeetPageStatus);
    }

    if (googleMeetPageStatus === 'UNSUPPORTED_PAGE') {
      this._logger.info('Google Meet bot is on the unsupported page...', { googleMeetPageStatus, userId, teamId });
    }

    const displayName = getGoogleMeetDisplayName(name);
    if (displayName !== name?.trim()) {
      this._logger.info('Adjusted Google Meet display name before joining...', {
        originalName: name,
        displayName,
        userId,
        teamId
      });
    }

    let joinedMeeting = false;
    const maxJoinRequestAttempts = Math.max(1, config.googleAnonymousJoinRequestAttempts);
    try {
      for (let joinRequestAttempt = 1; joinRequestAttempt <= maxJoinRequestAttempts; joinRequestAttempt++) {
        if (joinRequestAttempt > 1) {
          this._logger.info('Retrying anonymous Google Meet join request...', {
            joinRequestAttempt,
            maxJoinRequestAttempts,
            userId,
            teamId
          });

          await this.page.goto(finalUrl, { waitUntil: 'domcontentloaded' });

          try {
            await waitForPreJoinReady();
          } catch (dismissError) {
            this._logger.info('Continue without microphone and camera button is probably missing during retry!...');
          }
        }

        this._logger.info('Waiting for the input field to be visible...', {
          joinRequestAttempt,
          maxJoinRequestAttempts
        });
        await retryActionWithWait(
          'Waiting for the input field',
          async () => await this.page.locator(nameInputSelector).first().waitFor({ state: 'visible', timeout: 10000 }),
          this._logger,
          3,
          15000,
          async () => {
            await uploadDebugImage(await this.page.screenshot({ type: 'png', fullPage: true }), 'text-input-field-wait', userId, this._logger, botId);
          }
        );

        this._logger.info('Filling the input field with the name...');
        await this.page.locator(nameInputSelector).first().fill(displayName);
        
        await retryActionWithWait(
          'Clicking the "Ask to join" button',
          async () => {
            // Using the Order of most probable detection
            const possibleTexts = [
              'Ask to join',
              'Join now',
              'Join anyway',
              'Solicitar unirse',
              'Unirse ahora',
              'Teilnahme erbitten',
              'Jetzt teilnehmen',
              'Trotzdem teilnehmen',
            ];

            let buttonClicked = false;

            for (const text of possibleTexts) {
              try {
                const clickedByDomText = await this.page.evaluate((buttonText) => {
                  const buttons = Array.from(document.querySelectorAll('button'));
                  const button = buttons.find((element) => {
                    const rect = element.getBoundingClientRect();
                    const visible = rect.width > 0 && rect.height > 0;
                    return visible &&
                      !element.disabled &&
                      (element.innerText || '').toLowerCase().includes(buttonText.toLowerCase());
                  });

                  if (!button) {
                    return false;
                  }

                  button.click();
                  return true;
                }, text);

                if (clickedByDomText) {
                  buttonClicked = true;
                  this._logger.info(`Success clicked using "${text}" action...`, {
                    joinRequestAttempt,
                    maxJoinRequestAttempts
                  });
                  break;
                }

                const button = this.page.locator('button', { hasText: new RegExp(text, 'i') }).first();
                if (await button.isVisible({ timeout: 3000 }).catch(() => false) && await button.isEnabled({ timeout: 3000 }).catch(() => false)) {
                  await button.click({ timeout: 5000 });
                  buttonClicked = true;
                  this._logger.info(`Success clicked using "${text}" action...`, {
                    joinRequestAttempt,
                    maxJoinRequestAttempts
                  });
                  break;
                }
              } catch(err) {
                this._logger.warn(`Unable to click using "${text}" action...`);
              }
            }

            // Throws to initiate retries
            if (!buttonClicked) {
              throw new Error('Unable to complete the join action...');
            }
          },
          this._logger,
          3,
          15000,
          async () => {
            await uploadDebugImage(await this.page.screenshot({ type: 'png', fullPage: true }), 'ask-to-join-button-click', userId, this._logger, botId);
          }
        );

        await clickContinueWithoutDevicesIfPresent();

        // Do this to ensure meeting bot has joined the meeting
        const wanderingTime = config.joinWaitTime * 60 * 1000; // Give some time to admit the bot

        let waitTimeout: NodeJS.Timeout;
        let waitInterval: NodeJS.Timeout;
        let redirectedFromMeetUrl: string | undefined;
        let redirectedFromMeetBodyText: string | undefined;
        let lobbyRequestTimedOut = false;

        const waitAtLobbyPromise = new Promise<boolean>((resolveWaiting) => {
          waitTimeout = setTimeout(() => {
            clearInterval(waitInterval);
            resolveWaiting(false);
          }, wanderingTime);

          waitInterval = setInterval(async () => {
            try {
              const currentUrl = this.page.url();
              if (!currentUrl.includes('meet.google.com')) {
                redirectedFromMeetUrl = currentUrl;
                redirectedFromMeetBodyText = await this.page.evaluate(() => document.body.innerText).catch(() => '');
                this._logger.error('Google Meet Bot was redirected away from the meeting while waiting for admission...', {
                  currentUrl,
                  bodyText: redirectedFromMeetBodyText,
                  userId,
                  teamId,
                  joinRequestAttempt,
                  maxJoinRequestAttempts
                });

                clearInterval(waitInterval);
                clearTimeout(waitTimeout);

                try {
                  await uploadDebugImage(await this.page.screenshot({ type: 'png', fullPage: true }), 'google-meet-redirected-away', userId, this._logger, botId);
                } catch (debugImageError) {
                  this._logger.warn('Unable to upload Google Meet redirect debug image...', { error: debugImageError });
                }

                resolveWaiting(false);
                return;
              }

            const detectLobbyModeHostWaitingText = async (): Promise<'WAITING_FOR_HOST_TO_ADMIT_BOT' | 'WAITING_REQUEST_TIMEOUT' | 'LOBBY_MODE_NOT_ACTIVE' | 'UNABLE_TO_DETECT_LOBBY_MODE'> => {
              try {
                // Check whole-page text for lobby indicators (case-insensitive)
                const bodyText = (await this.page.evaluate(() => document.body.innerText).catch(() => ''))?.toLowerCase() || '';

                const isWaitingForHost = 
                  bodyText.includes('espera a que') ||
                  bodyText.includes('anfitrión de la reunión te agregue') ||
                  bodyText.includes('te agregue a la llamada') ||
                  bodyText.includes('solicitando unirse') ||
                  bodyText.includes('esperando a que te den acceso') ||
                  bodyText.includes('esperando al anfitrión') ||
                  bodyText.includes('please wait until a meeting host brings you') ||
                  bodyText.includes('someone will let you in soon') ||
                  bodyText.includes('someone let you into the meeting') ||
                  bodyText.includes('asking to join') ||
                  bodyText.includes('bitte warten sie, bis sie vom organisator') ||
                  bodyText.includes('teilnahme erbitten');

                if (isWaitingForHost) {
                  return 'WAITING_FOR_HOST_TO_ADMIT_BOT';
                }

                const isRequestTimedOut =
                  bodyText.includes('nadie ha respondido a tu solicitud') ||
                  bodyText.includes('no respondió a tu solicitud') ||
                  bodyText.includes('solicitud para unirte expiró') ||
                  bodyText.includes('no one replied to your request') ||
                  bodyText.includes('request to join timed out') ||
                  bodyText.includes('niemand hat auf ihre teilnahmeanfrage geantwortet') ||
                  bodyText.includes(GOOGLE_REQUEST_TIMEOUT.toLowerCase());

                if (isRequestTimedOut) {
                  return 'WAITING_REQUEST_TIMEOUT';
                }

                return 'LOBBY_MODE_NOT_ACTIVE';
              }
              catch (e: any) {
                this._logger.error('Error detecting lobby mode host waiting text...', { error: e, message: e?.message });
                return 'UNABLE_TO_DETECT_LOBBY_MODE';
              }
            };

            let peopleElement;
            let callButtonElement;
            let botWasDeniedAccess = false;

            try {
              peopleElement = await this.page.locator('button[aria-label^="People" i], button[aria-label^="Personen" i], button[aria-label^="Personas" i], button[aria-label^="Participantes" i]').first().isVisible({ timeout: 500 }).catch(() => false);
            } catch(e) {
              // do nothing
            }

            try {
              callButtonElement = await this.page.locator('button[aria-label="Leave call" i], button[aria-label="Anruf verlassen" i], button[aria-label="Abandonar la llamada" i]').first().isVisible({ timeout: 500 }).catch(() => false);
            } catch(e) {
              // do nothing
            }

            if (peopleElement || callButtonElement) {
              // Here check the "lobby mode" that waits for the Host to join the meeting or for the Host to admit the bot
              const lobbyModeHostWaitingText = await detectLobbyModeHostWaitingText();
              if (lobbyModeHostWaitingText === 'WAITING_FOR_HOST_TO_ADMIT_BOT') {
                this._logger.info('Lobby Mode: Google Meet Bot is waiting for the host to admit it...', { userId, teamId });
                return; // Keep waiting in lobby interval, do not start recording
              } else if (lobbyModeHostWaitingText === 'WAITING_REQUEST_TIMEOUT') {
                this._logger.info('Lobby Mode: Google Meet Bot join request timed out...', { userId, teamId });
                lobbyRequestTimedOut = true;
                clearInterval(waitInterval);
                clearTimeout(waitTimeout);
                resolveWaiting(false);
                return;
              } else {
                // Verify we are ACTUALLY inside the active meeting and NOT in any waiting state
                try {
                  const participantCountDetected = await this.page.evaluate(() => {
                    try {
                      const bodyText = (document.body.innerText || '').toLowerCase();

                      // STRICT LOBBY CHECK: If ANY waiting indicator is visible, we are definitely NOT in the call!
                      const hasLobbyIndicator = 
                        bodyText.includes('espera a que') ||
                        bodyText.includes('anfitrión de la reunión te agregue') ||
                        bodyText.includes('te agregue a la llamada') ||
                        bodyText.includes('solicitando unirse') ||
                        bodyText.includes('esperando a que te den acceso') ||
                        bodyText.includes('esperando al anfitrión') ||
                        bodyText.includes('please wait until a meeting host brings you') ||
                        bodyText.includes('someone will let you in soon') ||
                        bodyText.includes('someone let you into the meeting') ||
                        bodyText.includes('asking to join') ||
                        bodyText.includes('bitte warten sie') ||
                        bodyText.includes('you\'re the only one here') ||
                        bodyText.includes('you will join the call when');

                      if (hasLobbyIndicator) {
                        return false;
                      }

                      // 1. Look for People / Participantes button with participant count >= 1
                      const peopleButtons = document.querySelectorAll('button[aria-label*="People" i], button[aria-label*="Personen" i], button[aria-label*="Personas" i], button[aria-label*="Participantes" i]');
                      for (const btn of Array.from(peopleButtons)) {
                        const ariaLabel = btn.getAttribute('aria-label') || '';
                        const match = ariaLabel.match(/(?:People|Personen|Personas|Participantes).*?(\d+)/i);
                        if (match && parseInt(match[1], 10) >= 1) {
                          return true;
                        }
                      }

                      // 2. Look for active participant video tiles in the main meeting grid
                      const activeTiles = document.querySelectorAll('div[data-participant-id], div[data-requested-participant-id], div[data-initial-participant-id]');
                      if (activeTiles.length > 0) {
                        return true;
                      }

                      // 3. Look for explicit in-call notifications
                      if (bodyText.includes('you have joined the call') ||
                          bodyText.includes('estás en la llamada') ||
                          bodyText.includes('du nimmst an diesem anruf teil') ||
                          bodyText.includes('se unieron participantes externos') ||
                          bodyText.includes('people in the call') ||
                          bodyText.includes('personas en la llamada')) {
                        return true;
                      }

                      return false;
                    } catch (e) {
                      return false;
                    }
                  });

                  if (participantCountDetected) {
                    this._logger.info('Google Meet Bot is entering the meeting...', { userId, teamId });
                    clearInterval(waitInterval);
                    clearTimeout(waitTimeout);
                    resolveWaiting(true);
                    return;
                  } else {
                    this._logger.info('Waiting for admission into Google Meet (host has not admitted yet)...', { userId, teamId });
                    return;
                  }
                } catch (e) {
                  this._logger.error('Error checking participant visibility', { error: e });
                  return;
                }
              }              
            }

            try {
              const deniedText = await this.page.getByText(GOOGLE_REQUEST_DENIED);
              if (await deniedText.count() > 0 && await deniedText.isVisible()) {
                botWasDeniedAccess = true;
              }
            }
            catch(e) {
              //do nothing
            }
            if (botWasDeniedAccess) {
              this._logger.info('Google Meet Bot is denied access to the meeting...', { userId, teamId });
              clearInterval(waitInterval);
              clearTimeout(waitTimeout);
              resolveWaiting(false);
            }
          } catch(e) {
            this._logger.error(
              'wait error', { error: e }
            );
            // Do nothing
          }
        }, 2000);
      });

      const waitingAtLobbySuccess = await waitAtLobbyPromise;
      if (waitingAtLobbySuccess) {
        joinedMeeting = true;
        break;
      }

      if (!waitingAtLobbySuccess) {
        const bodyText = redirectedFromMeetBodyText ?? await this.page.evaluate(() => document.body.innerText);

        const userDenied = (bodyText || '')?.includes(GOOGLE_REQUEST_DENIED) || (bodyText || '')?.includes('rechazó tu solicitud') || (bodyText || '')?.includes('not allowed to join');
        const isWorkspaceHomepage = redirectedFromMeetUrl?.includes('workspace.google.com');

        this._logger.error('Cant finish wait at the lobby check', {
          userDenied,
          isWorkspaceHomepage,
          waitingAtLobbySuccess,
          redirectedFromMeetUrl,
          lobbyRequestTimedOut,
          joinRequestAttempt,
          maxJoinRequestAttempts,
          bodyText
        });

        const shouldRetryJoinRequest = !userDenied && !isWorkspaceHomepage &&
          joinRequestAttempt < maxJoinRequestAttempts &&
          (Boolean(redirectedFromMeetUrl) || lobbyRequestTimedOut);

        if (shouldRetryJoinRequest) {
          continue;
        }

        const errorMessage = redirectedFromMeetUrl ?
          `Google Meet bot was redirected away from the meeting while waiting for admission: ${redirectedFromMeetUrl}` :
          'Google Meet bot could not enter the meeting...';
        throw new WaitingAtLobbyRetryError(errorMessage, bodyText ?? '', false, 0);
      }
      }

      if (!joinedMeeting) {
        throw new WaitingAtLobbyRetryError('Google Meet bot could not enter the meeting...', '', false, 0);
      }
    } catch(lobbyError) {
      this._logger.info('Closing the browser on error...', lobbyError);
      if (isExternalBrowserContext(this.page.context())) {
        await this.page.close();
      } else {
        await this.page.context().browser()?.close();
      }

      throw lobbyError;
    }

    pushState('joined');

    try {
      this._logger.info('Waiting for the "Got it" button...');
      await this.page.waitForSelector('button:has-text("Got it")', { timeout: 3000 });

      this._logger.info('Going to click all visible "Got it" buttons...');

      let gotItButtonsClicked = 0;
      let previousButtonCount = -1;
      let consecutiveNoChangeCount = 0;
      const maxConsecutiveNoChange = 2; // Stop if button count doesn't change for 2 consecutive iterations

      while (true) {
        const visibleButtons = await this.page.locator('button:visible', {
          hasText: 'Got it',
        }).all();
      
        const currentButtonCount = visibleButtons.length;
        
        if (currentButtonCount === 0) {
          break;
        }
        
        // Check if button count hasn't changed (indicating we might be stuck)
        if (currentButtonCount === previousButtonCount) {
          consecutiveNoChangeCount++;
          if (consecutiveNoChangeCount >= maxConsecutiveNoChange) {
            this._logger.warn(`Button count hasn't changed for ${maxConsecutiveNoChange} iterations, stopping`);
            break;
          }
        } else {
          consecutiveNoChangeCount = 0;
        }
        
        previousButtonCount = currentButtonCount;

        for (const btn of visibleButtons) {
          try {
            await btn.click({ timeout: 5000 });
            gotItButtonsClicked++;
            this._logger.info(`Clicked a "Got it" button #${gotItButtonsClicked}`);
            
            await this.page.waitForTimeout(500);
          } catch (err) {
            this._logger.warn('Click failed, possibly already dismissed', { error: err });
          }
        }
      
        await this.page.waitForTimeout(500);
      }
    } catch (error) {
      // Log and ignore this error
      this._logger.info('"Got it" modals might be missing...', { error });
    }

    // Dismiss "Microphone not found" and "Camera not found" notifications if present
    try {
      this._logger.info('Checking for device notifications (microphone/camera)...');
      await this.page.mouse.move(10, 10).catch(() => {});
      const hasDeviceNotification = await this.page.evaluate(() => {
        const text = document.body.textContent || '';
        return text.includes('Microphone not found') ||
               text.includes('Make sure your microphone is plugged in') ||
               text.includes('Camera not found') ||
               text.includes('Make sure your camera is plugged in') ||
               text.includes('No se encontró el micrófono') ||
               text.includes('No se encontró una cámara') ||
               text.includes('Asegúrate de que el micrófono') ||
               text.includes('Asegúrate de que la cámara');
      });

      if (hasDeviceNotification) {
        this._logger.info('Found device notification (microphone/camera), attempting to dismiss...');
        // Try to find and click all close buttons
        const closeButtonsCount = await this.page.evaluate(() => {
          const allButtons = Array.from(document.querySelectorAll('button'));
          const closeButtons = allButtons.filter((btn) => {
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
            const matIcon = btn.querySelector('i')?.textContent?.trim().toLowerCase() || '';
            return ariaLabel.includes('close') ||
                   ariaLabel.includes('dismiss') ||
                   ariaLabel.includes('cerrar') ||
                   ariaLabel.includes('descartar') ||
                   matIcon === 'close';
          });

          let clickedCount = 0;
          closeButtons.forEach((btn) => {
            if (btn?.offsetParent !== null) {
              btn.click();
              clickedCount++;
            }
          });
          return clickedCount;
        });

        if (closeButtonsCount > 0) {
          this._logger.info(`Successfully dismissed ${closeButtonsCount} device notification(s)`);
          await this.page.waitForTimeout(500);
        } else {
          this._logger.warn('Could not find close button for device notifications');
        }
      }
    } catch (error) {
      this._logger.info('Error checking/dismissing device notifications...', { error });
    }

    // Recording the meeting page
    this._logger.info('Begin recording...', { recordingMode });
    await notifyRecordingStarted({
      recordingId: botId ?? eventId ?? userId,
      botId,
      eventId,
      userId,
      url,
      recordingMode,
      meetingTitle,
      dedupGroupId: uploader.dedupGroupId,
      timestamp: new Date().toISOString(),
    }, this._logger).catch(err => this._logger.warn('Failed to notify recording started:', err));

    await this.recordMeetingPage({ teamId, eventId, userId, botId, botName: name, uploader, recordingMode, meetingTitle });

    pushState('finished');
  }

  private async sendMeetingChatMessage(customMessage?: string, botName?: string): Promise<void> {
    try {
      this._logger.info('[ChatNotification]: Attempting to send message to Google Meet chat...', { customMessage: !!customMessage });
      await this.page.waitForTimeout(1000);

      // 1. Dismiss any blocking notifications (like "No se encontró una cámara")
      await this.page.evaluate(() => {
        const dismissButtons = document.querySelectorAll('button[aria-label="Cerrar"], button[aria-label="Close"], button[aria-label="Cerrar notificación"]');
        dismissButtons.forEach(btn => (btn as HTMLElement).click());
      });
      await this.page.waitForTimeout(300);

      // 2. Check if chat is already open or click to open it
      const chatState = await this.page.evaluate(() => {
        const existingTextarea = Array.from(document.querySelectorAll('textarea')).find(ta => (ta as HTMLElement).offsetParent !== null);
        if (existingTextarea) {
          return { ready: true, wasAlreadyOpen: true };
        }
        const btns = Array.from(document.querySelectorAll('button'));
        for (const btn of btns) {
          const label = btn.getAttribute('aria-label')?.toLowerCase() || '';
          if (btn.getBoundingClientRect().width > 0 && 
             (label.includes('chatear') || label.includes('chat con') || label === 'chat' || btn.dataset.panelId === '2')) {
            btn.click();
            return { ready: true, wasAlreadyOpen: false };
          }
        }
        return { ready: false, wasAlreadyOpen: false };
      });

      if (chatState.ready) {
        // Wait for the panel animation to finish if it was newly opened
        if (!chatState.wasAlreadyOpen) {
          await this.page.waitForTimeout(1500);
        }
        
        // Find ALL textareas and look for the one that is actually visible on screen
        const textareas = this.page.locator('textarea');
        const count = await textareas.count();
        let targetTextarea = null;

        for (let i = 0; i < count; i++) {
          const ta = textareas.nth(i);
          const isVis = await ta.isVisible().catch(() => false);
          if (isVis) {
            targetTextarea = ta;
            break;
          }
        }

        if (targetTextarea) {
          const defaultWelcome = `🤖 RecordingBot está grabando y generando la minuta de esta reunión.
Al continuar, aceptas la política de privacidad: https://recordingbot.josueortiz.dev/privacy

Comandos de chat disponibles:
• /bot pause  — Pausar grabación
• /bot resume — Reanudar grabación
• /bot leave  — Detener grabación y salir`;

          const messageText = customMessage || defaultWelcome;
          await targetTextarea.fill(messageText);
          await this.page.waitForTimeout(400);
          
          // Press Enter to send
          await this.page.keyboard.press('Enter');
          
          // Also try clicking the send button if available
          const sendButton = this.page.locator('button[aria-label*="Enviar" i], button[aria-label*="Send" i], button i:has-text("send")').first();
          if (await sendButton.count() > 0 && await sendButton.isEnabled().catch(() => false)) {
            await sendButton.click({ timeout: 2000, force: true }).catch(() => null);
          }

          this._logger.info('[ChatNotification]: Successfully sent message to chat');
          await this.page.waitForTimeout(800);

          // Close the chat panel to restore clean UI view if it wasn't open before
          if (!chatState.wasAlreadyOpen) {
            await this.page.evaluate(() => {
              const closeBtns = Array.from(document.querySelectorAll('button'));
              for (const btn of closeBtns) {
                const label = btn.getAttribute('aria-label')?.toLowerCase() || '';
                if (btn.getBoundingClientRect().width > 0 && (label === 'cerrar' || label === 'close' || label.includes('cerrar chat'))) {
                  btn.click();
                }
              }
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
              }
            });
            await this.page.mouse.move(10, 10).catch(() => {});
          }
        } else {
          this._logger.warn('[ChatNotification]: Chat textarea not found or not visible');
        }
      } else {
        this._logger.warn('[ChatNotification]: Chat button not found on control bar');
      }
    } catch (chatError) {
      this._logger.warn('[ChatNotification]: Failed to send chat message:', chatError);
    }
  }

  private async recordMeetingPage(
    { teamId, userId, eventId, botId, botName, uploader, recordingMode, meetingTitle }: 
    { teamId: string, userId: string, eventId?: string, botId?: string, botName?: string, uploader: IUploader, recordingMode?: string, meetingTitle?: string }
  ): Promise<void> {
    const duration = config.maxRecordingDuration * 60 * 1000;
    const inactivityLimit = config.inactivityLimit * 60 * 1000;
    const loneParticipantExitDelayMs = config.loneParticipantExitDelaySeconds * 1000;
    const isAudioOnly = recordingMode === 'audio';

    const processingTime = 0.2 * 60 * 1000;
    const waitingPromise: WaitPromise = getWaitingPromise(processingTime + duration);
    this.waitingPromise = waitingPromise;

    // Start Closed Captions extractor with meeting title for formatted headers
    const captionTask = new CaptionTask(this.page, this._logger, this.slightlySecretId, meetingTitle);
    try {
      await captionTask.start();
    } catch (captionErr) {
      this._logger.warn('Could not start CaptionTask:', captionErr);
    }

    // Capture and send the browser console logs to Node.js context
    this.page?.on('console', async msg => {
      try {
        await browserLogCaptureCallback(this._logger, msg);
      } catch(err) {
        this._logger.info('Playwright chrome logger: Failed to log browser messages...', err?.message);
      }
    });

    await this.page.exposeFunction('screenAppSendData', async (slightlySecretId: string, data: string) => {
      if (slightlySecretId !== this.slightlySecretId) return;

      const buffer = Buffer.from(data, 'base64');
      await uploader.saveDataToTempFile(buffer);
    });

    await this.page.exposeFunction('screenAppMeetEnd', (slightlySecretId: string, recordedDurationSeconds?: number) => {
      if (slightlySecretId !== this.slightlySecretId) return;
      try {
        if (typeof recordedDurationSeconds === 'number') {
          uploader.setRecordingDuration(recordedDurationSeconds);
        }
        this._logger.info('Attempt to end meeting early...');
        waitingPromise.resolveEarly();
      } catch (error) {
        console.error('Could not process meeting end event', error);
      }
    });

    await this.page.exposeFunction('screenAppMeetStarted', (slightlySecretId: string, timestampMs: number) => {
      if (slightlySecretId !== this.slightlySecretId) return;
      try {
        if (typeof timestampMs === 'number' && timestampMs > 0) {
          const startedAt = new Date(timestampMs);
          if (uploader.setRecordingStartedAt) {
            uploader.setRecordingStartedAt(startedAt);
          }
          this._logger.info(`[GoogleMeetBot]: Media recording officially started at ${startedAt.toISOString()}`);
        }
      } catch (error) {
        console.error('Could not process meeting start event', error);
      }
    });

    await this.page.exposeFunction('screenAppMeetPaused', (slightlySecretId: string) => {
      if (slightlySecretId !== this.slightlySecretId) return;
      this.isPaused = true;
      this._logger.info('[GoogleMeetBot]: In-page recording paused event received.');
    });

    await this.page.exposeFunction('screenAppMeetResumed', (slightlySecretId: string) => {
      if (slightlySecretId !== this.slightlySecretId) return;
      this.isPaused = false;
      this._logger.info('[GoogleMeetBot]: In-page recording resumed event received.');
    });

    await this.page.exposeFunction('screenAppOnChatCommand', async (slightlySecretId: string, cmd: string) => {
      if (slightlySecretId !== this.slightlySecretId) return;
      this._logger.info(`[GoogleMeetBot]: Chat command received: "${cmd}"`);

      const targetId = botId || eventId;
      if (cmd === 'pause') {
        await this.pause();
        if (targetId) {
          await notifyRecordingStatusChange({ recordingId: targetId, botId: targetId, status: 'paused', timestamp: new Date().toISOString() }, this._logger).catch(() => {});
        }
        this.sendMeetingChatMessage("⏸️ Grabación pausada por solicitud en el chat. Escribe '/bot resume' para reanudar.").catch(() => {});
      } else if (cmd === 'resume') {
        await this.resume();
        if (targetId) {
          await notifyRecordingStatusChange({ recordingId: targetId, botId: targetId, status: 'recording', timestamp: new Date().toISOString() }, this._logger).catch(() => {});
        }
        this.sendMeetingChatMessage("▶️ Grabación reanudada.").catch(() => {});
      } else if (cmd === 'stop') {
        this.sendMeetingChatMessage("👋 Guardando grabación y saliendo de la llamada...").catch(() => {});
        await new Promise(r => setTimeout(r, 1500));
        await this.stop(true);
      }
    });

    const { mimeTypes } = getRecordingMimeTypesForExtension(config.uploaderFileExtension, isAudioOnly);

    // Inject the MediaRecorder code into the browser context using page.evaluate
    await this.page.evaluate(
      async ({ teamId, duration, inactivityLimit, loneParticipantExitDelayMs, userId, slightlySecretId, activateInactivityDetectionAfter, activateInactivityDetectionAfterMinutes, mimeTypes, recordingMode }:
      { teamId:string, userId: string, duration: number, inactivityLimit: number, loneParticipantExitDelayMs: number, slightlySecretId: string, activateInactivityDetectionAfter: string, activateInactivityDetectionAfterMinutes: number, mimeTypes: string[], recordingMode?: string }) => {
        let timeoutId: NodeJS.Timeout;
        let inactivitySilenceDetectionTimeout: NodeJS.Timeout;
        let isOnValidGoogleMeetPageInterval: NodeJS.Timeout;

        const sendChunkToServer = async (chunk: ArrayBuffer) => {
          function arrayBufferToBase64(buffer: ArrayBuffer) {
            let binary = '';
            const bytes = new Uint8Array(buffer);
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
          }
          const base64 = arrayBufferToBase64(chunk);
          await (window as any).screenAppSendData(slightlySecretId, base64);
        };

        async function startRecording() {
          console.log('Participant detection is active immediately; silence detection activates after', activateInactivityDetectionAfter);

          const isTranscriptOnlyMode = recordingMode === 'transcript_only';
          const isAudioOnlyMode = recordingMode === 'audio';

          let chunkUploadChain: Promise<void> = Promise.resolve();
          let isStoppingRecording = false;
          let stream: MediaStream | null = null;
          let mediaRecorder: MediaRecorder | null = null;
          let hasAudioTracks = false;

          if (!isTranscriptOnlyMode) {
            // Check for the availability of the mediaDevices API
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
              console.error('MediaDevices or getDisplayMedia not supported in this browser.');
              return;
            }
            
            stream = await (navigator.mediaDevices as any).getDisplayMedia({
              video: {
                displaySurface: 'browser',
                width: { ideal: 1280, max: 1280 },
                height: { ideal: 720, max: 720 },
                frameRate: isAudioOnlyMode ? { ideal: 5, max: 10 } : { ideal: 20, max: 20 },
              },
              audio: {
                autoGainControl: false,
                channels: 2,
                channelCount: 2,
                echoCancellation: false,
                noiseSuppression: false,
              },
              preferCurrentTab: true,
            });

            // Check if we actually got audio tracks
            const audioTracks = stream.getAudioTracks();
            hasAudioTracks = audioTracks.length > 0;
            
            if (!hasAudioTracks) {
              console.warn('No audio tracks available for silence detection. Will rely only on presence detection.');
            }

            const streamToRecord = isAudioOnlyMode && hasAudioTracks ? new MediaStream(audioTracks) : stream;

            const selectedMimeType = mimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
            if (!selectedMimeType) {
              throw new Error(`MediaRecorder does not support requested codecs: ${mimeTypes.join(', ')}`);
            }

            console.log(`Media Recorder will use ${selectedMimeType} codecs (Mode: ${recordingMode})...`);
            const recorderOptions: any = {
              mimeType: selectedMimeType,
              ...(isAudioOnlyMode
                ? { audioBitsPerSecond: 128000 }
                : { videoBitsPerSecond: 1500000, audioBitsPerSecond: 128000 }),
            };
            mediaRecorder = new MediaRecorder(streamToRecord, recorderOptions);
            console.log(`Media Recorder actual mime type: ${mediaRecorder.mimeType}`);

            mediaRecorder.ondataavailable = (event: BlobEvent) => {
              if (!event.data.size) {
                console.warn('Received empty chunk...');
                return;
              }

              const chunk = event.data;
              chunkUploadChain = chunkUploadChain.then(async () => {
                try {
                  const arrayBuffer = await chunk.arrayBuffer();
                  await sendChunkToServer(arrayBuffer);
                } catch (error) {
                  console.error('Error uploading chunk:', error);
                }
              });
            };

            // Start recording with 2-second intervals
            const chunkDuration = 2000;
            mediaRecorder.start(chunkDuration);
          } else {
            console.log('[MeetBot]: Transcript-only mode: MediaRecorder not started.');
          }

          const recordingStartedAt = Date.now();
          try {
            (window as any).screenAppMeetStarted(slightlySecretId, recordingStartedAt);
          } catch (e) {}
          const initialAloneGraceMs = activateInactivityDetectionAfterMinutes * 60 * 1000;

          let dismissModalsInterval: NodeJS.Timeout;
          let lastDimissError: Error | null = null;

          const stopTheRecording = async () => {
            if (isStoppingRecording) return;
            isStoppingRecording = true;
            const recordedDurationSeconds = Math.max(1, Math.round((Date.now() - recordingStartedAt) / 1000));

            try {
              if (mediaRecorder) {
                await new Promise<void>((resolve) => {
                  if (mediaRecorder!.state === 'inactive') {
                    resolve();
                    return;
                  }
                  mediaRecorder!.addEventListener('stop', () => resolve(), { once: true });
                  mediaRecorder!.stop();
                });
                await chunkUploadChain;
              }
            } catch (error) {
              console.error('Error stopping recorder or flushing final chunks:', error);
            } finally {
              if (stream) {
                stream.getTracks().forEach((track) => track.stop());
              }

              // Cleanup recording timer
              clearTimeout(timeoutId);

              // Cancel the perpetural checks
              if (inactivitySilenceDetectionTimeout) {
                clearTimeout(inactivitySilenceDetectionTimeout);
              }

              if (loneTest) {
                clearTimeout(loneTest);
              }

              if (isOnValidGoogleMeetPageInterval) {
                clearInterval(isOnValidGoogleMeetPageInterval);
              }

              if (dismissModalsInterval) {
                clearInterval(dismissModalsInterval);
                if (lastDimissError && lastDimissError instanceof Error) {
                  console.error('Error dismissing modals:', { lastDimissError, message: lastDimissError?.message });
                }
              }

              // Begin browser cleanup
              (window as any).screenAppMeetEnd(slightlySecretId, recordedDurationSeconds);
            }
          };

          let isRecordingPaused = false;

          const pauseTheRecording = () => {
            if (isRecordingPaused) return;
            isRecordingPaused = true;
            console.log('[MeetBot]: In-page pauseTheRecording triggered.');
            if (mediaRecorder && mediaRecorder.state === 'recording') {
              try {
                mediaRecorder.pause();
                console.log('[MeetBot]: mediaRecorder.pause() succeeded.');
              } catch (e) {
                console.warn('[MeetBot]: mediaRecorder.pause() error:', e);
              }
            }
            try {
              (window as any).screenAppMeetPaused?.(slightlySecretId);
            } catch (e) {}
          };

          const resumeTheRecording = () => {
            if (!isRecordingPaused) return;
            isRecordingPaused = false;
            console.log('[MeetBot]: In-page resumeTheRecording triggered.');
            if (mediaRecorder && mediaRecorder.state === 'paused') {
              try {
                mediaRecorder.resume();
                console.log('[MeetBot]: mediaRecorder.resume() succeeded.');
              } catch (e) {
                console.warn('[MeetBot]: mediaRecorder.resume() error:', e);
              }
            }
            try {
              (window as any).screenAppMeetResumed?.(slightlySecretId);
            } catch (e) {}
          };

          (window as any).__stopRecording = () => stopTheRecording();
          (window as any).__pauseRecording = () => pauseTheRecording();
          (window as any).__resumeRecording = () => resumeTheRecording();
          (window as any).__isRecordingPaused = () => isRecordingPaused;

          let loneTest: NodeJS.Timeout;
          let detectionFailures = 0;
          let loneTestDetectionActive = true;
          const maxDetectionFailures = 10; // Track up to 10 consecutive failures
          let lastBadgeLogTime = 0; // Track last time we logged badge count
          let hasSeenOtherParticipant = false;
          let aloneSince: number | null = null;

          const shouldStopForParticipantCount = (contributors: number) => {
            const now = Date.now();
            if (contributors >= 2) {
              hasSeenOtherParticipant = true;
              aloneSince = null;
              return false;
            }

            if (hasSeenOtherParticipant) {
              if (aloneSince === null) {
                aloneSince = now;
                console.log('Bot is alone after previously seeing participants; waiting before ending recording.');
              }
              return now - aloneSince >= loneParticipantExitDelayMs;
            }

            return now - recordingStartedAt >= initialAloneGraceMs;
          };

          function detectLoneParticipantResilient(): void {
            const re = /^[0-9]+$/;

            function getContributorsCount(): number | undefined {
              // Method 0: Global search for [data-avatar-count] anywhere in DOM.
              // In the current Google Meet UI (no visible "People" button in main controls),
              // the participant count is shown as a badge next to the user's avatar in the
              // top-right. The badge is a <span data-avatar-count="N"> not tied to any button.
              // This is the most reliable signal — try it first before the legacy People-button hunt.
              try {
                const avatarBadge = document.querySelector('[data-avatar-count]');
                if (avatarBadge) {
                  const count = Number(avatarBadge.getAttribute('data-avatar-count'));
                  if (!isNaN(count) && count > 0) {
                    return count;
                  }
                }
              } catch (e) {
                console.log('Error reading global data-avatar-count:', e);
              }

              function findPeopleButton() {
                try {
                  // 1. Try to locate using attribute "starts with"
                  let btn: Element | null | undefined = document.querySelector('button[aria-label^="People -"], button[aria-label^="Personen -"], button[aria-label^="Personas -"]');
                  if (btn) return btn;

                  // 2. Try to locate using attribute "contains"
                  btn = document.querySelector('button[aria-label*="People"], button[aria-label*="Personen"], button[aria-label*="Personas"]');
                  if (btn) return btn;

                  // 3. Try via aria-labelledby pointing to element with "People" text
                  const allBtns = Array.from(document.querySelectorAll('button[aria-labelledby]'));
                  btn = allBtns.find(b => {
                    const labelledBy = b.getAttribute('aria-labelledby');
                    if (labelledBy) {
                      const labelElement = document.getElementById(labelledBy);
                      if (labelElement && ['People', 'Personen', 'Personas'].includes(labelElement.textContent?.trim() || '')) {
                        return true;
                      }
                    }
                    return false;
                  });
                  if (btn) return btn;

                  // 4. Try via regex on aria-label (for more complex patterns)
                  const allBtnsWithLabel = Array.from(document.querySelectorAll('button[aria-label]'));
                  btn = allBtnsWithLabel.find(b => {
                    const label = b.getAttribute('aria-label');
                    return label && (/^People - \d+ joined$/.test(label) || /^Personen - \d+/.test(label) || /^Personas - \d+/.test(label));
                  });
                  if (btn) return btn;

                  // 5. Fallback: Look for button with a child icon containing "people"
                  btn = allBtnsWithLabel.find(b =>
                    Array.from(b.querySelectorAll('i')).some(i =>
                      i.textContent && i.textContent.trim() === 'people'
                    )
                  );
                  if (btn) return btn;

                  // 6. Not found
                  return null;
                } catch (error) {
                  console.log('Error finding people button:', error);
                  return null;
                }
              }

              // Find participant count badge near People button (doesn't require opening panel)
              try {
                const peopleBtn = findPeopleButton();
                // console.log('[Detection] People button found:', !!peopleBtn);

                if (peopleBtn) {
                  // Search INSIDE the button (descendants) and nearby (parent container)
                  const searchRoots = [
                    peopleBtn, // Search inside button itself
                    peopleBtn.parentElement,
                    peopleBtn.parentElement?.parentElement
                  ].filter(Boolean);

                  // console.log('[Detection] Searching', searchRoots.length, 'containers');

                  for (const searchRoot of searchRoots) {
                    if (!searchRoot) continue;

                    // Method 1: Look for data-avatar-count attribute (most reliable)
                    const avatarSpan = searchRoot.querySelector('[data-avatar-count]');
                    if (avatarSpan) {
                      const countAttr = avatarSpan.getAttribute('data-avatar-count');
                      // console.log('[Detection] Method 1 SUCCESS - data-avatar-count:', countAttr);
                      const count = Number(countAttr);
                      if (!isNaN(count) && count > 0) {
                        return count;
                      }
                    }

                    // Method 2: Fallback - Look for number in badge div
                    const badgeDiv = searchRoot.querySelector('div.egzc7c') as HTMLElement;
                    if (badgeDiv) {
                      const text = ((badgeDiv.innerText || badgeDiv.textContent) ?? '').trim();
                      if (text.length > 0 && text.length <= 3 && re.test(text)) {
                        const count = Number(text);
                        if (!isNaN(count) && count > 0) {
                          // console.log('[Detection] Method 2 SUCCESS - Badge text:', text);
                          return count;
                        }
                      }
                    }
                  }

                  // Method 3: Last resort - search for short numbers in People button area
                  const mainSearchRoot = peopleBtn.parentElement?.parentElement || peopleBtn;
                  const allDivs = Array.from(mainSearchRoot.querySelectorAll('div'));
                  for (const div of allDivs) {
                    const text = ((div as HTMLElement).innerText || div.textContent || '').trim();
                    if (text.length > 0 && text.length <= 3 && re.test(text)) {
                      const isVisible = (div as HTMLElement).offsetParent !== null;
                      if (isVisible) {
                        const count = Number(text);
                        if (!isNaN(count) && count > 0) {
                          // console.log('[Detection] Method 3 SUCCESS - Found number:', count);
                          return count;
                        }
                      }
                    }
                  }
                  // console.log('[Detection] All methods failed to find count');
                } else {
                  // console.log('[Detection] People button NOT found');
                }
              } catch (error) {
                console.log('Error finding participant badge:', error);
              }

              return undefined;
            }
          
            function retryWithBackoff(): void {
              loneTest = setTimeout(function check() {
                if (!loneTestDetectionActive) {
                  if (loneTest) {
                    clearTimeout(loneTest);
                  }
                  return;
                }
                let contributors: number | undefined;
                try {
                  contributors = getContributorsCount();

                  // Log participant count once per minute
                  if (typeof contributors !== 'undefined') {
                    const now = Date.now();
                    if (now - lastBadgeLogTime > 60000) {
                      console.log('Participant detection check - Count:', contributors);
                      lastBadgeLogTime = now;
                    }
                  }

                  if (typeof contributors === 'undefined') {
                    detectionFailures++;
                    console.warn('Meet participant detection failed, retrying. Failure count:', detectionFailures);
                    // Log for debugging
                    if (detectionFailures >= maxDetectionFailures) {
                      console.log('Persistent detection failures:', { bodyText: `${document.body.innerText?.toString()}` });
                      loneTestDetectionActive = false;
                    }
                    retryWithBackoff();
                    return;
                  }
                  detectionFailures = 0;
                  if (shouldStopForParticipantCount(contributors)) {
                    console.log('Bot is alone, ending meeting.');
                    loneTestDetectionActive = false;
                    stopTheRecording();
                    return;
                  }
                } catch (err) {
                  detectionFailures++;
                  console.error('Detection error:', err, detectionFailures);
                  retryWithBackoff();
                  return;
                }
                retryWithBackoff();
              }, 2000);
            }
          
            retryWithBackoff();
          }

          const detectIncrediblySilentMeeting = () => {
            // Only run silence detection if we have audio tracks and an active stream
            if (!hasAudioTracks || !stream) {
              console.warn('Skipping silence detection - no audio tracks available. This may be due to browser permissions or Google Meet audio sharing settings.');
              console.warn('Meeting will rely on presence detection and max duration timeout.');
              return;
            }

            try {
              const audioContext = new AudioContext();
              const mediaSource = audioContext.createMediaStreamSource(stream);
              const analyser = audioContext.createAnalyser();

              /* Use a value suitable for the given use case of silence detection
                 |
                 |____ Relatively smaller FFT size for faster processing and less sampling
              */
              analyser.fftSize = 256;

              mediaSource.connect(analyser);

              const dataArray = new Uint8Array(analyser.frequencyBinCount);
              
              // Sliding silence period
              let silenceDuration = 0;
              let totalChecks = 0;
              let audioActivitySum = 0;
              let lastActivityLogTime = 0;

              // Audio gain/volume
              const silenceThreshold = 10;

              let monitor = true;

              const monitorSilence = () => {
                try {
                  analyser.getByteFrequencyData(dataArray);

                  const audioActivity = dataArray.reduce((a, b) => a + b) / dataArray.length;
                  audioActivitySum += audioActivity;
                  totalChecks++;

                  // Log silence detection status once per minute, including how close
                  // we are to the inactivity-limit exit so it's clear when this would fire.
                  const now = Date.now();
                  if (now - lastActivityLogTime > 60000) {
                    const avgActivity = (audioActivitySum / totalChecks).toFixed(2);
                    const silentForSec = Math.floor(silenceDuration / 1000);
                    const limitSec = Math.floor(inactivityLimit / 1000);
                    const exitInSec = Math.max(0, limitSec - silentForSec);
                    const status = audioActivity < silenceThreshold
                      ? `silentFor: ${silentForSec}s of ${limitSec}s, will exit in ${exitInSec}s if silence continues`
                      : 'audio active (counter reset)';
                    console.log('Silence detection check - Avg:', avgActivity, 'Current:', audioActivity.toFixed(2), 'Threshold:', silenceThreshold, '|', status);
                    lastActivityLogTime = now;
                  }

                  if (audioActivity < silenceThreshold) {
                    if (isRecordingPaused) {
                      silenceDuration = 0;
                    } else if (hasSeenOtherParticipant && aloneSince === null) {
                      // Other participants are in the call! Do not exit due to silence while people are in the room.
                      silenceDuration = 0;
                    } else {
                      silenceDuration += 100; // Check every 100ms
                      if (silenceDuration >= inactivityLimit) {
                          console.warn('Detected silence in Google Meet and ending the recording on team:', userId, teamId);
                          console.log('Silence detection stats - Avg audio activity:', (audioActivitySum / totalChecks).toFixed(2), 'Checks performed:', totalChecks);
                          monitor = false;
                          stopTheRecording();
                      }
                    }
                  } else {
                    silenceDuration = 0;
                  }

                  if (monitor) {
                    // Recursively queue the next check
                    setTimeout(monitorSilence, 100);
                  }
                } catch (error) {
                  console.error('Error in silence monitoring:', error);
                  console.warn('Silence detection failed - will rely on presence detection and max duration timeout.');
                  // Stop monitoring on error
                  monitor = false;
                }
              };

              // Go silence monitor
              monitorSilence();
            } catch (error) {
              console.error('Failed to initialize silence detection:', error);
              console.warn('Silence detection initialization failed - will rely on presence detection and max duration timeout.');
            }
          };

          /**
           * Perpetual checks for inactivity detection
           */
          detectLoneParticipantResilient();

          /**
           * Chat command listener for in-meeting commands (/bot pause, /bot resume, /bot leave)
           */
          const initChatCommandListener = () => {
            console.log('[MeetBotChat]: Starting chat command listener on Google Meet DOM...');
            let lastCommand = '';
            let lastCommandTime = 0;

            const parseBotCommand = (text: string): string | null => {
              if (!text || typeof text !== 'string') return null;
              // Fast-path filter: skip 99.99% of DOM nodes that don't contain command prefixes
              if (!text.includes('/') && !text.includes('!')) return null;
              if (text.length > 400) return null;

              if (text.includes('RecordingBot está grabando') ||
                  text.includes('Comandos de chat') ||
                  text.includes('política de privacidad') ||
                  text.includes('Grabación pausada') ||
                  text.includes('Grabación reanudada') ||
                  text.includes('saliendo de la llamada')) {
                return null;
              }

              const match = text.match(/(?:^|:\s*|\n|\s)\s*(?:\/bot|\/ff|!bot)\s+(pause|resume|pausar|reanudar|leave|stop|detener|salir)\b/i);
              if (!match) return null;
              const cmd = match[1].toLowerCase();
              if (['pause', 'pausar'].includes(cmd)) return 'pause';
              if (['resume', 'reanudar'].includes(cmd)) return 'resume';
              if (['leave', 'stop', 'detener', 'salir'].includes(cmd)) return 'stop';
              return null;
            };

            const handleDetectedCommand = (cmd: string) => {
              const now = Date.now();
              if (lastCommand === cmd && (now - lastCommandTime) < 5000) {
                return;
              }
              lastCommand = cmd;
              lastCommandTime = now;
              console.log('[MeetBotChat]: Command detected in Meet UI:', cmd);

              try {
                (window as any).screenAppOnChatCommand?.(slightlySecretId, cmd);
              } catch (e) {
                console.error('[MeetBotChat]: Error calling screenAppOnChatCommand:', e);
              }
            };

            const chatObserver = new MutationObserver((mutations) => {
              for (const mutation of mutations) {
                for (const node of Array.from(mutation.addedNodes)) {
                  if (node.nodeType === 1 || node.nodeType === 3) {
                    const content = node.textContent || '';
                    const cmd = parseBotCommand(content);
                    if (cmd) {
                      handleDetectedCommand(cmd);
                    }
                  }
                }
              }
            });

            // Do not observe characterData (which fires on every live subtitle update)
            chatObserver.observe(document.body, { childList: true, subtree: true });
          };

          initChatCommandListener();

          inactivitySilenceDetectionTimeout = setTimeout(() => {
            detectIncrediblySilentMeeting();
          }, activateInactivityDetectionAfterMinutes * 60 * 1000);

          const detectModalsAndDismiss = () => {
            let dismissModalErrorCount = 0;
            const maxDismissModalErrorCount = 10;
            dismissModalsInterval = setInterval(() => {
              try {
                const buttons = document.querySelectorAll('button');
                const dismissButtons = Array.from(buttons).filter((button) => button?.offsetParent !== null && /Got it|Ok|Entendido/i.test(button?.textContent || ''));
                if (dismissButtons.length > 0) {
                  console.log('Found dismiss button, clicking it...', dismissButtons[0]);
                  dismissButtons[0].click();
                }

                // Dismiss "Microphone not found" and "Camera not found" notifications (English, Spanish, German)
                const bodyText = document.body.textContent || '';
                if (bodyText.includes('Microphone not found') ||
                    bodyText.includes('Make sure your microphone is plugged in') ||
                    bodyText.includes('Camera not found') ||
                    bodyText.includes('Make sure your camera is plugged in') ||
                    bodyText.includes('No se encontró el micrófono') ||
                    bodyText.includes('No se encontró una cámara') ||
                    bodyText.includes('Asegúrate de que el micrófono') ||
                    bodyText.includes('Asegúrate de que la cámara') ||
                    bodyText.includes('Mikrofonproblem') ||
                    bodyText.includes('Kameraproblem')) {
                  console.log('Found device notification (microphone/camera), attempting to dismiss...');
                  const allButtons = Array.from(document.querySelectorAll('button'));
                  const closeButtons = allButtons.filter((btn) => {
                    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                    const matIcon = btn.querySelector('i')?.textContent?.trim().toLowerCase() || '';
                    return ariaLabel.includes('close') ||
                           ariaLabel.includes('dismiss') ||
                           ariaLabel.includes('cerrar') ||
                           ariaLabel.includes('descartar') ||
                           matIcon === 'close';
                  });

                  closeButtons.forEach((btn) => {
                    if (btn?.offsetParent !== null) {
                      console.log('Clicking close button for device notification...');
                      btn.click();
                    }
                  });
                }
              } catch(error) {
                lastDimissError = error;
                dismissModalErrorCount += 1;
                if (dismissModalErrorCount > maxDismissModalErrorCount) {
                  console.error(`Failed to detect and dismiss "Got it" modals ${maxDismissModalErrorCount} times, will stop trying...`);
                  clearInterval(dismissModalsInterval);
                }
              }
            }, 4000);
          };

          const detectMeetingIsOnAValidPage = () => {
            // Simple check to verify we're still on a supported Google Meet page
            const isOnValidGoogleMeetPage = () => {
              try {
                // Check if we're still on a Google Meet URL
                const currentUrl = window.location.href;
                if (!currentUrl.includes('meet.google.com')) {
                  console.warn('No longer on Google Meet page - URL changed to:', currentUrl);
                  return false;
                }

                const currentBodyText = document.body.textContent || '';
                if (currentBodyText.includes('You\'ve been removed from the meeting') ||
                    currentBodyText.includes('Te quitaron de la reunión')) {
                  console.warn('Bot was removed from the meeting - ending recording on team:', userId, teamId);
                  return false;
                }

                if (currentBodyText.includes('No one responded to your request to join the call') ||
                    currentBodyText.includes('Nadie respondió a tu solicitud para unirte') ||
                    currentBodyText.includes('Niemand hat auf Ihre Teilnahmeanfrage geantwortet')) {
                  console.warn('Bot was not admitted to the meeting - ending recording on team:', userId, teamId);
                  return false;
                }

                // Check for basic Google Meet UI elements
                const hasMeetElements = document.querySelector('button[aria-label="People"], button[aria-label^="People -"], button[aria-label="Personen"], button[aria-label^="Personen -"], button[aria-label="Personas"], button[aria-label^="Personas -"]') !== null ||
                                      document.querySelector('button[aria-label="Leave call"], button[aria-label="Anruf verlassen"], button[aria-label="Abandonar la llamada"], button[aria-label="Salir de la llamada"]') !== null ||
                                      currentBodyText.includes('Detalles de la reunión') ||
                                      currentBodyText.includes('Estás en la llamada') ||
                                      document.querySelector('[data-allocation-index]') !== null ||
                                      document.querySelector('[jscontroller="k3jTEB"]') !== null;

                if (!hasMeetElements) {
                  console.warn('Google Meet UI elements not found - page may have changed state');
                  return false;
                }

                return true;
              } catch (error) {
                console.error('Error checking page validity:', error);
                return false;
              }
            };

            // check if we're still on a valid Google Meet page
            isOnValidGoogleMeetPageInterval = setInterval(() => {
              if (!isOnValidGoogleMeetPage()) {
                console.log('Google Meet page state changed - ending recording on team:', userId, teamId);
                clearInterval(isOnValidGoogleMeetPageInterval);
                stopTheRecording();
              }
            }, 10000);
          };

          detectModalsAndDismiss();

          detectMeetingIsOnAValidPage();
          
          // Cancel this timeout when stopping the recording
          // Stop recording after `duration` minutes upper limit
          timeoutId = setTimeout(async () => {
            stopTheRecording();
          }, duration);
        }

        // Start the recording
        await startRecording();
      },
      { 
        teamId,
        duration,
        inactivityLimit,
        loneParticipantExitDelayMs,
        userId,
        slightlySecretId: this.slightlySecretId,
        activateInactivityDetectionAfterMinutes: config.activateInactivityDetectionAfter,
        activateInactivityDetectionAfter: new Date(new Date().getTime() + config.activateInactivityDetectionAfter * 60 * 1000).toISOString(),
        mimeTypes,
        recordingMode
      }
    );

    this._logger.info('Recording started successfully! Audio/video capture is active.');

    // Send automated chat notification asynchronously (now that recording is already rolling!)
    this.sendMeetingChatMessage(undefined, botName).catch(chatErr => {
      this._logger.warn('[ChatNotification]: Background chat message failed:', chatErr);
    });

    this._logger.info('Waiting for recording duration', config.maxRecordingDuration, 'minutes...');

    waitingPromise.promise.then(async () => {
      // Save transcript before tearing down browser context unless cancelled without save
      if (!this.isCancelledWithoutSave) {
        try {
          const transcriptText = captionTask.getTranscriptFormatter().format();
          await uploader.saveTranscript(transcriptText);
        } catch (err) {
          this._logger.warn('Could not save transcript via uploader:', err);
        }
      }

      const context = this.page.context();
      // For an external CDP browser (the chrome-cdp sidecar), browser.close() only
      // disconnects Playwright — it leaves the Meet tab open, so the bot stays in
      // the call. Close the page (tab) instead, which leaves the meeting and keeps
      // the shared sidecar Chrome alive for the next job.
      if (isExternalBrowserContext(context)) {
        this._logger.info('Closing the page (external CDP browser stays up)...');
        await this.page.close();
      } else {
        this._logger.info('Closing the browser...');
        await context.browser()?.close();
      }

      this._logger.info('Recording stopped and meeting left; finalizing upload next...', { eventId, botId, userId, teamId });
    });

    await waitingPromise.promise;
  }
}

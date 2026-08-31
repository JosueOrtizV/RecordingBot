import { Page } from 'playwright';
import { Logger } from 'winston';
import { TranscriptFormatter } from '../lib/transcriptFormatter';

export class CaptionTask {
  private page: Page;
  private logger: Logger;
  private secretId: string;
  private formatter: TranscriptFormatter;
  private isCapturing = false;

  constructor(page: Page, logger: Logger, secretId: string, meetingTitle?: string) {
    this.page = page;
    this.logger = logger;
    this.secretId = secretId;
    this.formatter = new TranscriptFormatter(meetingTitle);
  }

  async start(): Promise<void> {
    this.page.on('console', msg => {
        if (msg.text().includes('MEET_DOM_DUMP: ')) {
           const dom = msg.text().substring(15);
           require('fs').writeFileSync('/usr/src/app/dist/_tempvideo/captions_dump.html', dom);
           this.logger.info('[CaptionTask]: Dumped captions DOM to /usr/src/app/dist/_tempvideo/captions_dump.html');
        }
    });

    if (this.isCapturing) return;
    this.isCapturing = true;

    this.logger.info('[CaptionTask]: Initializing Closed Captions extractor for Google Meet (Spanish)...');

    // Expose Node.js receiver to browser context
    await this.page.exposeFunction('__meetBotRecordCaption', (secretId: string, timestamp: string, speaker: string, text: string, elementId: string) => {
      if (secretId !== this.secretId) return;
      this.formatter.addEntry(timestamp, speaker, text, elementId);
    }).catch(() => {
      // Ignore if already exposed
    });

    // Close any obstructing dialogs (like "No microphone found" warnings)
    try {
        const closeButtons = this.page.locator('button[aria-label*="errar"], button[aria-label*="lose"]');
        const count = await closeButtons.count();
        for (let i = 0; i < count; i++) {
             if (await closeButtons.nth(i).isVisible({ timeout: 500 }).catch(()=>false)) {
                 await closeButtons.nth(i).click({ timeout: 1000 });
                 this.logger.info('[CaptionTask]: Closed obstructing dialog');
             }
        }
        await this.page.keyboard.press('Escape'); // Also try escape
    } catch (err) {}

    // Move mouse to center to reveal the control bar
    await this.page.mouse.move(500, 500).catch(() => {});
    await this.page.waitForTimeout(1000);

    // 1. Try to turn on captions if not already on
    try {
      const ccButton = this.page.locator('button[jsname="RrG0hf"], button[aria-label*="caption" i], button[aria-label*="ubt" i]').first();
      if (await ccButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        const isPressed = await ccButton.getAttribute('aria-pressed');
        if (isPressed !== 'true') {
          await ccButton.click({ timeout: 3000 });
          this.logger.info('[CaptionTask]: Clicked Closed Captions toggle button');
        } else {
          this.logger.info('[CaptionTask]: Closed Captions already active');
        }
      } else {
        await this.page.keyboard.press('c');
        this.logger.info('[CaptionTask]: Pressed "c" key to enable closed captions');
      }
    } catch (err) {
      this.logger.warn('[CaptionTask]: Could not enable captions', err);
    }

    // Try to set language to Spanish Mexico via the UI
    try {
      this.logger.info('[CaptionTask]: Attempting to set language to Spanish (Mexico)...');
      await this.page.waitForTimeout(1500);
      
      // Click the main control bar's More Options, ignoring the bot's own video tile options
      const configButton = this.page.locator('button[aria-label="Más opciones" i], button[aria-label="More options" i], button[jsname="NakZHc"]').first();
      if (await configButton.count() > 0) {
          await configButton.click({ timeout: 5000, force: true });
          await this.page.waitForTimeout(1500); // Wait for menu to fully open

          // DUMP DOM FOR DEBUGGING
          try {
             const buttonsHtml = await this.page.evaluate(() => {
                return document.body.innerHTML;
             });
             require('fs').writeFileSync('/usr/src/app/dist/_tempvideo/menu_dump.html', buttonsHtml);
             this.logger.info('[CaptionTask]: Successfully dumped menu DOM to /usr/src/app/dist/_tempvideo/menu_dump.html');
          } catch (e) {
             this.logger.warn('[CaptionTask]: Failed to dump DOM', e);
          }

          const settingsOption = this.page.locator('li, [role="menuitem"]').filter({ hasText: /onfiguraci|ettings/i }).first();
          if (await settingsOption.count() > 0) {
              await settingsOption.click({ timeout: 5000, force: true });
              await this.page.waitForTimeout(1500);

              // 1. Click "Subtítulos" tab safely
              const clickedTab = await this.page.evaluate(() => {
                  const els = Array.from(document.querySelectorAll('*'));
                  for (const el of els) {
                      if (el.children.length === 0 && (el.textContent?.trim() === 'Subtítulos' || el.textContent?.trim() === 'Captions')) {
                          const clickable = el.closest('div[role="tab"], li, button, div.VfPpkd-V67aGc, div.Gk2izd');
                          if (clickable) {
                              (clickable as HTMLElement).click();
                              return true;
                          }
                      }
                  }
                  return false;
              });

              if (clickedTab) {
                  await this.page.waitForTimeout(1000);

                  // 2. Click the language combobox (the first visible combobox)
                  const clickedCombo = await this.page.evaluate(() => {
                      const combos = document.querySelectorAll('div[role="combobox"]');
                      for (const combo of Array.from(combos)) {
                          if (combo.getBoundingClientRect().width > 0) {
                              (combo as HTMLElement).click();
                              return true;
                          }
                      }
                      return false;
                  });

                  if (clickedCombo) {
                      await this.page.waitForTimeout(1500);

                      // 3. Click "Español (México)" option
                      const clickedLang = await this.page.evaluate(() => {
                          const options = document.querySelectorAll('[role="option"]');
                          for (const opt of Array.from(options)) {
                              if (opt.textContent && (opt.textContent.includes('México') || opt.textContent.includes('Mexico'))) {
                                  (opt as HTMLElement).click();
                                  return true;
                              }
                          }
                          return false;
                      });

                      if (clickedLang) {
                          console.log('[CaptionTask]: Successfully set language');
                      }
                  }
              }
              
              // NEW: Explicitly close the Settings modal by finding the Close (X) button
              const closedModal = await this.page.evaluate(() => {
                  const closeButtons = Array.from(document.querySelectorAll('button[aria-label="Cerrar"], button[aria-label="Close"], button[data-mdc-dialog-action="close"]'));
                  for (const btn of closeButtons) {
                      if (btn.getBoundingClientRect().width > 0) {
                          (btn as HTMLElement).click();
                          return true;
                      }
                  }
                  return false;
              });

              if (!closedModal) {
                  this.logger.warn('[CaptionTask]: Could not find close button for settings modal, falling back to Escape');
                  await this.page.keyboard.press('Escape');
                  await this.page.waitForTimeout(500);
                  await this.page.keyboard.press('Escape'); // Double escape just in case
              } else {
                  this.logger.info('[CaptionTask]: Closed settings modal successfully via button click');
              }

          } else {
              this.logger.warn('[CaptionTask]: settingsOption not found');
          }
      } else {
          this.logger.warn('[CaptionTask]: configButton not found');
      }
    } catch (err) {
      this.logger.warn('[CaptionTask]: Could not set captions language via UI (might already be set)', err);
    }

    // 2. Inject DOM MutationObserver into page
    await this.page.evaluate(({ secretId }) => {
      console.log('[CaptionTask Injected]: Starting MutationObserver on Google Meet captions...');

      const processedElements = new WeakSet();

      function getLocalTime(): string {
        const now = new Date();
        return now.toTimeString().split(' ')[0]; // HH:MM:SS
      }

      function scanForCaptions() {
        // Target new Meet CC interface regions
        const captionRegions = document.querySelectorAll('div[aria-label*="ubt"], div[aria-label*="aption"]');

        captionRegions.forEach(region => {
           // Google Meet updates blocks of text per speaker.
           const blocks = region.querySelectorAll('.nMcdL, div.a4cQT, div.DtJ7e');
           blocks.forEach(block => {
               let speakerName = 'Participante';
               // Get speaker name from the new UI (.NWpY1d) or old UI
               const nameEl = block.querySelector('.NWpY1d, .zs75Bi, .KcIKs, div[jsname="SKb2ee"]');
               if (nameEl && nameEl.textContent) {
                   speakerName = nameEl.textContent.trim();
               } else {
                   // Fallback to searching for an image with alt text inside the block
                   const imgEl = block.querySelector('img[alt]');
                   if (imgEl && imgEl.getAttribute('alt')) {
                       speakerName = imgEl.getAttribute('alt') || 'Participante';
                   }
               }

               // Get caption text from the new UI (.ygicle) or old UI
               const textEl = block.querySelector('.ygicle, .iTTPOb, div[jsname="YSxPC"]');
               if (textEl && textEl.textContent) {
                   const fullText = textEl.textContent.trim();
                   if (fullText && fullText.length > 2) {
                       const lastText = (block as any).__meetBotLastText || '';
                       if (fullText !== lastText) {
                           (block as any).__meetBotLastText = fullText;
                           
                           let blockId = block.getAttribute('data-meetbot-id');
                           if (!blockId) {
                               blockId = 'cap_' + Math.random().toString(36).substring(2);
                               block.setAttribute('data-meetbot-id', blockId);
                           }

                           try {
                               // @ts-ignore
                               window.__meetBotRecordCaption(
                                   secretId,
                                   getLocalTime(),
                                   speakerName,
                                   fullText,
                                   blockId
                               );
                           } catch (e) {}
                       }
                   }
               }
           });
        });
      }

      // Observer on document body for live caption nodes
      const observer = new MutationObserver(() => {
        scanForCaptions();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      // Periodic backup scan
      setInterval(scanForCaptions, 1500);
    }, { secretId: this.secretId });

    this.logger.info('[CaptionTask]: Closed Captions MutationObserver successfully injected and active.');
  }

  saveTranscript(outputPath: string): void {
    this.logger.info(`[CaptionTask]: Saving formatted transcript to ${outputPath}...`);
    this.formatter.saveToFile(outputPath);
  }

  getTranscriptFormatter(): TranscriptFormatter {
    return this.formatter;
  }
}

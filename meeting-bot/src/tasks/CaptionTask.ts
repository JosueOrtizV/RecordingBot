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

  private async ensureCaptionsEnabled(): Promise<void> {
    try {
      const result = await this.page.evaluate(() => {
        // 1. Check if direct toggle button (jsname="RrG0hf") is already in DOM and visible
        const rrgBtn = document.querySelector('button[jsname="RrG0hf"]') as HTMLElement | null;
        if (rrgBtn && rrgBtn.getBoundingClientRect().width > 0) {
          const label = (rrgBtn.getAttribute('aria-label') || '').toLowerCase();
          const iconText = rrgBtn.querySelector('i')?.textContent?.trim() || '';
          const isAlreadyOn =
            label.includes('desactivar') ||
            label.includes('turn off') ||
            rrgBtn.getAttribute('aria-pressed') === 'true' ||
            iconText === 'closed_caption';
          const isOff =
            !isAlreadyOn &&
            (iconText === 'closed_caption_off' ||
              /\bactivar\b/.test(label) ||
              label.includes('turn on') ||
              rrgBtn.getAttribute('aria-pressed') === 'false');
          if (isOff) {
            rrgBtn.click();
            return 'clicked_rrg0hf_direct';
          }
          return 'already_active_rrg0hf';
        }

        // 2. Check if live captions region is already visible and active
        const activeRegion = document.querySelector('div[role="region"][aria-label*="ubt" i], div[role="region"][aria-label*="aption" i]') as HTMLElement | null;
        if (activeRegion && activeRegion.getBoundingClientRect().height > 0) {
          return 'already_active_region';
        }

        // 3. Look for toolbar button ("Subtítulos y traducción" / "Activar subtítulos" / "Captions")
        const buttons = Array.from(document.querySelectorAll('button'));
        for (const btn of buttons) {
          if (btn.getBoundingClientRect().width === 0) continue;
          const label = (btn.getAttribute('aria-label') || '').toLowerCase();
          if (label.includes('desactivar subt') || label.includes('turn off caption')) {
            return 'already_active_toolbar';
          }
          if (
            (!label.includes('desactivar') && label.includes('activar subt')) ||
            label.includes('turn on caption') ||
            label.includes('subtítulos y traducción') ||
            label.includes('captions and translation') ||
            btn.querySelector('i')?.textContent?.trim() === 'translate_cc'
          ) {
            btn.click();
            return btn.getAttribute('aria-haspopup') === 'dialog' ? 'opened_popup_menu' : 'clicked_toolbar_toggle';
          }
        }
        return 'not_found';
      });

      this.logger.info(`[CaptionTask]: Initial caption toggle step result: ${result}`);

      if (result === 'opened_popup_menu') {
        await this.page.waitForTimeout(800);
        const innerResult = await this.page.evaluate(() => {
          const rrgBtn = document.querySelector('button[jsname="RrG0hf"]') as HTMLElement | null;
          if (rrgBtn && rrgBtn.getBoundingClientRect().width > 0) {
            const label = (rrgBtn.getAttribute('aria-label') || '').toLowerCase();
            const iconText = rrgBtn.querySelector('i')?.textContent?.trim() || '';
            const isAlreadyOn =
              label.includes('desactivar') ||
              label.includes('turn off') ||
              rrgBtn.getAttribute('aria-pressed') === 'true' ||
              iconText === 'closed_caption';
            const isOff =
              !isAlreadyOn &&
              (iconText === 'closed_caption_off' ||
                /\bactivar\b/.test(label) ||
                label.includes('turn on') ||
                rrgBtn.getAttribute('aria-pressed') === 'false');
            if (isOff) {
              rrgBtn.click();
              return 'clicked_inner_rrg0hf';
            }
            return 'inner_already_active';
          }
          // Fallback: search any visible button inside the dialog with "Activar subtítulos" / "Turn on captions"
          const btns = Array.from(document.querySelectorAll('[role="dialog"] button, button'));
          for (const b of btns) {
            if (b.getBoundingClientRect().width === 0) continue;
            const lbl = (b.getAttribute('aria-label') || '').toLowerCase();
            if (lbl.includes('desactivar subt') || lbl.includes('turn off caption')) {
              return 'inner_already_active_by_label';
            }
            if ((!lbl.includes('desactivar') && lbl.includes('activar subt')) || lbl.includes('turn on caption')) {
              (b as HTMLElement).click();
              return 'clicked_inner_by_label';
            }
          }
          return 'inner_not_found';
        });
        this.logger.info(`[CaptionTask]: Inner caption popup toggle result: ${innerResult}`);
        await this.page.waitForTimeout(500);
      } else if (result === 'not_found') {
        await this.page.keyboard.press('c');
        this.logger.info('[CaptionTask]: Pressed "c" key to enable closed captions');
      }
    } catch (err) {
      this.logger.warn('[CaptionTask]: Could not enable captions', err);
    }
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

    // 1. Turn on captions (supports both direct button and new "Subtítulos y traducción" dialog)
    await this.ensureCaptionsEnabled();

    // Try to set language to Spanish Mexico via the UI (first checking if combobox is already in the open popup dialog)
    try {
      this.logger.info('[CaptionTask]: Attempting to set language to Spanish (Mexico)...');
      await this.page.waitForTimeout(800);

      // Check if language combobox is already visible inside the "Subtítulos y traducción" popup dialog
      const popupComboState = await this.page.evaluate(() => {
        const combos = Array.from(document.querySelectorAll('div[role="combobox"]'));
        for (const combo of combos) {
          if (combo.getBoundingClientRect().width > 0) {
            const text = (combo.textContent || '').trim();
            if (text.includes('Español') || text.includes('México') || text.includes('Mexico')) {
              return 'already_spanish_in_popup';
            }
            (combo as HTMLElement).click();
            return 'clicked_combo_in_popup';
          }
        }
        return 'no_combo_in_popup';
      });

      if (popupComboState === 'already_spanish_in_popup') {
        this.logger.info('[CaptionTask]: Language is already set to Spanish in popup dialog.');
      } else if (popupComboState === 'clicked_combo_in_popup') {
        await this.page.waitForTimeout(1000);
        const clickedLang = await this.page.evaluate(() => {
          const options = document.querySelectorAll('[role="option"]');
          for (const opt of Array.from(options)) {
            if (opt.textContent && (opt.textContent.includes('México') || opt.textContent.includes('Mexico') || opt.textContent.includes('Español'))) {
              (opt as HTMLElement).click();
              return true;
            }
          }
          return false;
        });
        if (clickedLang) {
          this.logger.info('[CaptionTask]: Successfully set language via popup dialog.');
        }
        await this.page.waitForTimeout(500);
      } else {
        // Close any open popup dialog before clicking More Options
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.waitForTimeout(500);

        // Click the main control bar's More Options, ignoring the bot's own video tile options
        const configButton = this.page.locator('button[aria-label="Más opciones" i], button[aria-label="More options" i], button[jsname="NakZHc"]').first();
        if (await configButton.count() > 0) {
          await configButton.click({ timeout: 5000, force: true });
          await this.page.waitForTimeout(1500); // Wait for menu to fully open

          const settingsOption = this.page.locator('li[role="menuitem"], [role="menuitem"]').filter({ hasText: /onfiguraci|ettings/i }).first();
          if (await settingsOption.count() > 0) {
              await settingsOption.click({ timeout: 5000, force: true });
              await this.page.waitForTimeout(1500);

              // 1. Click "Subtítulos" / "Subtítulos y traducción" tab safely
              const clickedTab = await this.page.evaluate(() => {
                  const els = Array.from(document.querySelectorAll('*'));
                  for (const el of els) {
                      const txt = el.textContent?.trim() || '';
                      if (el.children.length === 0 && (txt === 'Subtítulos' || txt === 'Captions' || txt.startsWith('Subtítulos') || txt.startsWith('Captions'))) {
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
                              if (opt.textContent && (opt.textContent.includes('México') || opt.textContent.includes('Mexico') || opt.textContent.includes('Español'))) {
                                  (opt as HTMLElement).click();
                                  return true;
                              }
                          }
                          return false;
                      });

                      if (clickedLang) {
                          this.logger.info('[CaptionTask]: Successfully set language via Settings');
                      }
                  }
              }
              
              // Explicitly close the Settings modal by finding the Close (X) button
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
                  await this.page.keyboard.press('Escape');
              } else {
                  this.logger.info('[CaptionTask]: Closed settings modal successfully via button click');
              }

          } else {
              this.logger.warn('[CaptionTask]: settingsOption not found');
          }
        } else {
          this.logger.warn('[CaptionTask]: configButton not found');
        }
      }
    } catch (err) {
      this.logger.warn('[CaptionTask]: Could not set captions language via UI (might already be set)', err);
    }

    // Re-verify captions are enabled after language check
    await this.page.waitForTimeout(500);
    await this.ensureCaptionsEnabled();

    // Close any open translation popup dialog by clicking center of video area or Escape if dialog is open
    await this.page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label*="ubt" i], div[role="dialog"][aria-label*="aption" i]');
      if (dialog && (dialog as HTMLElement).getBoundingClientRect().width > 0) {
        document.body.click();
      }
    }).catch(() => {});

    // 2. Inject DOM MutationObserver into page
    await this.page.evaluate(({ secretId }) => {
      console.log('[CaptionTask Injected]: Starting MutationObserver on Google Meet captions...');

      function getLocalTime(): string {
        const now = new Date();
        return now.toTimeString().split(' ')[0]; // HH:MM:SS
      }

      function scanForCaptions() {
        if (typeof (window as any).__isRecordingPaused === 'function' && (window as any).__isRecordingPaused()) {
          return; // Skip captions while recording is paused
        }

        // Target Meet CC interface regions (excluding the popup dialog itself)
        const captionRegions = document.querySelectorAll('div[role="region"][aria-label*="ubt" i], div[role="region"][aria-label*="aption" i], div[aria-label*="ubt" i]:not([role="dialog"]), div[aria-label*="aption" i]:not([role="dialog"])');

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

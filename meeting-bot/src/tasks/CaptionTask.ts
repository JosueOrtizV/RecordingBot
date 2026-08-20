import { Page } from 'playwright';
import { Logger } from 'winston';
import { TranscriptFormatter } from '../lib/transcriptFormatter';

export class CaptionTask {
  private page: Page;
  private logger: Logger;
  private secretId: string;
  private formatter: TranscriptFormatter;
  private isCapturing = false;

  constructor(page: Page, logger: Logger, secretId: string) {
    this.page = page;
    this.logger = logger;
    this.secretId = secretId;
    this.formatter = new TranscriptFormatter();
  }

  async start(): Promise<void> {
    this.page.on('console', msg => {
        if (msg.text().includes('MEET_DOM_DUMP: ')) {
           const dom = msg.text().substring(15);
           require('fs').writeFileSync('/usr/src/app/dist/captions_dump.html', dom);
           this.logger.info('[CaptionTask]: Dumped captions DOM to /usr/src/app/dist/captions_dump.html');
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
      
      // Use sub-strings without accents to avoid encoding corruption issues
      const configButton = this.page.locator('button[aria-label*="opciones" i], button[aria-label*="options" i], button[jsname="V67aGc"]').first();
      if (await configButton.count() > 0) {
          await configButton.click({ timeout: 5000 });
          await this.page.waitForTimeout(1500); // Wait for menu to fully open

          // DUMP DOM FOR DEBUGGING
          try {
             const buttonsHtml = await this.page.evaluate(() => {
                 return Array.from(document.querySelectorAll('li, [role="menuitem"], button, div[role="menu"]')).map(el => el.outerHTML).join('\n');
             });
             require('fs').writeFileSync('/usr/src/app/dist/menu_dump.html', buttonsHtml);
             this.logger.info('[CaptionTask]: Successfully dumped menu DOM to /usr/src/app/dist/menu_dump.html');
          } catch(e) {
             this.logger.warn('[CaptionTask]: Failed to dump DOM', e);
          }

          const settingsOption = this.page.locator('li, [role="menuitem"]').filter({ hasText: /onfiguraci|ettings/i }).first();
          if (await settingsOption.count() > 0) {
              await settingsOption.click({ timeout: 5000 });
              await this.page.waitForTimeout(1000);

              const captionsTab = this.page.locator('div[role="tab"], li, button').filter({ hasText: /ubt|aption/i }).first();
              if (await captionsTab.count() > 0) {
                  await captionsTab.click({ timeout: 5000 });
                  await this.page.waitForTimeout(1000);

                  // Buscar el dropdown de idioma
                  const langCombo = this.page.locator('div[role="combobox"]').first();
                  if (await langCombo.count() > 0) {
                      await langCombo.click({ timeout: 5000 });
                      await this.page.waitForTimeout(1000);

                      // Click Spanish (Mexico)
                      const esMxOption = this.page.locator('[role="option"]').filter({ hasText: /Espa|Mexic/i }).first();
                      if (await esMxOption.count() > 0) {
                          await esMxOption.click({ timeout: 5000 });
                          this.logger.info('[CaptionTask]: Successfully set captions language to es-MX via UI');
                      } else {
                          this.logger.warn('[CaptionTask]: esMxOption not found');
                      }
                  } else {
                      this.logger.warn('[CaptionTask]: langCombo not found');
                  }
                  
                  // Close settings dialog
                  await this.page.keyboard.press('Escape');
              } else {
                  this.logger.warn('[CaptionTask]: captionsTab not found');
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
        let textElements: Element[] = Array.from(document.querySelectorAll('.CNusmb, .Vb82nd, span[jsname="YSxPC"], div[jsname="tX9u1b"] span'));
        
        // Target new Meet CC interface regions (using substring to avoid accent mismatch in JS evaluation)
        const captionRegions = document.querySelectorAll('div[aria-label*="ubt"], div[aria-label*="aption"]');
        
        // DEBUG DUMP CAPTIONS DOM
        if (captionRegions.length > 0) {
           (window as any).captionDomDumpCount = ((window as any).captionDomDumpCount || 0) + 1;
           if ((window as any).captionDomDumpCount === 1) { // Dump only once
              console.log("MEET_DOM_DUMP: " + captionRegions[0].outerHTML);
           }
        }

        captionRegions.forEach(region => {
           const leaves = Array.from(region.querySelectorAll('*')).filter(el => {
              const tag = el.tagName.toLowerCase();
              if (tag === 'svg' || tag === 'path' || tag === 'button' || tag === 'img') return false;
              // Add only leaf nodes that contain text (or elements whose children are just text)
              return el.children.length === 0 && (el.textContent || '').trim().length > 0;
           });
           textElements = textElements.concat(leaves as Element[]);
        });

        textElements.forEach((textEl) => {
          // IMPORTANT: Avoid matching the language selection menu!
          if (textEl.closest('div[role="menu"]') || textEl.closest('div[role="listbox"]') || textEl.closest('div[role="dialog"]')) return;

          // Find the container block for this speaker (old UI and new UI generic fallback)
          let block = textEl.closest('div[jsname="YSxPC"]') || textEl.closest('div.a4cQT') || textEl.closest('div.DtJ7e');
          
          // In the new UI, speaker name is sometimes a sibling or uncle. Let's look up a few levels.
          let speakerName = 'Participante';
          let curr: any = textEl;
          for(let i=0; i<4; i++) {
            if(!curr) break;
            const speakerEl = curr.querySelector?.('.zs75Bi, .KcIKs, div[jsname="SKb2ee"], img[alt]') ||
                              curr.previousElementSibling?.querySelector?.('.zs75Bi, .KcIKs, div[jsname="SKb2ee"], img[alt]') ||
                              curr.previousElementSibling;
            
            // if we found an img with alt (avatar), the alt text usually contains the name
            if (speakerEl?.tagName?.toLowerCase() === 'img' && speakerEl.getAttribute('alt')) {
                speakerName = speakerEl.getAttribute('alt') || 'Participante';
                break;
            } else if (speakerEl?.textContent && speakerEl.textContent.trim().length > 0 && speakerEl.textContent.trim().length < 50) {
                speakerName = speakerEl.textContent.trim();
                break;
            }
            curr = curr.parentElement;
          }

          const fullText = textEl.textContent?.trim() || '';

          if (fullText && fullText.length > 2) {
             const lastText = (textEl as any).__meetBotLastText || '';
             
             if (!(textEl as any).__meetBotElementId) {
                (textEl as any).__meetBotElementId = Math.random().toString(36).substring(2, 15);
             }
             const elementId = (textEl as any).__meetBotElementId;

             // Ensure it's an actual caption update and not just the speaker name
             if (fullText !== lastText && !speakerName.includes(fullText) && !fullText.includes(speakerName)) {
                (window as any).__meetBotRecordCaption(secretId, getLocalTime(), speakerName, fullText, elementId);
                (textEl as any).__meetBotLastText = fullText;
             }
          }
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

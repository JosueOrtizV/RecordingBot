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
    if (this.isCapturing) return;
    this.isCapturing = true;

    this.logger.info('[CaptionTask]: Initializing Closed Captions extractor for Google Meet (Spanish)...');

    // Expose Node.js receiver to browser context
    await this.page.exposeFunction('__meetBotRecordCaption', (secretId: string, timestamp: string, speaker: string, text: string) => {
      if (secretId !== this.secretId) return;
      this.formatter.addEntry(timestamp, speaker, text);
    }).catch(() => {
      // Ignore if already exposed
    });

    // 1. Try to turn on captions if not already on
    try {
      await this.page.keyboard.press('c');
      this.logger.info('[CaptionTask]: Pressed "c" key to enable closed captions');
    } catch (err) {
      this.logger.warn('[CaptionTask]: Could not press "c" to enable captions', err);
    }

    // Also look for CC button in bottom control bar
    try {
      const ccButton = this.page.locator('button[aria-label*="caption" i], button[aria-label*="subtítulo" i]').first();
      if (await ccButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        const isPressed = await ccButton.getAttribute('aria-pressed');
        if (isPressed !== 'true') {
          await ccButton.click({ timeout: 3000 });
          this.logger.info('[CaptionTask]: Clicked Closed Captions toggle button');
        }
      }
    } catch (err) {
      this.logger.debug('[CaptionTask]: Button CC toggle skipped or already active');
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
        // Selector 1: Standard Google Meet caption blocks
        const captionBlocks = document.querySelectorAll('div[jsname="YSxPC"], div[jscontroller="M31Ksd"], .nMm5Fd');

        captionBlocks.forEach((block) => {
          const speakerEl = block.querySelector('div[jsname="V67aGc"], .zs75Bi, .NWp8re, .TBMuR') ||
                            block.previousElementSibling?.querySelector('.zs75Bi');
          const speakerName = speakerEl?.textContent?.trim() || 'Participante';

          const textEls = block.querySelectorAll('span[jsname="YSxPC"], .CNusmb, span');
          let fullText = '';
          textEls.forEach((t) => {
            const str = t.textContent?.trim() || '';
            if (str && !fullText.includes(str)) {
              fullText += ' ' + str;
            }
          });

          fullText = fullText.trim();

          if (fullText && !processedElements.has(block)) {
            (window as any).__meetBotRecordCaption(secretId, getLocalTime(), speakerName, fullText);
            processedElements.add(block);
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

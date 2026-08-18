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
      const ccButton = this.page.locator('button[aria-label*="caption" i], button[aria-label*="subtítulo" i], button[data-tooltip*="caption" i], button[data-tooltip*="subtítulo" i]').first();
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
        // Find all caption text spans directly to avoid scraping UI menus
        const textElements = document.querySelectorAll('.CNusmb, span[jsname="YSxPC"]');

        textElements.forEach((textEl) => {
          // Find the container block for this speaker
          const block = textEl.closest('div[jsname="YSxPC"]') || textEl.parentElement?.parentElement || textEl.parentElement;
          if (!block) return;

          // Find the speaker name
          const speakerEl = block.querySelector('.zs75Bi, .KcIKs, div[jsname="SKb2ee"]') ||
                            block.previousElementSibling?.querySelector('.zs75Bi, .KcIKs, div[jsname="SKb2ee"]');
          const speakerName = speakerEl?.textContent?.trim() || 'Participante';

          const fullText = textEl.textContent?.trim() || '';

          if (fullText) {
             const lastText = (textEl as any).__meetBotLastText || '';
             if (fullText !== lastText && fullText !== speakerName) {
                (window as any).__meetBotRecordCaption(secretId, getLocalTime(), speakerName, fullText);
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

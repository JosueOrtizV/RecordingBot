const fs = require('fs');
let c = fs.readFileSync('meeting-bot/src/bots/GoogleMeetBot.ts', 'utf8');

const startStr = '  private async sendMeetingChatMessage(botName?: string): Promise<void> {';
const endStr = '  private async recordMeetingPage(';

const startIdx = c.indexOf(startStr);
const endIdx = c.indexOf(endStr);

if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find start or end bounds');
    process.exit(1);
}

const replacement = \  private async sendMeetingChatMessage(botName?: string): Promise<void> {
    try {
      this._logger.info('[ChatNotification]: Attempting to send recording disclaimer message to chat...');
      await this.page.waitForTimeout(1500);

      // Find the chat button on the bottom control bar
      const chatButton = this.page.locator('button[aria-label*="chatear" i], button[aria-label*="chat" i], button[data-panel-id="2"]').first();
      if (await chatButton.count() > 0) {
        await chatButton.click({ timeout: 5000, force: true });
        
        // Find the chat input area and WAIT for it to appear
        const textarea = this.page.locator('textarea[aria-label*="mensaje" i], textarea[aria-label*="message" i], textarea').first();
        try {
          await textarea.waitFor({ state: 'attached', timeout: 8000 });
          const isVisible = await textarea.isVisible().catch(() => false);
          
          if (isVisible) {
            const messageText = \\\Hola, soy \. Estoy grabando y transcribiendo esta llamada para generar una minuta automática.\\\;
            await textarea.fill(messageText);
            await this.page.waitForTimeout(500);
            
            // Press Enter to send
            await this.page.keyboard.press('Enter');
            
            // Also try clicking the send button if available
            const sendButton = this.page.locator('button[aria-label*="Enviar" i], button[aria-label*="Send" i], button i:has-text("send")').first();
            if (await sendButton.count() > 0 && await sendButton.isEnabled().catch(() => false)) {
              await sendButton.click({ timeout: 2000, force: true }).catch(() => null);
            }

            this._logger.info('[ChatNotification]: Successfully sent recording disclaimer to chat');
            await this.page.waitForTimeout(1000);

            // Close the chat panel to restore clean UI view
            const closeChatButton = this.page.locator('button[aria-label*="Cerrar" i], button[aria-label*="Close" i]').first();
            if (await closeChatButton.count() > 0 && await closeChatButton.isVisible().catch(() => false)) {
              await closeChatButton.click({ timeout: 2000, force: true }).catch(() => null);
            } else {
              await chatButton.click({ timeout: 2000, force: true }).catch(() => null);
            }
          } else {
             this._logger.warn('[ChatNotification]: Chat textarea attached but not visible');
          }
        } catch (e) {
          this._logger.warn('[ChatNotification]: Chat textarea never appeared within timeout', e);
        }
      } else {
        this._logger.warn('[ChatNotification]: Chat button not found on control bar');
      }
    } catch (chatError) {
      this._logger.warn('[ChatNotification]: Failed to send chat message:', chatError);
    }
  }

\;

c = c.substring(0, startIdx) + replacement + c.substring(endIdx);
fs.writeFileSync('meeting-bot/src/bots/GoogleMeetBot.ts', c, 'utf8');

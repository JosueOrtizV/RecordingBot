import { config } from './config';
import { logger } from './logger';

export async function sendTelegramAlert(message: string): Promise<void> {
  logger.info(`[Telegram Alert]: ${message}`);

  const token = config.telegramBotToken;
  const chatId = config.telegramChatId;

  if (!token || !chatId) {
    logger.warn('Telegram token or chat ID not configured. Skipping alert.');
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn(`Failed to send telegram alert. Status: ${response.status}, Error: ${errorText}`);
    } else {
      logger.info('Successfully sent telegram alert');
    }
  } catch (err: any) {
    logger.error('Error sending telegram alert:', err?.message || err);
  }
}

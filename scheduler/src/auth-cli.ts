import readline from 'readline';
import fs from 'fs';
import { getOAuth2Client, SCOPES } from './auth';
import { config } from './config';
import { logger } from './logger';

async function runAuthCli() {
  console.log('\n=============================================');
  console.log('       RecordingBot - Google OAuth Setup     ');
  console.log('=============================================\n');

  const oauth2Client = getOAuth2Client();

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });

  console.log('1. Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\n2. Log in and allow permissions for Google Calendar and Google Drive.');
  console.log('3. Copy the authorization code (or URL query parameter "code=") and paste it below.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Enter the authorization code: ', async (code) => {
    rl.close();
    try {
      const cleanCode = code.trim();
      const { tokens } = await oauth2Client.getToken(cleanCode);
      oauth2Client.setCredentials(tokens);

      fs.writeFileSync(config.tokenPath, JSON.stringify(tokens, null, 2));
      console.log(`\n✅ Authorization successful! Tokens saved to: ${config.tokenPath}`);
    } catch (err: any) {
      console.error('\n❌ Failed to obtain tokens:', err?.message || err);
      process.exit(1);
    }
  });
}

runAuthCli().catch((err) => {
  logger.error('Fatal CLI error:', err);
});

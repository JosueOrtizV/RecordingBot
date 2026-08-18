const fs = require('fs');
const path = require('path');
const readline = require('readline');

let google;
try {
  google = require('googleapis').google;
} catch {
  try {
    google = require(path.resolve(__dirname, '../scheduler/node_modules/googleapis')).google;
  } catch {
    try {
      google = require(path.resolve(__dirname, '../meeting-bot/node_modules/googleapis')).google;
    } catch {
      console.error('❌ Error: No se encontró el módulo googleapis. Ejecuta "npm install" en la carpeta scheduler.');
      process.exit(1);
    }
  }
}

const CREDENTIALS_PATH = path.resolve(__dirname, '../credentials.json');
const TOKEN_PATH = path.resolve(__dirname, '../token.json');

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/drive.file'
];

async function authorize() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error(`❌ credentials.json not found at: ${CREDENTIALS_PATH}`);
    process.exit(1);
  }

  const content = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const keys = content.installed || content.web;
  if (!keys) {
    console.error('❌ Invalid credentials.json format.');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    keys.client_id,
    keys.client_secret,
    keys.redirect_uris?.[0] || 'http://localhost'
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });

  console.log('\n=============================================');
  console.log('       RecordingBot - Google OAuth Auth      ');
  console.log('=============================================\n');
  console.log('1. Open this authorization URL in your browser:\n');
  console.log(authUrl);
  console.log('\n2. Grant access to Google Calendar and Google Drive.');
  console.log('3. Paste the authorization code (or the full redirect URL) below:\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Authorization Code: ', async (code) => {
    rl.close();
    try {
      let cleanCode = code.trim();
      if (cleanCode.includes('code=')) {
        const urlParams = new URLSearchParams(cleanCode.split('?')[1] || cleanCode);
        cleanCode = urlParams.get('code') || cleanCode;
      }

      const { tokens } = await oauth2Client.getToken(cleanCode);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      console.log(`\n✅ Authorization successful! token.json saved to: ${TOKEN_PATH}\n`);
    } catch (err) {
      console.error('\n❌ Failed to retrieve tokens:', err.message || err);
      process.exit(1);
    }
  });
}

authorize();

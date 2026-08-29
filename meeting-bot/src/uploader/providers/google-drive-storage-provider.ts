import fs from 'fs';
import path from 'path';
import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { StorageProvider, UploadOptions } from './storage-provider';
import config from '../../config';

export class GoogleDriveStorageProvider implements StorageProvider {
  readonly name = 'drive' as const;
  private driveClient: drive_v3.Drive | null = null;
  private rootFolderId: string | null = null;
  private lastUploadedWebLink: string | null = null;

  validateConfig(): void {
    const credPath = process.env.GOOGLE_CREDENTIALS_PATH || path.resolve(process.cwd(), 'credentials.json');
    const tokenPath = process.env.GOOGLE_TOKEN_PATH || path.resolve(process.cwd(), 'token.json');

    if (!fs.existsSync(credPath)) {
      throw new Error(`Google Drive Storage Provider error: credentials file not found at ${credPath}`);
    }
    if (!fs.existsSync(tokenPath)) {
      // If user tokens are passed dynamically in metadata, tokenPath is optional
      return;
    }
  }

  private getClient(userTokens?: any): drive_v3.Drive {
    if (userTokens && typeof userTokens === 'object' && (userTokens.access_token || userTokens.refresh_token)) {
      const credPath = process.env.GOOGLE_CREDENTIALS_PATH || path.resolve(process.cwd(), 'credentials.json');
      const credContent = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      const keys = credContent.installed || credContent.web;

      const oauth2Client = new google.auth.OAuth2(
        keys.client_id,
        keys.client_secret,
        keys.redirect_uris?.[0] || 'http://localhost'
      );
      oauth2Client.setCredentials(userTokens);
      return google.drive({ version: 'v3', auth: oauth2Client });
    }

    if (this.driveClient) return this.driveClient;

    const credPath = process.env.GOOGLE_CREDENTIALS_PATH || path.resolve(process.cwd(), 'credentials.json');
    const tokenPath = process.env.GOOGLE_TOKEN_PATH || path.resolve(process.cwd(), 'token.json');

    const credContent = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    const tokenContent = fs.existsSync(tokenPath) ? JSON.parse(fs.readFileSync(tokenPath, 'utf8')) : {};
    const keys = credContent.installed || credContent.web;

    const oauth2Client = new google.auth.OAuth2(
      keys.client_id,
      keys.client_secret,
      keys.redirect_uris?.[0] || 'http://localhost'
    );
    oauth2Client.setCredentials(tokenContent);

    oauth2Client.on('tokens', (newTokens) => {
      if (fs.existsSync(tokenPath)) {
        const current = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        fs.writeFileSync(tokenPath, JSON.stringify({ ...current, ...newTokens }, null, 2));
      }
    });

    this.driveClient = google.drive({ version: 'v3', auth: oauth2Client });
    return this.driveClient;
  }

  private async getOrCreateFolder(folderName: string, parentId?: string, driveInstance?: drive_v3.Drive): Promise<string> {
    const drive = driveInstance || this.getClient();
    let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }

    const res = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (res.data.files && res.data.files.length > 0) {
      return res.data.files[0].id!;
    }

    // Create folder
    const folderMetadata: drive_v3.Schema$File = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    };

    const created = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id',
    });

    return created.data.id!;
  }

  async uploadFile(options: UploadOptions): Promise<boolean> {
    const { filePath, key, contentType, logger, metadata } = options;

    logger.info(`GoogleDriveStorageProvider: uploading ${filePath} (key: ${key})...`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist at path: ${filePath}`);
    }

    const userTokens = metadata?.userTokens ? (typeof metadata.userTokens === 'string' ? JSON.parse(metadata.userTokens) : metadata.userTokens) : undefined;
    const drive = this.getClient(userTokens);
    const mainFolderName = metadata?.driveFolderName || process.env.GOOGLE_DRIVE_FOLDER_NAME || 'RecordingBot';

    // 1. Get or create root "RecordingBot" folder
    const rootId = await this.getOrCreateFolder(mainFolderName, undefined, drive);

    // 2. Get or create date folder "YYYY-MM-DD"
    const today = new Date().toISOString().split('T')[0];
    const dateFolderId = await this.getOrCreateFolder(today, rootId, drive);

    const fileName = path.basename(key) || path.basename(filePath);

    // 2.5. Fix webm metadata using ffmpeg if it's a webm file
    let finalFilePath = filePath;
    if (filePath.endsWith('.webm') || contentType.includes('webm')) {
      logger.info(`GoogleDriveStorageProvider: Fixing webm metadata for ${filePath} using ffmpeg...`);
      const fixedFilePath = `${filePath}.fixed.webm`;
      try {
        const { execSync } = require('child_process');
        execSync(`ffmpeg -y -i "${filePath}" -c copy "${fixedFilePath}"`, { stdio: 'ignore' });
        if (fs.existsSync(fixedFilePath)) {
          finalFilePath = fixedFilePath;
          logger.info(`GoogleDriveStorageProvider: Successfully fixed webm metadata.`);
        }
      } catch (err) {
        logger.warn(`GoogleDriveStorageProvider: ffmpeg failed to fix webm, falling back to original:`, err);
      }
    }

    // 3. Upload main file (video/webm or mp4)
    const fileMetadata: drive_v3.Schema$File = {
      name: fileName,
      parents: [dateFolderId],
    };

    const media = {
      mimeType: contentType,
      body: fs.createReadStream(finalFilePath),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink',
    });

    this.lastUploadedWebLink = response.data.webViewLink || null;
    logger.info(`GoogleDriveStorageProvider: Main file uploaded successfully! ID: ${response.data.id}, Link: ${response.data.webViewLink}`);

    // 4. Check if transcript exists or if we should run Whisper AI fallback
    const dir = path.dirname(filePath);
    const baseWithoutExt = path.basename(filePath, path.extname(filePath));
    const transcriptPath = path.join(dir, `${baseWithoutExt}.txt`);

    let hasValidTranscript = false;
    if (fs.existsSync(transcriptPath)) {
      try {
        const content = fs.readFileSync(transcriptPath, 'utf8').trim();
        // Check if there is actual dialogue (more than 3 non-empty lines)
        const lines = content.split('\n').filter(l => l.trim().length > 0);
        if (lines.length >= 3) {
          hasValidTranscript = true;
        }
      } catch (err) {
        logger.warn('GoogleDriveStorageProvider: Error reading existing transcript:', err);
      }
    }

    // Fallback: If CC scraping yielded no transcript, invoke local Whisper AI
    if (!hasValidTranscript) {
      logger.info(`GoogleDriveStorageProvider: Transcript missing or empty. Attempting Whisper AI fallback...`);
      const possiblePythonBins = [
        '/app/whisper-env/bin/python',
        '/var/www/RecordingBot/whisper-env/bin/python',
        'python3'
      ];
      const possibleScripts = [
        '/app/scripts/whisper_transcribe.py',
        '/var/www/RecordingBot/scripts/whisper_transcribe.py',
        path.resolve(process.cwd(), '../scripts/whisper_transcribe.py')
      ];

      const pythonBin = possiblePythonBins.find(p => fs.existsSync(p));
      const scriptPath = possibleScripts.find(s => fs.existsSync(s));

      if (pythonBin && scriptPath) {
        try {
          const { execSync } = require('child_process');
          logger.info(`GoogleDriveStorageProvider: Running Whisper fallback (${pythonBin} ${scriptPath})...`);
          execSync(`"${pythonBin}" "${scriptPath}" "${finalFilePath}" "${transcriptPath}"`, {
            stdio: 'inherit',
            timeout: 15 * 60 * 1000 // 15 min max
          });
          if (fs.existsSync(transcriptPath)) {
            logger.info(`GoogleDriveStorageProvider: Whisper fallback generated transcript successfully!`);
          }
        } catch (whisperErr) {
          logger.warn(`GoogleDriveStorageProvider: Whisper AI fallback failed:`, whisperErr);
        }
      } else {
        logger.warn(`GoogleDriveStorageProvider: Whisper python environment not found, skipping fallback.`);
      }
    }

    if (fs.existsSync(transcriptPath)) {
      logger.info(`GoogleDriveStorageProvider: Found transcript at ${transcriptPath}, uploading...`);
      try {
        const niceBaseWithoutExt = path.basename(key, path.extname(key)) || baseWithoutExt;
        const transcriptMeta: drive_v3.Schema$File = {
          name: `${niceBaseWithoutExt}_transcripcion.txt`,
          parents: [dateFolderId],
        };
        const transcriptMedia = {
          mimeType: 'text/plain',
          body: fs.createReadStream(transcriptPath),
        };
        const tRes = await drive.files.create({
          requestBody: transcriptMeta,
          media: transcriptMedia,
          fields: 'id, name, webViewLink',
        });
        logger.info(`GoogleDriveStorageProvider: Transcript uploaded successfully! ID: ${tRes.data.id}`);
      } catch (tErr) {
        logger.warn('GoogleDriveStorageProvider: Could not upload transcript .txt:', tErr);
      }
    }
    
    if (finalFilePath !== filePath && fs.existsSync(finalFilePath)) {
      try {
        fs.unlinkSync(finalFilePath);
      } catch (e) {
        logger.warn(`Could not delete temporary fixed webm file: ${e}`);
      }
    }

    return true;
  }

  async getSignedUrl?(key: string): Promise<string> {
    return this.lastUploadedWebLink || 'https://drive.google.com';
  }
}

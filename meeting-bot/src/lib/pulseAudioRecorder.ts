import { spawn, ChildProcess } from 'child_process';
import { Logger } from 'winston';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';

const execFileAsync = promisify(execFile);

export class PulseAudioRecorder {
  private pulseServer: string;
  private pulseSink: string;
  private baseOutputPath: string;
  private logger: Logger;
  private currentProcess: ChildProcess | null = null;
  private parts: string[] = [];
  private partIndex: number = 0;
  private isRecording: boolean = false;
  private isPaused: boolean = false;

  constructor(pulseServer: string, pulseSink: string, baseOutputPath: string, logger: Logger) {
    this.pulseServer = pulseServer;
    this.pulseSink = pulseSink;
    this.baseOutputPath = baseOutputPath;
    this.logger = logger;
  }

  async start(): Promise<void> {
    if (this.isRecording) return;
    this.isRecording = true;
    this.isPaused = false;
    await this.startCurrentPart();
  }

  private async startCurrentPart(): Promise<void> {
    const dir = path.dirname(this.baseOutputPath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    const partPath = `${this.baseOutputPath}.part${this.partIndex}.aac`;
    this.parts.push(partPath);
    this.logger.info(`[PulseAudioRecorder]: Starting audio recording part ${this.partIndex} on sink ${this.pulseSink} (${this.pulseServer})...`, {
      partPath,
    });

    return new Promise((resolve, reject) => {
      let settled = false;
      const monitorSource = `${this.pulseSink}.monitor`;

      const ffmpegArgs = [
        '-y',
        '-loglevel', 'warning',
        '-f', 'pulse',
        '-i', monitorSource,
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '48000',
        '-ac', '2',
        partPath,
      ];

      const env = {
        ...process.env,
        PULSE_SERVER: this.pulseServer,
      };

      const proc = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
      });

      this.currentProcess = proc;

      let stderr = '';
      proc.stderr?.on('data', (d) => {
        stderr += d.toString();
      });

      proc.on('error', (err) => {
        this.logger.error('[PulseAudioRecorder]: FFmpeg process error:', err);
        if (!settled) {
          settled = true;
          reject(err);
        }
      });

      proc.on('exit', (code, signal) => {
        this.logger.info(`[PulseAudioRecorder]: FFmpeg process exited with code ${code}, signal ${signal}`);
        if (!settled && code !== 0 && code !== null) {
          settled = true;
          reject(new Error(`FFmpeg exited early with code ${code}: ${stderr}`));
        }
      });

      // Verify that FFmpeg starts successfully and doesn't exit immediately
      setTimeout(() => {
        if (!settled) {
          if (proc.exitCode === null && !proc.killed) {
            settled = true;
            this.logger.info(`[PulseAudioRecorder]: FFmpeg audio recording part ${this.partIndex} started successfully.`);
            resolve();
          } else {
            settled = true;
            reject(new Error(`FFmpeg failed to start: ${stderr}`));
          }
        }
      }, 500);
    });
  }

  async pause(): Promise<void> {
    if (!this.isRecording || this.isPaused) return;
    this.logger.info('[PulseAudioRecorder]: Pausing audio recording (stopping current part)...');
    this.isPaused = true;
    await this.stopCurrentPart();
    this.partIndex++;
  }

  async resume(): Promise<void> {
    if (!this.isRecording || !this.isPaused) return;
    this.logger.info('[PulseAudioRecorder]: Resuming audio recording (starting new part)...');
    this.isPaused = false;
    await this.startCurrentPart();
  }

  private async stopCurrentPart(): Promise<void> {
    const proc = this.currentProcess;
    if (!proc) return;
    this.currentProcess = null;

    if (proc.exitCode !== null || proc.killed) return;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (!proc.killed && proc.exitCode === null) {
          this.logger.warn('[PulseAudioRecorder]: FFmpeg did not exit after SIGINT, sending SIGKILL');
          proc.kill('SIGKILL');
        }
        resolve();
      }, 4000);

      proc.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });

      try {
        if (proc.stdin && !proc.stdin.destroyed) {
          proc.stdin.write('q\n');
          proc.stdin.end();
        } else {
          proc.kill('SIGINT');
        }
      } catch {
        proc.kill('SIGINT');
      }
    });
  }

  async stop(): Promise<string | null> {
    if (!this.isRecording) return null;
    this.logger.info('[PulseAudioRecorder]: Stopping audio recording completely...');
    this.isRecording = false;

    if (!this.isPaused) {
      await this.stopCurrentPart();
    }

    // Filter parts that actually exist and have >0 bytes
    const validParts = this.parts.filter(p => fs.existsSync(p) && fs.statSync(p).size > 0);
    if (validParts.length === 0) {
      this.logger.warn('[PulseAudioRecorder]: No valid audio parts were recorded!');
      return null;
    }

    if (validParts.length === 1) {
      this.logger.info(`[PulseAudioRecorder]: Single audio part recorded: ${validParts[0]}`);
      return validParts[0];
    }

    // If multiple parts exist (due to pause/resume), concatenate them cleanly
    const concatListPath = `${this.baseOutputPath}.parts.txt`;
    const combinedPath = `${this.baseOutputPath}.aac`;
    const lines = validParts.map(p => `file '${path.resolve(p)}'`).join('\n');
    await fs.promises.writeFile(concatListPath, lines, 'utf8');

    this.logger.info(`[PulseAudioRecorder]: Concatenating ${validParts.length} audio parts into ${combinedPath}...`);
    try {
      await execFileAsync('ffmpeg', [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
        '-c', 'copy',
        combinedPath,
      ]);

      // Clean up part files
      for (const p of validParts) {
        await fs.promises.unlink(p).catch(() => {});
      }
      await fs.promises.unlink(concatListPath).catch(() => {});

      return combinedPath;
    } catch (concatErr) {
      this.logger.error('[PulseAudioRecorder]: Failed to concatenate audio parts:', concatErr);
      return validParts[0];
    }
  }
}

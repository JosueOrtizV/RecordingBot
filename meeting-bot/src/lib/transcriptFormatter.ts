import fs from 'fs';
import path from 'path';

export interface CaptionEntry {
  timestamp: string; // HH:MM:SS
  speaker: string;
  text: string;
}

export class TranscriptFormatter {
  private entries: CaptionEntry[] = [];

  addEntry(timestamp: string, speaker: string, text: string) {
    const cleanSpeaker = (speaker || 'Participante Desconocido').trim();
    const cleanText = (text || '').trim();

    if (!cleanText) return;

    // Check if we can append to the previous entry from the same speaker if within same time window
    const lastEntry = this.entries[this.entries.length - 1];
    if (lastEntry && lastEntry.speaker.toLowerCase() === cleanSpeaker.toLowerCase()) {
      if (!lastEntry.text.endsWith(cleanText) && !cleanText.startsWith(lastEntry.text)) {
        lastEntry.text += ' ' + cleanText;
        return;
      }
    }

    this.entries.push({
      timestamp,
      speaker: cleanSpeaker,
      text: cleanText,
    });
  }

  format(): string {
    if (this.entries.length === 0) {
      return `[${new Date().toLocaleTimeString('es-MX')}] (No se detectaron subtítulos durante la reunión)\n`;
    }

    const lines: string[] = [];
    lines.push('=====================================================');
    lines.push(`  TRANSCRIPCIÓN DE REUNIÓN - ${new Date().toLocaleDateString('es-MX')}`);
    lines.push('=====================================================\n');

    for (const entry of this.entries) {
      lines.push(`[${entry.timestamp}] ${entry.speaker}: ${entry.text}`);
    }

    return lines.join('\n') + '\n';
  }

  saveToFile(outputPath: string): void {
    const formatted = this.format();
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, formatted, 'utf8');
  }

  getEntries(): CaptionEntry[] {
    return this.entries;
  }
}

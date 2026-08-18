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

    const lastEntry = this.entries[this.entries.length - 1];
    if (lastEntry && lastEntry.speaker.toLowerCase() === cleanSpeaker.toLowerCase()) {
      if (cleanText === lastEntry.text) {
        return; // Exact duplicate
      }
      if (cleanText.startsWith(lastEntry.text)) {
        // The new text is an expansion of the last text (Google Meet live caption updating)
        lastEntry.text = cleanText;
        return;
      }
      if (lastEntry.text.endsWith(cleanText)) {
        // The new text is a substring of what we already have (sometimes happens with overlapping mutations)
        return;
      }
      // If it's completely new text from the same speaker, just append it
      lastEntry.text += ' ' + cleanText;
      return;
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

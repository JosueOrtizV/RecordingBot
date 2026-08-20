import fs from 'fs';
import path from 'path';

export interface CaptionEntry {
  timestamp: string; // HH:MM:SS
  speaker: string;
  text: string;
  elementId?: string;
}

export class TranscriptFormatter {
  private entries: CaptionEntry[] = [];

  addEntry(timestamp: string, speaker: string, text: string, elementId?: string) {
    const cleanSpeaker = (speaker || 'Participante Desconocido').trim();
    const cleanText = (text || '').trim();

    if (!cleanText) return;

    if (elementId) {
      // Search backwards (up to 20 lines) to find the same element being updated
      for (let i = this.entries.length - 1; i >= Math.max(0, this.entries.length - 20); i--) {
        if (this.entries[i].elementId === elementId) {
           this.entries[i].text = cleanText;
           this.entries[i].timestamp = timestamp;
           return;
        }
      }
    }

    const lastEntry = this.entries[this.entries.length - 1];
    
    // If no elementId system is available, use heuristic fallback
    if (lastEntry && lastEntry.speaker.toLowerCase() === cleanSpeaker.toLowerCase() && !elementId) {
      if (cleanText === lastEntry.text) {
        return; // Exact duplicate
      }
      if (cleanText.startsWith(lastEntry.text)) {
        lastEntry.text = cleanText;
        return;
      }
      if (lastEntry.text.endsWith(cleanText)) {
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
      elementId,
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

    let currentSpeaker = '';
    let currentSpeakerLines: string[] = [];
    let currentTimestamp = '';

    // Advanced formatting: Group by speaker sequentially
    for (const entry of this.entries) {
      if (entry.speaker !== currentSpeaker) {
        if (currentSpeakerLines.length > 0) {
          lines.push(`[${currentTimestamp}] ${currentSpeaker}: ${currentSpeakerLines.join(' ')}`);
        }
        currentSpeaker = entry.speaker;
        currentTimestamp = entry.timestamp;
        currentSpeakerLines = [entry.text];
      } else {
        currentSpeakerLines.push(entry.text);
      }
    }
    
    if (currentSpeakerLines.length > 0) {
      lines.push(`[${currentTimestamp}] ${currentSpeaker}: ${currentSpeakerLines.join(' ')}`);
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

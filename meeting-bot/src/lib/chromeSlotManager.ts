import config from '../config';

export interface ChromeSlot {
  slotIndex: number;
  cdpUrl: string;
  pulseSink: string;
  pulseServer: string;
}

class ChromeSlotManager {
  private slots: ChromeSlot[] = [];
  private inUse: Set<number> = new Set();
  private waitQueue: Array<(slot: ChromeSlot) => void> = [];

  constructor() {
    const slotCount = Math.max(1, config.maxConcurrentJobs || 2);

    let host = 'chrome-cdp';
    let baseProxyPort = 9223;

    if (config.googleChromeCdpUrl) {
      try {
        const parsed = new URL(config.googleChromeCdpUrl);
        host = parsed.hostname;
        baseProxyPort = parseInt(parsed.port, 10) || 9223;
      } catch {
        // Fallback to default
      }
    }

    const pulseServer = config.pulseServer || `tcp:${host}:4713`;

    for (let i = 0; i < slotCount; i++) {
      const port = baseProxyPort + i * 2;
      this.slots.push({
        slotIndex: i,
        cdpUrl: `http://${host}:${port}`,
        pulseSink: `sink_${i}`,
        pulseServer,
      });
    }

    console.log(`[ChromeSlotManager]: Initialized ${this.slots.length} Chrome slots:`, this.slots);
  }

  async acquireSlot(): Promise<ChromeSlot> {
    const available = this.slots.find(s => !this.inUse.has(s.slotIndex));
    if (available) {
      this.inUse.add(available.slotIndex);
      console.log(`[ChromeSlotManager]: Acquired slot ${available.slotIndex} (${available.cdpUrl})`);
      return available;
    }

    console.log('[ChromeSlotManager]: All slots busy, queueing request...');
    return new Promise((resolve) => {
      this.waitQueue.push((slot) => {
        this.inUse.add(slot.slotIndex);
        console.log(`[ChromeSlotManager]: Dequeued and acquired slot ${slot.slotIndex} (${slot.cdpUrl})`);
        resolve(slot);
      });
    });
  }

  releaseSlot(slot: ChromeSlot): void {
    console.log(`[ChromeSlotManager]: Releasing slot ${slot.slotIndex} (${slot.cdpUrl})`);
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!;
      next(slot);
    } else {
      this.inUse.delete(slot.slotIndex);
    }
  }

  getSlotCount(): number {
    return this.slots.length;
  }

  getActiveSlotCount(): number {
    return this.inUse.size;
  }
}

export const chromeSlotManager = new ChromeSlotManager();

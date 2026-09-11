export interface ActiveBotHandle {
  botId: string;
  meetingTitle?: string;
  url?: string;
  userId?: string;
  stop: (save: boolean) => Promise<{ success: boolean; message: string }>;
}

export class ActiveBotRegistry {
  private bots = new Map<string, ActiveBotHandle>();

  register(botId: string, handle: ActiveBotHandle): void {
    this.bots.set(botId, handle);
  }

  unregister(botId: string): void {
    this.bots.delete(botId);
  }

  get(botId: string): ActiveBotHandle | undefined {
    return this.bots.get(botId);
  }

  has(botId: string): boolean {
    return this.bots.has(botId);
  }

  getAll(): ActiveBotHandle[] {
    return Array.from(this.bots.values());
  }

  async stopBot(botId: string, save: boolean): Promise<{ success: boolean; message: string }> {
    const handle = this.bots.get(botId);
    if (!handle) {
      return { success: false, message: 'Bot no encontrado o ya finalizó su llamada.' };
    }
    return await handle.stop(save);
  }
}

export const activeBotRegistry = new ActiveBotRegistry();

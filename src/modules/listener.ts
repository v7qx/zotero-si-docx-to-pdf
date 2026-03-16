import { PluginConfig } from "./config";
import { Logger } from "./logger";
import { Processor } from "./processor";

export class EventListener {
  private static notifierID = "";
  private static timers = new Map<number, ReturnType<typeof setTimeout>>();
  private static running = new Set<number>();
  private static queue: number[] = [];
  private static draining = false;
  private static readonly delayMs = 1500;

  static register() {
    if (this.notifierID) {
      return;
    }
    PluginConfig.ensureDefaults();

    const callback = {
      notify: async (
        event: string,
        type: string,
        ids: number[] | string[],
      ) => {
        if (!addon?.data.alive) {
          this.unregister();
          return;
        }
        if (event !== "add" || type !== "item") {
          return;
        }
        for (const id of ids) {
          const itemID = Number(id);
          if (Number.isFinite(itemID)) {
            this.schedule(itemID);
          }
        }
      },
    };

    this.notifierID = Zotero.Notifier.registerObserver(callback, ["item"]);
    Zotero.Plugins.addObserver({
      shutdown: ({ id }) => {
        if (id === addon.data.config.addonID) {
          this.unregister();
        }
      },
    });
    Logger.debug("Attachment notifier registered");
  }

  static unregister() {
    if (this.notifierID) {
      Zotero.Notifier.unregisterObserver(this.notifierID);
      this.notifierID = "";
    }
    for (const timerID of this.timers.values()) {
      clearTimeout(timerID);
    }
    this.timers.clear();
    this.running.clear();
    this.queue = [];
    this.draining = false;
  }

  private static schedule(itemID: number) {
    if (this.timers.has(itemID) || this.running.has(itemID)) {
      return;
    }
    const timerID = setTimeout(() => {
      this.timers.delete(itemID);
      this.queue.push(itemID);
      void this.drainQueue();
    }, this.delayMs);
    this.timers.set(itemID, timerID);
  }

  private static async drainQueue() {
    if (this.draining) {
      return;
    }
    this.draining = true;
    try {
      while (this.queue.length) {
        const itemID = this.queue.shift();
        if (!itemID || this.running.has(itemID)) {
          continue;
        }
        this.running.add(itemID);
        try {
          await Processor.processItem(itemID);
        } catch (error) {
          Logger.error("Processing queued attachment failed", {
            itemID,
            error: String(error),
          });
        } finally {
          this.running.delete(itemID);
        }
      }
    } finally {
      this.draining = false;
    }
  }
}

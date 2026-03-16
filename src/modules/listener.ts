import { PluginConfig } from "./config";
import { Logger } from "./logger";
import { Processor } from "./processor";
import { ZoteroItems } from "./zotero";
import { getString } from "../utils/locale";

export class EventListener {
  private static notifierID = "";
  private static timers = new Map<number, ReturnType<typeof setTimeout>>();
  private static retryCounts = new Map<number, number>();
  private static running = new Set<number>();
  private static queue: number[] = [];
  private static draining = false;
  private static readonly delayMs = 1500;
  private static readonly retryDelayMs = 5000;
  private static readonly maxRetries = 3;

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
    this.retryCounts.clear();
    this.running.clear();
    this.queue = [];
    this.draining = false;
  }

  private static schedule(itemID: number, delayMs = this.delayMs) {
    if (
      this.timers.has(itemID) ||
      this.running.has(itemID) ||
      this.queue.includes(itemID)
    ) {
      return;
    }
    const timerID = setTimeout(() => {
      this.timers.delete(itemID);
      this.queue.push(itemID);
      void this.drainQueue();
    }, delayMs);
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
          this.retryCounts.delete(itemID);
        } catch (error) {
          if (Processor.isRetryableError(error)) {
            const attempt = (this.retryCounts.get(itemID) || 0) + 1;
            if (attempt <= this.maxRetries) {
              this.retryCounts.set(itemID, attempt);
              Logger.warn("Retrying attachment after file readiness timeout", {
                itemID,
                attempt,
              });
              this.schedule(itemID, this.retryDelayMs);
              continue;
            }
            this.retryCounts.delete(itemID);
            ZoteroItems.notify(getString("notify-skip-not-ready"));
          }
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

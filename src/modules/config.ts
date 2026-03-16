import { getPref, setPref } from "../utils/prefs";
import { FileSystem } from "./fs";
import { Logger } from "./logger";

export type Backend = "auto" | "libreoffice" | "word-windows-only";

export interface PluginPrefs {
  deleteOriginal: boolean;
  backupBeforeDelete: boolean;
  backupDirectory: string;
  titleTemplate: string;
  backend: Backend;
  libreOfficePath: string;
  showNotifications: boolean;
  restrictByKeywords: boolean;
  keywordPattern: string;
}

export const DEFAULT_TITLE = "SI";

export const DEFAULT_PREFS: PluginPrefs = {
  deleteOriginal: false,
  backupBeforeDelete: true,
  backupDirectory: "",
  titleTemplate:
    'SI-{{ year suffix="-" }}{{ authors max="1" suffix="-" }}{{ title truncate="100" }}',
  backend: "auto",
  libreOfficePath: "",
  showNotifications: true,
  restrictByKeywords: false,
  keywordPattern: "si|supplement|supplementary",
};

export class PluginConfig {
  static getAll(): PluginPrefs {
    return {
      deleteOriginal: this.getBool(
        "deleteOriginal",
        DEFAULT_PREFS.deleteOriginal,
      ),
      backupBeforeDelete: this.getBool(
        "backupBeforeDelete",
        DEFAULT_PREFS.backupBeforeDelete,
      ),
      backupDirectory: this.getBackupDirectory(),
      titleTemplate: this.getString("titleTemplate", DEFAULT_PREFS.titleTemplate),
      backend: this.getBackend("backend", DEFAULT_PREFS.backend),
      libreOfficePath: this.getLibreOfficePath(),
      showNotifications: this.getBool(
        "showNotifications",
        DEFAULT_PREFS.showNotifications,
      ),
      restrictByKeywords: this.getBool(
        "restrictByKeywords",
        DEFAULT_PREFS.restrictByKeywords,
      ),
      keywordPattern: this.getString(
        "keywordPattern",
        DEFAULT_PREFS.keywordPattern,
      ),
    };
  }

  static ensureDefaults() {
    for (const [key, value] of Object.entries(DEFAULT_PREFS)) {
      try {
        getPref(key as keyof _ZoteroTypes.Prefs["PluginPrefsMap"]);
      } catch (_error) {
        setPref(
          key as keyof _ZoteroTypes.Prefs["PluginPrefsMap"],
          value as never,
        );
      }
    }
  }

  private static getBool(
    key: keyof _ZoteroTypes.Prefs["PluginPrefsMap"],
    fallback: boolean,
  ): boolean {
    try {
      return getPref(key as any) as boolean;
    } catch (_error) {
      return fallback;
    }
  }

  private static getString(
    key: keyof _ZoteroTypes.Prefs["PluginPrefsMap"],
    fallback: string,
  ): string {
    try {
      return (getPref(key as any) as string) || fallback;
    } catch (_error) {
      return fallback;
    }
  }

  private static getBackend(
    key: keyof _ZoteroTypes.Prefs["PluginPrefsMap"],
    fallback: Backend,
  ): Backend {
    const value = this.getString(key, fallback);
    return value === "auto" ||
      value === "libreoffice" ||
      value === "word-windows-only"
      ? value
      : fallback;
  }

  private static getLibreOfficePath(): string {
    const value = this.getString(
      "libreOfficePath",
      DEFAULT_PREFS.libreOfficePath,
    ).trim();
    if (!value || value === "undefined" || value === "null" || !FileSystem.exists(value)) {
      return "";
    }
    const name = FileSystem.leafName(value).toLowerCase();
    if (name === "soffice.exe" || name === "soffice") {
      return value;
    }
    Logger.warn("Ignoring invalid LibreOffice executable path", { value });
    return "";
  }

  private static getBackupDirectory(): string {
    const value = this.getString(
      "backupDirectory",
      DEFAULT_PREFS.backupDirectory,
    ).trim();
    if (value === "undefined" || value === "null") {
      return FileSystem.defaultBackupDirectory();
    }
    return value || FileSystem.defaultBackupDirectory();
  }
}

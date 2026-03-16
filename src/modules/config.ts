import { getPref, setPref } from "../utils/prefs";
import { FileSystem } from "./fs";

export type Backend = "libreoffice" | "word-windows-only";
export type RenameMode = "title-only" | "title-and-file";

function defaultBackend(): Backend {
  return Zotero.isWin ? "word-windows-only" : "libreoffice";
}

export interface PluginPrefs {
  deleteOriginal: boolean;
  backupBeforeDelete: boolean;
  backupDirectory: string;
  titleTemplate: string;
  renameMode: RenameMode;
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
  renameMode: "title-only",
  backend: defaultBackend(),
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
      renameMode: this.getRenameMode("renameMode", DEFAULT_PREFS.renameMode),
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
    if (value === "auto" || value === "__default__") {
      return defaultBackend();
    }
    return value === "libreoffice" ||
      value === "word-windows-only"
      ? value
      : fallback;
  }

  private static getRenameMode(
    key: keyof _ZoteroTypes.Prefs["PluginPrefsMap"],
    fallback: RenameMode,
  ): RenameMode {
    const value = this.getString(key, fallback);
    return value === "title-and-file" || value === "title-only"
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
    return value;
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

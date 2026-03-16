import { getPref, setPref } from "../utils/prefs";
import { getString } from "../utils/locale";
import { FileSystem } from "./fs";

export function registerPrefsScripts(window: Window) {
  const doc = window.document;
  const root = doc.documentElement;
  if (root?.getAttribute("data-siwordpdf-prefs-bound") === "true") {
    return;
  }
  root?.setAttribute("data-siwordpdf-prefs-bound", "true");
  addon.data.prefs = { window };

  const deleteOriginal = doc.querySelector(
    `#zotero-prefpane-${addon.data.config.addonRef}-deleteOriginal`,
  ) as XUL.Checkbox | null;
  const backupBeforeDelete = doc.querySelector(
    `#zotero-prefpane-${addon.data.config.addonRef}-backupBeforeDelete`,
  ) as XUL.Checkbox | null;
  const backupDirectory = doc.querySelector(
    `#zotero-prefpane-${addon.data.config.addonRef}-backupDirectory`,
  ) as HTMLInputElement | null;
  const renameMode = doc.querySelector(
    `#zotero-prefpane-${addon.data.config.addonRef}-renameMode`,
  ) as XUL.MenuList | null;
  const backend = doc.querySelector(
    `#zotero-prefpane-${addon.data.config.addonRef}-backend`,
  ) as XUL.MenuList | null;
  const libreOfficePath = doc.querySelector(
    `#zotero-prefpane-${addon.data.config.addonRef}-libreOfficePath`,
  ) as HTMLInputElement | null;
  if (deleteOriginal) {
    deleteOriginal.disabled = false;
    deleteOriginal.checked = safeGetBool("deleteOriginal");
    deleteOriginal.addEventListener("command", () => {
      setPref("deleteOriginal", deleteOriginal.checked);
      updateDeleteState();
    });
  }
  if (backupBeforeDelete) {
    backupBeforeDelete.checked = safeGetBool("backupBeforeDelete");
    backupBeforeDelete.addEventListener("command", () => {
      setPref("backupBeforeDelete", backupBeforeDelete.checked);
      updateDeleteState();
    });
  }

  const browseButton = doc.querySelector(
    `#zotero-prefpane-${addon.data.config.addonRef}-browseLibreOffice`,
  );
  bindButtonActivate(browseButton, async () => {
    await pickLibreOffice(window);
  });
  const browseBackupButton = doc.querySelector(
    `#zotero-prefpane-${addon.data.config.addonRef}-browseBackupDirectory`,
  );
  bindButtonActivate(browseBackupButton, async () => {
    await pickBackupDirectory(window);
  });

  const keywordPattern = doc.querySelector(
    `#zotero-prefpane-${addon.data.config.addonRef}-keywordPattern`,
  ) as HTMLTextAreaElement | null;
  const restrict = doc.querySelector(
    `#zotero-prefpane-${addon.data.config.addonRef}-restrictByKeywords`,
  ) as XUL.Checkbox | null;
  const updateKeywordState = () => {
    if (keywordPattern && restrict) {
      keywordPattern.disabled = !restrict.checked;
    }
  };
  const updateDeleteState = () => {
    if (deleteOriginal && backupBeforeDelete && backupDirectory && browseBackupButton) {
      backupBeforeDelete.disabled = !deleteOriginal.checked;
      backupDirectory.disabled =
        !deleteOriginal.checked || !backupBeforeDelete.checked;
      (browseBackupButton as HTMLButtonElement).disabled =
        !deleteOriginal.checked || !backupBeforeDelete.checked;
    }
  };
  const updateBackendState = () => {
    const usingLibreOffice = backend?.value === "libreoffice";
    if (libreOfficePath) {
      libreOfficePath.disabled = !usingLibreOffice;
    }
    if (browseButton) {
      (browseButton as HTMLButtonElement).disabled = !usingLibreOffice;
    }
  };
  if (restrict) {
    restrict.checked = safeGetBool("restrictByKeywords");
    restrict.addEventListener("command", () => {
      setPref("restrictByKeywords", restrict.checked);
      updateKeywordState();
    });
  }
  window.setTimeout(updateKeywordState, 0);
  window.setTimeout(updateDeleteState, 0);
  window.setTimeout(updateBackendState, 0);

  const titleTemplate = doc.querySelector(
    `#zotero-prefpane-${addon.data.config.addonRef}-titleTemplate`,
  ) as HTMLTextAreaElement | null;
  if (titleTemplate) {
    titleTemplate.value = safeGetString("titleTemplate");
    titleTemplate.addEventListener("input", () => {
      setPref("titleTemplate", titleTemplate.value);
    });
  }
  if (keywordPattern) {
    keywordPattern.value = safeGetString("keywordPattern");
    keywordPattern.addEventListener("input", () => {
      setPref("keywordPattern", keywordPattern.value);
    });
  }
  if (backupDirectory) {
    backupDirectory.value = safeGetString("backupDirectory");
    backupDirectory.placeholder = FileSystem.defaultBackupDirectory();
    backupDirectory.addEventListener("input", () => {
      setPref("backupDirectory", backupDirectory.value.trim());
    });
  }
  if (libreOfficePath) {
    libreOfficePath.value = safeGetString("libreOfficePath");
    libreOfficePath.addEventListener("input", () => {
      setPref("libreOfficePath", libreOfficePath.value.trim());
    });
  }
  if (backend) {
    const normalizedValue =
      safeGetString("backend") === "libreoffice"
        ? "libreoffice"
        : Zotero.isWin
          ? "word-windows-only"
          : "libreoffice";
    backend.value = normalizedValue;
    setPref("backend", normalizedValue);
    backend.addEventListener("command", () => {
      setPref("backend", backend.value as any);
      updateBackendState();
    });
  }
  if (renameMode) {
    const normalizedValue =
      safeGetString("renameMode") === "title-and-file"
        ? "title-and-file"
        : "title-only";
    renameMode.value = normalizedValue;
    setPref("renameMode", normalizedValue);
    renameMode.addEventListener("command", () => {
      setPref("renameMode", renameMode.value as any);
    });
  }

  const renameDocLink = doc.querySelector(
    `#zotero-prefpane-${addon.data.config.addonRef}-renameDocLink`,
  ) as HTMLAnchorElement | null;
  renameDocLink?.addEventListener("click", (event) => {
    event.preventDefault();
    Zotero.launchURL("https://www.zotero.org/support/file_renaming");
  });
}

async function pickLibreOffice(window: Window) {
  const picker = createFilePicker(
    window,
    getString("picker-libreoffice-title"),
    Ci.nsIFilePicker.modeOpen,
  );
  picker.appendFilters(Ci.nsIFilePicker.filterApps);
  const result = await showFilePicker(picker);
  if (result === Ci.nsIFilePicker.returnOK && picker.file) {
    const input = window.document.querySelector(
      `#zotero-prefpane-${addon.data.config.addonRef}-libreOfficePath`,
    ) as HTMLInputElement | null;
    const path = picker.file.path;
    setPref("libreOfficePath", path);
    if (input) {
      input.value = path;
    }
  }
}

async function pickBackupDirectory(window: Window) {
  const picker = createFilePicker(
    window,
    getString("picker-backup-title"),
    Ci.nsIFilePicker.modeGetFolder,
  );
  const result = await showFilePicker(picker);
  if (result === Ci.nsIFilePicker.returnOK && picker.file) {
    const input = window.document.querySelector(
      `#zotero-prefpane-${addon.data.config.addonRef}-backupDirectory`,
    ) as HTMLInputElement | null;
    const path = picker.file.path;
    setPref("backupDirectory", path);
    if (input) {
      input.value = path;
    }
  }
}

function safeGetString(
  key:
    | "titleTemplate"
    | "keywordPattern"
    | "backupDirectory"
    | "renameMode"
    | "libreOfficePath"
    | "backend",
): string {
  try {
    const value = String(getPref(key) || "").trim();
    if (!value || value === "undefined" || value === "null") {
      return "";
    }
    return value;
  } catch (_error) {
    return "";
  }
}

function safeGetBool(
  key: "deleteOriginal" | "restrictByKeywords" | "backupBeforeDelete",
): boolean {
  try {
    return Boolean(getPref(key));
  } catch (_error) {
    return false;
  }
}

function bindButtonActivate(
  button: Element | null,
  handler: () => Promise<void> | void,
): void {
  if (!button) {
    return;
  }
  let busy = false;
  const wrapped = async (event: Event) => {
    event.preventDefault();
    if (busy) {
      return;
    }
    busy = true;
    try {
      await handler();
    } catch (error) {
      Zotero.logError(
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      busy = false;
    }
  };
  button.addEventListener("command", wrapped);
  button.addEventListener("click", wrapped);
}

function createFilePicker(
  window: Window,
  title: string,
  mode: number,
): any {
  const picker = Cc["@mozilla.org/filepicker;1"].createInstance(
    Ci.nsIFilePicker,
  ) as any;
  try {
    picker.init((window as any).browsingContext, title, mode);
  } catch (_error) {
    picker.init(window as any, title, mode);
  }
  return picker;
}

function showFilePicker(picker: any): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof picker.open === "function") {
        picker.open((result: number) => resolve(result));
        return;
      }
      if (typeof picker.show === "function") {
        resolve(picker.show());
        return;
      }
      reject(new Error("File picker API is unavailable"));
    } catch (error) {
      reject(error);
    }
  });
}

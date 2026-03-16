import { getPref, setPref } from "../utils/prefs";
import { FileSystem } from "./fs";

export function registerPrefsScripts(window: Window) {
  addon.data.prefs = { window };
  const doc = window.document;

  const deleteOriginal = doc.querySelector(
    `#zotero-prefpane-${addon.data.config.addonRef}-deleteOriginal`,
  ) as XUL.Checkbox | null;
  const backupBeforeDelete = doc.querySelector(
    `#zotero-prefpane-${addon.data.config.addonRef}-backupBeforeDelete`,
  ) as XUL.Checkbox | null;
  const backupDirectory = doc.querySelector(
    `#zotero-prefpane-${addon.data.config.addonRef}-backupDirectory`,
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
  bindButtonActivate(browseButton, () => {
    pickLibreOffice(window);
  });
  const browseBackupButton = doc.querySelector(
    `#zotero-prefpane-${addon.data.config.addonRef}-browseBackupDirectory`,
  );
  bindButtonActivate(browseBackupButton, () => {
    pickBackupDirectory(window);
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
  if (restrict) {
    restrict.checked = safeGetBool("restrictByKeywords");
    restrict.addEventListener("command", () => {
      setPref("restrictByKeywords", restrict.checked);
      updateKeywordState();
    });
  }
  window.setTimeout(updateKeywordState, 0);
  window.setTimeout(updateDeleteState, 0);

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

  const renameDocLink = doc.querySelector(
    `#zotero-prefpane-${addon.data.config.addonRef}-renameDocLink`,
  ) as HTMLAnchorElement | null;
  renameDocLink?.addEventListener("click", (event) => {
    event.preventDefault();
    Zotero.launchURL("https://www.zotero.org/support/file_renaming");
  });
}

function pickLibreOffice(window: Window) {
  const picker = createFilePicker(
    window,
    "选择 LibreOffice 可执行文件",
    Ci.nsIFilePicker.modeOpen,
  );
  picker.appendFilters(Ci.nsIFilePicker.filterApps);
  const result = picker.show();
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

function pickBackupDirectory(window: Window) {
  const picker = createFilePicker(
    window,
    "选择 Word 备份文件夹",
    Ci.nsIFilePicker.modeGetFolder,
  );
  const result = picker.show();
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
  key: "titleTemplate" | "keywordPattern" | "backupDirectory",
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
  handler: () => void,
): void {
  if (!button) {
    return;
  }
  button.addEventListener("command", handler);
  button.addEventListener("click", handler);
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

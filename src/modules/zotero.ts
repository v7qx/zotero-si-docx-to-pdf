export interface CandidateContext {
  attachment: Zotero.Item;
  parentItem: Zotero.Item;
  fileName: string;
  filePath: string;
}

export interface ConversionResult {
  backendUsed: "auto" | "libreoffice" | "word-windows-only";
  outputPath: string;
  tempPaths: string[];
}

export class ZoteroItems {
  static async importPdf(
    parentItem: Zotero.Item,
    pdfPath: string,
    title: string,
  ): Promise<Zotero.Item> {
    const imported = (await Zotero.Attachments.importFromFile({
      file: this.toFile(pdfPath),
      libraryID: parentItem.libraryID,
      parentItemID: parentItem.id,
    })) as Zotero.Item;
    imported.setField("title", title);
    if (typeof imported.saveTx === "function") {
      await imported.saveTx();
    } else {
      await imported.save();
    }
    return imported;
  }

  static async renameImportedPdf(
    attachment: Zotero.Item,
    baseName: string,
  ): Promise<void> {
    const safeBaseName = baseName.trim();
    if (!safeBaseName) {
      return;
    }
    try {
      await attachment.renameAttachmentFile(`${safeBaseName}.pdf`, false, true);
    } catch (_error) {
      return;
    }
  }

  static notify(message: string, asError = false) {
    try {
      if (asError && Zotero.alert) {
        Zotero.alert(undefined as any, addon.data.config.addonName, message);
        return;
      }
      const win = new Zotero.ProgressWindow();
      win.changeHeadline(addon.data.config.addonName);
      win.addDescription(message);
      win.show();
      win.startCloseTimer(2500);
    } catch (_error) {
      return;
    }
  }

  static fileExists(path: string): boolean {
    try {
      return this.toFile(path).exists();
    } catch (_error) {
      return false;
    }
  }

  private static toFile(path: string): nsIFile {
    const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    file.initWithPath(path);
    return file;
  }
}

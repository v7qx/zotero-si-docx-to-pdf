import { type RenameMode } from "./config";
import { FileSystem } from "./fs";

export type CandidateKind = "word" | "pdf";

export interface CandidateContext {
  kind: CandidateKind;
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
  private static readonly MAX_FILENAME_BASE_LENGTH = 120;

  static async importPdf(
    parentItem: Zotero.Item,
    pdfPath: string,
  ): Promise<Zotero.Item> {
    const imported = (await Zotero.Attachments.importFromFile({
      file: this.toFile(pdfPath),
      libraryID: parentItem.libraryID,
      parentItemID: parentItem.id,
    })) as Zotero.Item;
    return imported;
  }

  static async applyAttachmentNaming(
    parentItem: Zotero.Item,
    attachment: Zotero.Item,
    baseName: string,
    renameMode: RenameMode,
  ): Promise<{ title: string; changed: boolean }> {
    const attachmentPath = await attachment.getFilePathAsync();
    const resolvedPath = typeof attachmentPath === "string" ? attachmentPath : "";
    const extension = this.getAttachmentExtension(attachment, resolvedPath);
    const plan = await this.buildUniqueNamePlan(
      parentItem,
      attachment,
      baseName,
      renameMode,
      extension,
    );
    const currentTitle = String(attachment.getField("title") || "").trim();
    const currentFileBase = this.getAttachmentFileBase(attachment, resolvedPath);
    const shouldUpdateTitle = currentTitle !== plan.title;
    const shouldRenameFile =
      renameMode === "title-and-file" &&
      Boolean(plan.fileName) &&
      currentFileBase.toLocaleLowerCase() !== plan.fileBase.toLocaleLowerCase();

    let changed = false;
    if (shouldUpdateTitle) {
      attachment.setField("title", plan.title);
      if (typeof attachment.saveTx === "function") {
        await attachment.saveTx();
      } else {
        await attachment.save();
      }
      changed = true;
    }

    if (shouldRenameFile && plan.fileName) {
      try {
        await (attachment as any).renameAttachmentFile(plan.fileName, {
          overwrite: false,
          unique: true,
        });
      } catch (_error) {
        return { title: plan.title, changed };
      }
      changed = true;
    }

    return { title: plan.title, changed };
  }

  static async applyImportedPdfNaming(
    parentItem: Zotero.Item,
    attachment: Zotero.Item,
    baseName: string,
    renameMode: RenameMode,
  ): Promise<string> {
    const result = await this.applyAttachmentNaming(
      parentItem,
      attachment,
      baseName,
      renameMode,
    );
    return result.title;
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

  static async verifyImportedPdfAttachment(
    attachment: Zotero.Item,
    parentItem: Zotero.Item,
  ): Promise<string> {
    const importedPath = await attachment.getFilePathAsync();
    const resolvedPath = typeof importedPath === "string" ? importedPath : "";
    if (
      !attachment.isPDFAttachment() ||
      attachment.parentItemID !== parentItem.id ||
      !resolvedPath ||
      !this.fileExists(resolvedPath) ||
      !/\.pdf$/i.test(resolvedPath)
    ) {
      throw new Error("Imported PDF attachment is missing on disk");
    }
    return resolvedPath;
  }

  static async verifyOriginalAttachmentBeforeDelete(
    attachment: Zotero.Item,
    parentItem: Zotero.Item,
    expectedPath: string,
    importedPdfPath: string,
  ): Promise<string> {
    const currentPath = await attachment.getFilePathAsync();
    const resolvedPath = typeof currentPath === "string" ? currentPath : "";
    if (
      !attachment.isAttachment() ||
      attachment.parentItemID !== parentItem.id ||
      !resolvedPath ||
      !this.fileExists(resolvedPath) ||
      resolvedPath !== expectedPath ||
      !/\.(doc|docx)$/i.test(resolvedPath) ||
      resolvedPath === importedPdfPath
    ) {
      throw new Error("Original DOC / DOCX attachment no longer matches the expected file");
    }
    return resolvedPath;
  }

  private static toFile(path: string): nsIFile {
    const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    file.initWithPath(path);
    return file;
  }

  private static async buildUniqueNamePlan(
    parentItem: Zotero.Item,
    attachment: Zotero.Item,
    baseName: string,
    renameMode: RenameMode,
    extension: string,
  ): Promise<{ title: string; fileBase: string; fileName: string }> {
    const existingTitles = new Set<string>();
    const existingFileBases = new Set<string>();
    for (const siblingID of parentItem.getAttachments()) {
      if (siblingID === attachment.id) {
        continue;
      }
      const sibling = (await Zotero.Items.getAsync(siblingID)) as Zotero.Item | undefined;
      if (!sibling?.isAttachment()) {
        continue;
      }
      const title = String(sibling.getField("title") || "").trim();
      if (title) {
        existingTitles.add(title.toLocaleLowerCase());
      }
      const siblingPath = await sibling.getFilePathAsync();
      const siblingFileName =
        typeof siblingPath === "string" && siblingPath
          ? FileSystem.basenameWithoutExtension(siblingPath)
          : String(sibling.attachmentFilename || "")
              .replace(/\.[^.]+$/, "")
              .trim();
      if (siblingFileName) {
        existingFileBases.add(siblingFileName.toLocaleLowerCase());
      }
    }

    let index = 1;
    while (true) {
      const suffix = index === 1 ? "" : `-${index}`;
      const title = `${baseName}${suffix}`.trim();
      const fileBase = this.sanitizeFilenameBase(baseName, suffix);
      const titleExists = existingTitles.has(title.toLocaleLowerCase());
      const fileExists =
        renameMode === "title-and-file" &&
        existingFileBases.has(fileBase.toLocaleLowerCase());
      if (!titleExists && !fileExists) {
        return {
          title,
          fileBase,
          fileName: extension ? `${fileBase}.${extension}` : "",
        };
      }
      index += 1;
    }
  }

  private static getAttachmentExtension(
    attachment: Zotero.Item,
    filePath: string,
  ): string {
    const fileName =
      (filePath && FileSystem.leafName(filePath)) ||
      String(attachment.attachmentFilename || "").trim();
    const match = fileName.match(/\.([^.]+)$/);
    return match ? match[1].toLocaleLowerCase() : "";
  }

  private static getAttachmentFileBase(
    attachment: Zotero.Item,
    filePath: string,
  ): string {
    if (filePath) {
      return FileSystem.basenameWithoutExtension(filePath).trim();
    }
    return String(attachment.attachmentFilename || "")
      .replace(/\.[^.]+$/u, "")
      .trim();
  }

  private static sanitizeFilenameBase(baseName: string, suffix = ""): string {
    const cleaned = `${baseName}${suffix}`
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/[. ]+$/g, "")
      .trim();
    if (cleaned.length <= this.MAX_FILENAME_BASE_LENGTH) {
      return cleaned;
    }
    const preservedSuffix = suffix.trim();
    if (!preservedSuffix) {
      return cleaned
        .slice(0, this.MAX_FILENAME_BASE_LENGTH)
        .replace(/[. ]+$/g, "")
        .trim();
    }
    const maxBaseLength = Math.max(
      1,
      this.MAX_FILENAME_BASE_LENGTH - preservedSuffix.length,
    );
    const trimmedBase = baseName
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/[. ]+$/g, "")
      .trim()
      .slice(0, maxBaseLength)
      .replace(/[. ]+$/g, "")
      .trim();
    return `${trimmedBase}${preservedSuffix}`;
  }
}

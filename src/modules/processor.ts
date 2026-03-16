import { Converter } from "./converter";
import { PluginConfig, type PluginPrefs } from "./config";
import { FileSystem } from "./fs";
import { Logger } from "./logger";
import { TitleTemplate } from "./template";
import { CandidateContext, ZoteroItems } from "./zotero";
import { getString } from "../utils/locale";

export class Processor {
  private static readonly FILE_READY_TIMEOUT_MS = 12000;
  private static readonly FILE_READY_POLL_INTERVAL_MS = 500;

  static async processItem(itemID: number) {
    PluginConfig.ensureDefaults();
    const prefs = PluginConfig.getAll();
    const candidate = await this.buildCandidate(itemID, prefs);
    if (!candidate) {
      return;
    }

    Logger.debug("Found matching Word attachment", {
      itemID,
      fileName: candidate.fileName,
      backend: prefs.backend,
    });

    let conversion;
    try {
      conversion = await Converter.convert(candidate, prefs);
    } catch (error) {
      if (prefs.showNotifications) {
        ZoteroItems.notify(this.buildConversionErrorMessage(error), true);
      }
      throw error;
    }
    try {
      const title = TitleTemplate.render(candidate.parentItem, prefs.titleTemplate);
      const imported = await ZoteroItems.importPdf(
        candidate.parentItem,
        conversion.outputPath,
      );
      const finalTitle = await ZoteroItems.applyImportedPdfNaming(
        candidate.parentItem,
        imported,
        title,
        prefs.renameMode,
      );
      const importedPath = await ZoteroItems.verifyImportedPdfAttachment(
        imported,
        candidate.parentItem,
      );
      if (prefs.deleteOriginal) {
        const originalPath = await ZoteroItems.verifyOriginalAttachmentBeforeDelete(
          candidate.attachment,
          candidate.parentItem,
          candidate.filePath,
          importedPath,
        );
        if (prefs.backupBeforeDelete) {
          const backupPath = FileSystem.backupFile(
            originalPath,
            prefs.backupDirectory,
          );
          Logger.debug("Backed up original Word attachment before deletion", {
            attachmentID: candidate.attachment.id,
            backupPath,
          });
        }
        await candidate.attachment.eraseTx();
      }
      if (prefs.showNotifications) {
        ZoteroItems.notify(getString("notify-converted", { args: { title: finalTitle } }));
      }
    } finally {
      Converter.cleanup(conversion);
    }
  }

  private static async buildCandidate(
    itemID: number,
    prefs: PluginPrefs,
  ): Promise<CandidateContext | null> {
    const attachment = (await Zotero.Items.getAsync(itemID)) as Zotero.Item | undefined;
    if (!attachment || !attachment.isAttachment() || !attachment.parentItemID) {
      return null;
    }
    const fileName =
      attachment.attachmentFilename ||
      attachment.getField("title");
    if (!fileName || !/\.(doc|docx)$/i.test(fileName)) {
      return null;
    }

    const parentItem = (await Zotero.Items.getAsync(
      attachment.parentItemID,
    )) as Zotero.Item | undefined;
    if (!parentItem || !parentItem.isRegularItem()) {
      return null;
    }

    if (
      prefs.restrictByKeywords &&
      !this.matchesKeyword(fileName, prefs.keywordPattern)
    ) {
      return null;
    }

    let hasSiblingPdf = false;
    const siblingIDs = parentItem.isRegularItem() ? parentItem.getAttachments() : [];
    for (const siblingID of siblingIDs) {
      if (siblingID === attachment.id) {
        continue;
      }
      const sibling = (await Zotero.Items.getAsync(siblingID)) as
        | Zotero.Item
        | undefined;
      if (sibling?.isPDFAttachment()) {
        hasSiblingPdf = true;
        break;
      }
    }
    if (!hasSiblingPdf) {
      if (prefs.showNotifications) {
        ZoteroItems.notify(getString("notify-skip-no-pdf"));
      }
      return null;
    }

    const resolvedFilePath = await this.waitForAttachmentFileReady(attachment);
    if (!resolvedFilePath) {
      throw new Error("Attachment file is not ready");
    }

    return {
      attachment,
      parentItem,
      fileName,
      filePath: resolvedFilePath,
    };
  }

  private static matchesKeyword(fileName: string, patternText: string) {
    try {
      const regex = new RegExp(patternText, "i");
      return Boolean(fileName && regex.test(fileName));
    } catch (error) {
      Logger.warn("Invalid keyword regex, falling back to default", {
        patternText,
        error: String(error),
      });
      const fallback = new RegExp("si|supplement|supplementary", "i");
      return Boolean(fileName && fallback.test(fileName));
    }
  }

  static isRetryableError(error: unknown): boolean {
    return String(error).includes("Attachment file is not ready");
  }

  private static buildConversionErrorMessage(error: unknown): string {
    const message = String(error);
    if (
      message.includes("Invalid LibreOffice executable") ||
      message.includes("LibreOffice executable not found")
    ) {
      return getString("error-invalid-libreoffice-path");
    }
    if (message.includes("process-failed")) {
      return getString("error-libreoffice-process-failed");
    }
    return getString("error-conversion", { args: { message } });
  }

  private static async waitForAttachmentFileReady(
    attachment: Zotero.Item,
  ): Promise<string> {
    const startedAt = Date.now();
    let lastPath = "";
    let lastSize = -1;
    let stableChecks = 0;

    while (Date.now() - startedAt < this.FILE_READY_TIMEOUT_MS) {
      const filePath = await attachment.getFilePathAsync();
      const resolvedPath = typeof filePath === "string" ? filePath : "";
      if (resolvedPath && FileSystem.exists(resolvedPath)) {
        const size = FileSystem.size(resolvedPath);
        if (size > 0) {
          if (resolvedPath === lastPath && size === lastSize) {
            stableChecks += 1;
          } else {
            lastPath = resolvedPath;
            lastSize = size;
            stableChecks = 0;
          }
          if (stableChecks >= 1) {
            return resolvedPath;
          }
        }
      }
      await Zotero.Promise.delay(this.FILE_READY_POLL_INTERVAL_MS);
    }

    Logger.warn("Attachment file was not ready before timeout", {
      attachmentID: attachment.id,
      fileName: attachment.attachmentFilename || attachment.getField("title"),
    });
    return "";
  }
}

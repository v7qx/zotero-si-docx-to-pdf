import { Converter } from "./converter";
import { PluginConfig, type PluginPrefs } from "./config";
import { FileSystem } from "./fs";
import { Logger } from "./logger";
import { TitleTemplate } from "./template";
import { CandidateContext, ZoteroItems } from "./zotero";

export class Processor {
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

    const conversion = await Converter.convert(candidate, prefs);
    try {
      const title = TitleTemplate.render(candidate.parentItem, prefs.titleTemplate);
      const imported = await ZoteroItems.importPdf(
        candidate.parentItem,
        conversion.outputPath,
        title,
      );
      await ZoteroItems.renameImportedPdf(imported, title);
      const importedPath = await imported.getFilePathAsync();
      if (!importedPath || !ZoteroItems.fileExists(importedPath)) {
        throw new Error("Imported PDF attachment is missing on disk");
      }
      if (prefs.deleteOriginal) {
        if (prefs.backupBeforeDelete) {
          const backupPath = FileSystem.backupFile(
            candidate.filePath,
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
        ZoteroItems.notify(`已自动转换 SI 附件：${candidate.fileName}`);
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

    await Zotero.Promise.delay(500);

    const filePath = await attachment.getFilePathAsync();
    const resolvedFilePath = typeof filePath === "string" ? filePath : "";
    const fileName =
      attachment.attachmentFilename ||
      resolvedFilePath.split(/[\\/]/).pop() ||
      attachment.getField("title");
    if (!resolvedFilePath || !fileName || !/\.(doc|docx)$/i.test(fileName)) {
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
    for (const siblingID of parentItem.getAttachments()) {
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
      return null;
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
}

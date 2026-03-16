import { DEFAULT_TITLE } from "./config";

export class TitleTemplate {
  static render(parentItem: Zotero.Item, template: string): string {
    const safeTemplate = (template || "").trim() || DEFAULT_TITLE;
    try {
      const rendered = (Zotero.Attachments as any).getFileBaseNameFromItem(
        parentItem,
        { formatString: safeTemplate },
      );
      return rendered.replace(/\s+/g, " ").trim() || DEFAULT_TITLE;
    } catch (_error) {
      // Fallback for environments where the parser rejects the template.
      const firstCreator = String(parentItem.getField("firstCreator") || "").trim();
      const year = String(parentItem.getField("year", false, true) || "").trim();
      return (
        safeTemplate
          .replace(/\{\{\s*firstCreator[^}]*\}\}/g, firstCreator)
          .replace(/\{\{\s*year[^}]*\}\}/g, year)
          .replace(/\s+/g, " ")
          .trim() || DEFAULT_TITLE
      );
    }
  }
}

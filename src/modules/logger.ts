export class Logger {
  private static readonly pathKeyPattern = /(path|paths|dir|directory)$/i;

  static debug(message: string, details?: unknown): void {
    this.log("debug", message, details);
  }

  static warn(message: string, details?: unknown): void {
    this.log("warning", message, details);
  }

  static error(message: string, details?: unknown): void {
    this.log("error", message, details);
  }

  private static log(level: string, message: string, details?: unknown): void {
    const suffix = details === undefined ? "" : ` | ${this.stringify(details)}`;
    const finalMessage = `[${addon.data.config.addonName}:${level}] ${message}${suffix}`;
    Zotero.debug?.(finalMessage);
    try {
      Services.console.logStringMessage(finalMessage);
    } catch (_error) {
      return;
    }
  }

  private static stringify(value: unknown): string {
    if (value instanceof Error) {
      return this.redactPaths(`${value.message}\n${value.stack || ""}`);
    }
    if (typeof value === "string") {
      return this.redactPaths(value);
    }
    try {
      return JSON.stringify(value, (key, currentValue) =>
        this.sanitizeValue(key, currentValue),
      );
    } catch (_error) {
      return this.redactPaths(String(value));
    }
  }

  private static sanitizeValue(key: string, value: unknown): unknown {
    if (typeof value !== "string") {
      return value;
    }
    if (this.pathKeyPattern.test(key)) {
      return "<redacted-path>";
    }
    return this.redactPaths(value);
  }

  private static redactPaths(text: string): string {
    return text
      .replace(
        /\b[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*/g,
        "<redacted-path>",
      )
      .replace(/(?:^|[\s(])\/(?:[^/\s"'<>|]+\/)*[^/\s"'<>|]*/g, (match) =>
        match.startsWith("/") ? "<redacted-path>" : `${match[0]}<redacted-path>`,
      );
  }
}

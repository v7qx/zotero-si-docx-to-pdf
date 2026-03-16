import { type PluginPrefs } from "./config";
import { FileSystem, ProcessRunner } from "./fs";
import { CandidateContext, ConversionResult } from "./zotero";

export class Converter {
  static async convert(
    candidate: CandidateContext,
    prefs: PluginPrefs,
  ): Promise<ConversionResult> {
    switch (prefs.backend) {
      case "libreoffice":
        return this.convertWithLibreOffice(candidate, prefs);
      case "word-windows-only":
        return this.convertWithWord(candidate);
      case "auto":
      default:
        return this.convertAutomatically(candidate, prefs);
    }
  }

  static cleanup(conversion: ConversionResult) {
    for (const tempPath of conversion.tempPaths) {
      FileSystem.remove(tempPath, true);
    }
  }

  private static async convertAutomatically(
    candidate: CandidateContext,
    prefs: PluginPrefs,
  ): Promise<ConversionResult> {
    const errors: string[] = [];
    if (Zotero.isWin) {
      try {
        return await this.convertWithWord(candidate);
      } catch (error) {
        errors.push(`Word: ${String(error)}`);
      }
      try {
        return await this.convertWithLibreOffice(candidate, prefs);
      } catch (error) {
        errors.push(`LibreOffice: ${String(error)}`);
      }
      throw new Error(errors.join(" | "));
    }

    try {
      return await this.convertWithLibreOffice(candidate, prefs);
    } catch (error) {
      errors.push(`LibreOffice: ${String(error)}`);
    }
    throw new Error(errors.join(" | "));
  }

  private static async convertWithLibreOffice(
    candidate: CandidateContext,
    prefs: PluginPrefs,
  ): Promise<ConversionResult> {
    const executable =
      prefs.libreOfficePath ||
      ProcessRunner.findFirstExisting([
        "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
        "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
        "/usr/bin/libreoffice",
        "/snap/bin/libreoffice",
      ]);
    if (!executable) {
      throw new Error("LibreOffice executable not found");
    }

    const tempDir = FileSystem.createUniqueTempDir("siwordpdf-lo-");
    const outputPath = FileSystem.join(
      tempDir,
      `${FileSystem.basenameWithoutExtension(candidate.filePath)}.pdf`,
    );
    await ProcessRunner.exec(executable, [
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      tempDir,
      candidate.filePath,
    ]);
    if (!FileSystem.exists(outputPath) || FileSystem.size(outputPath) <= 0) {
      FileSystem.remove(tempDir, true);
      throw new Error("LibreOffice conversion did not create a valid PDF");
    }
    return {
      backendUsed: "libreoffice",
      outputPath,
      tempPaths: [tempDir],
    };
  }

  private static async convertWithWord(
    candidate: CandidateContext,
  ): Promise<ConversionResult> {
    if (!Zotero.isWin) {
      throw new Error("Microsoft Word backend is only available on Windows");
    }
    const wscript = ProcessRunner.findFirstExisting([
      "C:\\Windows\\System32\\wscript.exe",
    ]);
    if (!wscript) {
      throw new Error("wscript executable not found");
    }

    const tempDir = FileSystem.createUniqueTempDir("siwordpdf-word-");
    const outputPath = FileSystem.join(
      tempDir,
      `${FileSystem.basenameWithoutExtension(candidate.filePath)}.pdf`,
    );
    const scriptPath = FileSystem.join(tempDir, "word-to-pdf.vbs");
    FileSystem.writeUtf8(scriptPath, this.wordExportScript());
    await ProcessRunner.exec(wscript, [
      "//B",
      "//NoLogo",
      scriptPath,
      candidate.filePath,
      outputPath,
    ]);
    if (!FileSystem.exists(outputPath) || FileSystem.size(outputPath) <= 0) {
      FileSystem.remove(tempDir, true);
      throw new Error("Word conversion did not create a valid PDF");
    }
    return {
      backendUsed: "word-windows-only",
      outputPath,
      tempPaths: [tempDir],
    };
  }

  private static wordExportScript(): string {
    return [
      "On Error Resume Next",
      "Dim inputPath, outputPath, wordApp, doc",
      "inputPath = WScript.Arguments.Item(0)",
      "outputPath = WScript.Arguments.Item(1)",
      "Set wordApp = CreateObject(\"Word.Application\")",
      "If Err.Number <> 0 Then",
      "  WScript.Quit 2",
      "End If",
      "wordApp.Visible = False",
      "wordApp.DisplayAlerts = 0",
      "Set doc = wordApp.Documents.Open(inputPath, False, True)",
      "If Err.Number <> 0 Then",
      "  wordApp.Quit",
      "  WScript.Quit 3",
      "End If",
      "doc.ExportAsFixedFormat outputPath, 17",
      "doc.Close False",
      "wordApp.Quit",
      "If Err.Number <> 0 Then",
      "  WScript.Quit 4",
      "End If",
      "WScript.Quit 0",
    ].join("\n");
  }
}

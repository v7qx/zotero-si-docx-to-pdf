export class FileSystem {
  static toFile(path: string): nsIFile {
    const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    file.initWithPath(path);
    return file;
  }

  static exists(path: string): boolean {
    try {
      return this.toFile(path).exists();
    } catch (_error) {
      return false;
    }
  }

  static size(path: string): number {
    try {
      const file = this.toFile(path);
      return file.exists() ? Number(file.fileSize) : 0;
    } catch (_error) {
      return 0;
    }
  }

  static leafName(path: string): string {
    return this.toFile(path).leafName;
  }

  static createUniqueTempDir(prefix: string): string {
    const dir = Services.dirsvc.get("TmpD", Ci.nsIFile);
    dir.append(prefix);
    dir.createUnique(Ci.nsIFile.DIRECTORY_TYPE as number, 0o755);
    return dir.path;
  }

  static join(basePath: string, leafName: string): string {
    const file = this.toFile(basePath);
    file.appendRelativePath(leafName);
    return file.path;
  }

  static defaultBackupDirectory(): string {
    return this.join(Zotero.DataDirectory.dir, "word-to-pdf-backups");
  }

  static ensureDirectory(path: string): string {
    const dir = this.toFile(path);
    if (!dir.exists()) {
      dir.create(Ci.nsIFile.DIRECTORY_TYPE as number, 0o755);
    }
    return dir.path;
  }

  static backupFile(sourcePath: string, rootDir: string): string {
    const source = this.toFile(sourcePath);
    if (!source.exists()) {
      throw new Error(`Source file not found: ${sourcePath}`);
    }
    const root = this.toFile(rootDir);
    if (!root.exists()) {
      root.create(Ci.nsIFile.DIRECTORY_TYPE as number, 0o755);
    }
    const timestamp = new Date()
      .toISOString()
      .replace(/[:]/g, "-")
      .replace(/\..+$/, "");
    const targetDir = this.toFile(root.path);
    targetDir.append(`backup-${timestamp}`);
    targetDir.createUnique(Ci.nsIFile.DIRECTORY_TYPE as number, 0o755);
    source.copyTo(targetDir, source.leafName);
    const target = this.toFile(targetDir.path);
    target.append(source.leafName);
    return target.path;
  }

  static basenameWithoutExtension(path: string): string {
    const name = this.leafName(path);
    const match = name.match(/^(.*?)(\.[^.]+)?$/);
    return match?.[1] || name;
  }

  static writeUtf8(path: string, content: string): void {
    const file = this.toFile(path);
    const stream = Cc[
      "@mozilla.org/network/file-output-stream;1"
    ].createInstance(Ci.nsIFileOutputStream);
    stream.init(file, 0x02 | 0x08 | 0x20, 0o600, 0);
    const converter = Cc[
      "@mozilla.org/intl/converter-output-stream;1"
    ].createInstance(Ci.nsIConverterOutputStream);
    converter.init(stream, "UTF-8");
    converter.writeString(content);
    converter.close();
  }

  static remove(path: string, recursive = false): void {
    try {
      const file = this.toFile(path);
      if (file.exists()) {
        file.remove(recursive);
      }
    } catch (_error) {
      return;
    }
  }
}

export class ProcessRunner {
  static async exec(commandPath: string, args: string[]): Promise<void> {
    if (!Zotero.isWin && Zotero.Utilities?.Internal?.exec) {
      await Zotero.Utilities.Internal.exec(commandPath, args);
      return;
    }
    await this.execFallback(commandPath, args);
  }

  static findFirstExisting(candidates: string[]): string {
    return candidates.find((candidate) => candidate && FileSystem.exists(candidate)) || "";
  }

  private static execFallback(
    commandPath: string,
    args: string[],
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const executable = FileSystem.toFile(commandPath);
        if (!executable.exists()) {
          reject(new Error(`Executable not found: ${commandPath}`));
          return;
        }
        const process = Cc["@mozilla.org/process/util;1"].createInstance(
          Ci.nsIProcess,
        );
        process.init(executable);
        try {
          (process as any).startHidden = true;
          (process as any).noShell = true;
        } catch (_error) {
        }
        process.runwAsync(
          args,
          args.length,
          {
            observe: (_subject: unknown, topic: string) => {
              if (topic === "process-finished") {
                if (process.exitValue === 0) {
                  resolve();
                } else {
                  reject(
                    new Error(`Process exited with code ${process.exitValue}`),
                  );
                }
                return;
              }
              reject(new Error(`Process failed: ${topic}`));
            },
          },
          false,
        );
      } catch (error) {
        reject(error);
      }
    });
  }
}

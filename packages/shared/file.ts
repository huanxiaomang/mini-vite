import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { join, posix, resolve } from "node:path";

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export const normalize = posix.normalize;
export const normalizeImportPath = (path: string) =>
  posix.join("/", path.replace(/\\/g, "/"));

export async function copyFiles(src: string, dest: string): Promise<void> {
  const files = await readdir(src, { withFileTypes: true });
  await Promise.all(
    files.map(async (file) => {
      const srcPath = join(src, file.name);
      const destPath = join(dest, file.name);
      if (file.isDirectory()) {
        await mkdir(destPath, { recursive: true });
        await copyFiles(srcPath, destPath);
      } else {
        await cp(srcPath, destPath);
      }
    })
  );
}

export async function hasFolder(...filePath: string[]) {
  try {
    const stats = await stat(resolve(...filePath));
    return stats.isDirectory();
  } catch {
    return false;
  }
}

import { join } from "node:path";
import { access, copyFile, mkdir, readdir } from "node:fs/promises";
import { log } from "@nano-vite/shared";
import { ROOT } from "../constant";
import type { PluginOption } from "../type";

const plugin: PluginOption = {
  name: "vite-plugin-copy-public-dir",

  async writeBundle() {
    const sourceDir = join(ROOT, "public");
    const targetDir = join(ROOT, "dist");
    try {
      await access(sourceDir);
      const files = await readdir(sourceDir, { withFileTypes: true });
      await mkdir(targetDir, { recursive: true });

      for (const file of files) {
        const sourcePath = join(sourceDir, file.name);
        const targetPath = join(targetDir, file.name);

        if (file.isDirectory()) {
          await copyDir(sourcePath, targetPath);
        } else {
          await copyFile(sourcePath, targetPath);
        }
      }
      log.info("Successfully copied public/ to dist/");
    } catch (err: any) {
      if (err.code === "ENOENT") {
        log.warn("Warning: public/ directory does not exist, skipping copy.");
      } else {
        throw new Error(`Error copying files: ${err.message}`);
      }
    }
  },
};

async function copyDir(source: string, target: string) {
  await mkdir(target, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = join(source, entry.name);
    const targetPath = join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDir(sourcePath, targetPath);
    } else {
      await copyFile(sourcePath, targetPath);
    }
  }
}

export default plugin;
